const User = require('../models/User');
const TagAssignment = require('../models/TagAssignment');
const Movie = require('../models/Movie');
const Cast = require('../models/Cast');
const Clip = require('../models/Clip');

// Get all tags for the authenticated user
exports.getTags = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.tags || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create a new tag in user's library
exports.createTag = async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Tag name is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if tag already exists (case-insensitive)
    const exists = user.tags.some(t => t.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      return res.status(400).json({ message: 'A tag with this name already exists' });
    }

    user.tags.push({ name, color: color || '#808080' });
    await user.save();

    // Return the newly created tag (the last one in the array)
    const newTag = user.tags[user.tags.length - 1];
    res.status(201).json(newTag);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a tag's name or color
exports.updateTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const tag = user.tags.id(id);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // Check if tag name is changing and already exists under another tag
    if (name && name.toLowerCase() !== tag.name.toLowerCase()) {
      const exists = user.tags.some(
        t => t._id.toString() !== id && t.name.toLowerCase() === name.toLowerCase()
      );
      if (exists) {
        return res.status(400).json({ message: 'A tag with this name already exists' });
      }
      tag.name = name;
    }

    if (color) {
      tag.color = color;
    }

    await user.save();
    res.json(tag);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a tag (and cascade delete tag assignments)
exports.deleteTag = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const tag = user.tags.id(id);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // Remove the tag from User.tags array
    user.tags.pull(id);
    await user.save();

    // Cascade delete all TagAssignment documents associated with this tag
    await TagAssignment.deleteMany({
      userId: req.user.id,
      tagId: id
    });

    res.json({ message: 'Tag and all its assignments deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Assign tag to an entity
exports.assignTag = async (req, res) => {
  try {
    const { tagId } = req.params;
    const { entityId, entityType } = req.body;

    if (!entityId || !entityType) {
      return res.status(400).json({ message: 'entityId and entityType are required' });
    }

    if (!['movie', 'cast', 'clip'].includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entityType. Must be movie, cast, or clip.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify tag belongs to the user
    const tag = user.tags.id(tagId);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found in library' });
    }

    // Verify entity exists in DB
    let entityExists = false;
    if (entityType === 'movie') {
      entityExists = await Movie.exists({ _id: entityId });
    } else if (entityType === 'cast') {
      entityExists = await Cast.exists({ _id: entityId });
    } else if (entityType === 'clip') {
      entityExists = await Clip.exists({ _id: entityId });
    }

    if (!entityExists) {
      return res.status(404).json({ message: `${entityType} not found` });
    }

    // Check if assignment already exists to prevent duplicate entries
    let assignment = await TagAssignment.findOne({
      userId: req.user.id,
      tagId,
      entityId
    });

    if (!assignment) {
      assignment = new TagAssignment({
        userId: req.user.id,
        tagId,
        entityId,
        entityType
      });
      await assignment.save();
    }

    res.status(201).json({
      message: 'Tag assigned successfully',
      assignment
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Remove tag assignment from an entity
exports.unassignTag = async (req, res) => {
  try {
    const { tagId, entityId } = req.params;

    const assignment = await TagAssignment.findOne({
      userId: req.user.id,
      tagId,
      entityId
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Tag assignment not found' });
    }

    await TagAssignment.deleteOne({ _id: assignment._id });

    res.json({ message: 'Tag unassigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
