const User = require('../models/User');
const Movie = require('../models/Movie');
const Cast = require('../models/Cast');
const Clip = require('../models/Clip');
const Collection = require('../models/Collection');
const Comment = require('../models/Comment');

exports.getMetrics = async (req, res) => {
  try {
    const [
      totalUsers,
      totalMovies,
      totalCast,
      totalClips,
      totalCollections,
      totalComments
    ] = await Promise.all([
      User.countDocuments(),
      Movie.countDocuments(),
      Cast.countDocuments(),
      Clip.countDocuments(),
      Collection.countDocuments(),
      Comment.countDocuments()
    ]);

    res.json({
      totalUsers,
      totalMovies,
      totalCast,
      totalClips,
      totalCollections,
      totalComments
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch metrics', error: error.message });
  }
};
