const User = require('../models/User');
const Movie = require('../models/Movie');
const Cast = require('../models/Cast');
const Clip = require('../models/Clip');

// Get all favourites for the authenticated user
exports.getFavourites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const movieIds = user.favourites.movies.map(item => item.entityId);
    const castIds = user.favourites.cast.map(item => item.entityId);
    const clipIds = user.favourites.clips.map(item => item.entityId);

    // Fetch details in parallel
    const [movies, casts, clips] = await Promise.all([
      Movie.find({ _id: { $in: movieIds } }),
      Cast.find({ _id: { $in: castIds } }),
      Clip.find({ _id: { $in: clipIds } })
    ]);

    // Map details to favourites items
    const populatedMovies = user.favourites.movies.map(item => {
      const details = movies.find(m => m._id.toString() === item.entityId.toString());
      return {
        _id: item._id,
        entityId: item.entityId,
        level: item.level,
        details: details || null
      };
    });

    const populatedCasts = user.favourites.cast.map(item => {
      const details = casts.find(c => c._id.toString() === item.entityId.toString());
      return {
        _id: item._id,
        entityId: item.entityId,
        level: item.level,
        details: details || null
      };
    });

    const populatedClips = user.favourites.clips.map(item => {
      const details = clips.find(c => c._id.toString() === item.entityId.toString());
      return {
        _id: item._id,
        entityId: item.entityId,
        level: item.level,
        details: details || null
      };
    });

    res.json({
      movies: populatedMovies,
      cast: populatedCasts,
      clips: populatedClips
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add favourite (atomic, race-condition safe)
exports.addFavourite = async (req, res) => {
  try {
    const { entityType, id } = req.params;

    if (!['movies', 'cast', 'clips'].includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entity type. Must be movies, cast, or clips.' });
    }

    // Verify entity exists
    let entityExists = false;
    if (entityType === 'movies') {
      entityExists = await Movie.exists({ _id: id });
    } else if (entityType === 'cast') {
      entityExists = await Cast.exists({ _id: id });
    } else if (entityType === 'clips') {
      entityExists = await Clip.exists({ _id: id });
    }

    if (!entityExists) {
      return res.status(404).json({ message: `${entityType.slice(0, -1)} not found` });
    }

    // Check if user exists
    const userExists = await User.exists({ _id: req.user.id });
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Atomically push if not already in favourites to avoid duplicates
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user.id, [`favourites.${entityType}.entityId`]: { $ne: id } },
      { $push: { [`favourites.${entityType}`]: { entityId: id, level: 'Medium' } } },
      { new: true }
    );

    // If updatedUser is null, it means the item was already in favourites
    if (!updatedUser) {
      const user = await User.findById(req.user.id);
      const existingItem = user.favourites[entityType].find(item => item.entityId.toString() === id);
      return res.json({
        message: 'Already in favourites',
        isFavourite: true,
        level: existingItem ? existingItem.level : 'Medium'
      });
    }

    res.status(201).json({
      message: 'Added to favourites',
      isFavourite: true,
      level: 'Medium'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Remove favourite (atomic, race-condition safe)
exports.removeFavourite = async (req, res) => {
  try {
    const { entityType, id } = req.params;

    if (!['movies', 'cast', 'clips'].includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entity type. Must be movies, cast, or clips.' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user.id },
      { $pull: { [`favourites.${entityType}`]: { entityId: id } } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Removed from favourites',
      isFavourite: false
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Toggle favourite status (add if missing, remove if present) - Atomic implementation
exports.toggleFavourite = async (req, res) => {
  try {
    const { entityType, id } = req.params;

    if (!['movies', 'cast', 'clips'].includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entity type. Must be movies, cast, or clips.' });
    }

    // Verify entity exists
    let entityExists = false;
    if (entityType === 'movies') {
      entityExists = await Movie.exists({ _id: id });
    } else if (entityType === 'cast') {
      entityExists = await Cast.exists({ _id: id });
    } else if (entityType === 'clips') {
      entityExists = await Clip.exists({ _id: id });
    }

    if (!entityExists) {
      return res.status(404).json({ message: `${entityType.slice(0, -1)} not found` });
    }

    // Check if user exists
    const userExists = await User.exists({ _id: req.user.id });
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    // First try: Add atomically if not present
    const addedUser = await User.findOneAndUpdate(
      { _id: req.user.id, [`favourites.${entityType}.entityId`]: { $ne: id } },
      { $push: { [`favourites.${entityType}`]: { entityId: id, level: 'Medium' } } },
      { new: true }
    );

    if (addedUser) {
      return res.json({
        message: 'Added to favourites',
        isFavourite: true,
        level: 'Medium'
      });
    }

    // Second try: If addedUser is null, it was present. Pull it atomically.
    await User.findOneAndUpdate(
      { _id: req.user.id },
      { $pull: { [`favourites.${entityType}`]: { entityId: id } } }
    );

    res.json({
      message: 'Removed from favourites',
      isFavourite: false
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Update priority level of a favourite item
exports.updateLevel = async (req, res) => {
  try {
    const { entityType, id } = req.params;
    const { level } = req.body;

    if (!['movies', 'cast', 'clips'].includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entity type. Must be movies, cast, or clips.' });
    }

    if (!['High', 'Medium', 'Low'].includes(level)) {
      return res.status(400).json({ message: 'Invalid priority level. Must be High, Medium, or Low.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the favourite item
    const favItem = user.favourites[entityType].find(
      item => item.entityId.toString() === id
    );

    if (!favItem) {
      return res.status(404).json({ message: 'Item is not in favourites' });
    }

    favItem.level = level;
    await user.save();

    res.json({
      message: 'Priority level updated successfully',
      entityId: id,
      level: favItem.level
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
