const Clip = require('../models/Clip');
const Movie = require('../models/Movie');
const Cast = require('../models/Cast');
const User = require('../models/User');
const TagAssignment = require('../models/TagAssignment');

// Get all clips with filtering and pagination
exports.getClips = async (req, res) => {
  try {
    const { movieId, castId, clipType, tagId, page = 1, limit = 10, q } = req.query;
    const filter = { addedBy: req.user.id }; // Scope to the logged-in user only

    if (movieId) {
      filter.movieId = movieId;
    }

    if (castId) {
      filter.castInvolved = castId;
    }

    if (clipType) {
      filter.clipType = clipType;
    }

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }

    if (tagId) {
      const assignments = await TagAssignment.find({
        userId: req.user.id,
        tagId,
        entityType: 'clip'
      });
      const clipIds = assignments.map(a => a.entityId);
      filter._id = { $in: clipIds };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const clips = await Clip.find(filter)
      .skip(skip)
      .limit(limitNum)
      .populate('movieId', 'title posterUrl mediaType')
      .populate('castInvolved', 'name photoUrl gender')
      .populate('addedBy', 'name')
      .sort({ createdAt: -1 });

    const total = await Clip.countDocuments(filter);

    res.json({
      clips,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalClips: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add a new clip
exports.addClip = async (req, res) => {
  try {
    const { movieId, title, url, description, clipType, castInvolved } = req.body;

    if (!title || !url) {
      return res.status(400).json({ message: 'Title and URL are required' });
    }

    // Verify movie exists if provided
    if (movieId) {
      const movieExists = await Movie.exists({ _id: movieId });
      if (!movieExists) {
        return res.status(404).json({ message: 'Movie not found' });
      }
    }

    // Validate castInvolved if provided
    if (castInvolved && Array.isArray(castInvolved)) {
      const castsCount = await Cast.countDocuments({ _id: { $in: castInvolved } });
      if (castsCount !== castInvolved.length) {
        return res.status(400).json({ message: 'One or more cast members not found' });
      }
    }

    const clip = new Clip({
      movieId: movieId || null,
      title,
      url,
      description,
      clipType: clipType || 'trailer',
      castInvolved: castInvolved || [],
      addedBy: req.user.id
    });

    await clip.save();

    // Populate references before returning
    const populatedClip = await Clip.findById(clip._id)
      .populate('movieId', 'title posterUrl mediaType')
      .populate('castInvolved', 'name photoUrl gender')
      .populate('addedBy', 'name');

    res.status(201).json(populatedClip);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Edit a clip
exports.updateClip = async (req, res) => {
  try {
    const { id } = req.params;
    const { movieId, title, url, description, clipType, castInvolved } = req.body;

    const clip = await Clip.findById(id);
    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    // Access control: creator or admin
    if (clip.addedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You can only edit your own clips.' });
    }

    // Validate movie if provided
    if (movieId) {
      const movieExists = await Movie.exists({ _id: movieId });
      if (!movieExists) {
        return res.status(404).json({ message: 'Movie not found' });
      }
      clip.movieId = movieId;
    } else if (movieId === null || movieId === '') {
      clip.movieId = null;
    }

    // Validate castInvolved if provided
    if (castInvolved && Array.isArray(castInvolved)) {
      const castsCount = await Cast.countDocuments({ _id: { $in: castInvolved } });
      if (castsCount !== castInvolved.length) {
        return res.status(400).json({ message: 'One or more cast members not found' });
      }
      clip.castInvolved = castInvolved;
    }

    if (title) clip.title = title;
    if (url) clip.url = url;
    if (description !== undefined) clip.description = description;
    if (clipType) clip.clipType = clipType;

    await clip.save();

    const populatedClip = await Clip.findById(clip._id)
      .populate('movieId', 'title posterUrl mediaType')
      .populate('castInvolved', 'name photoUrl gender')
      .populate('addedBy', 'name');

    res.json(populatedClip);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a clip
exports.deleteClip = async (req, res) => {
  try {
    const { id } = req.params;

    const clip = await Clip.findById(id);
    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    // Access control: creator or admin
    if (clip.addedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You can only delete your own clips.' });
    }

    await Clip.deleteOne({ _id: id });

    // Clean up references in user favourites
    await User.updateMany(
      {},
      { $pull: { 'favourites.clips': { entityId: id } } }
    );

    res.json({ message: 'Clip deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
