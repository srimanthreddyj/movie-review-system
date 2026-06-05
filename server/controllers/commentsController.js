const Comment = require('../models/Comment');
const Movie = require('../models/Movie');
const Cast = require('../models/Cast');
const Clip = require('../models/Clip');

// Get all comments for a specific entity for the current user (Private)
exports.getComments = async (req, res) => {
  try {
    const { entityType, entityId } = req.query;

    if (!entityType || !entityId) {
      return res.status(400).json({ message: 'entityType and entityId are required query parameters' });
    }

    if (!['movie', 'cast', 'clip'].includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entityType. Must be movie, cast, or clip.' });
    }

    const comments = await Comment.find({
      userId: req.user.id,
      entityType,
      entityId
    }).sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add a private comment/note
exports.addComment = async (req, res) => {
  try {
    const { entityType, entityId, text } = req.body;

    if (!entityType || !entityId || !text) {
      return res.status(400).json({ message: 'entityType, entityId, and text are required fields' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ message: 'Comment text cannot exceed 1000 characters' });
    }

    if (!['movie', 'cast', 'clip'].includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entityType. Must be movie, cast, or clip.' });
    }

    // Verify entity exists
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

    const comment = new Comment({
      userId: req.user.id,
      entityType,
      entityId,
      text
    });

    await comment.save();
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Edit a comment
exports.updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ message: 'Comment text cannot exceed 1000 characters' });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Access control: only the owner can modify comments
    if (comment.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You can only edit your own notes.' });
    }

    comment.text = text;
    await comment.save();

    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a comment
exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Access control: only the owner can delete comments
    if (comment.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You can only delete your own notes.' });
    }

    await Comment.deleteOne({ _id: id });
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
