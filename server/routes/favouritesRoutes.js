const express = require('express');
const router = express.Router();
const favouritesController = require('../controllers/favouritesController');
const auth = require('../middleware/auth');

// @route   GET /api/favourites
// @desc    Get all populated favourites (movies, cast, clips) for current user
// @access  Private
router.get('/', auth, favouritesController.getFavourites);

// @route   POST /api/favourites/:entityType/:id
// @desc    Add to favourites (movies, cast, or clips)
// @access  Private
router.post('/:entityType/:id', auth, favouritesController.addFavourite);

// @route   DELETE /api/favourites/:entityType/:id
// @desc    Remove from favourites (movies, cast, or clips)
// @access  Private
router.delete('/:entityType/:id', auth, favouritesController.removeFavourite);

// @route   PATCH /api/favourites/:entityType/:id/level
// @desc    Update priority level (High, Medium, Low) of a favourite item
// @access  Private
router.patch('/:entityType/:id/level', auth, favouritesController.updateLevel);

module.exports = router;
