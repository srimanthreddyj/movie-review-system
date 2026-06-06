const express = require('express');
const router = express.Router();
const castController = require('../controllers/castController');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// @route   GET /api/cast
// @desc    Get cast members list (search & tag filter)
// @access  Private
router.get('/', auth, castController.getCasts);

// @route   GET /api/cast/search-external
// @desc    Search external cast members on TMDB
// @access  Private
router.get('/search-external', auth, castController.searchExternalCast);

// @route   GET /api/cast/external-details-preview
// @desc    Preview external cast member details
// @access  Private
router.get('/external-details-preview', auth, castController.previewExternalCast);

// @route   POST /api/cast/import-external
// @desc    Import cast member from TMDB
// @access  Private
router.post('/import-external', auth, castController.importExternalCast);

// @route   GET /api/cast/popular
// @desc    Get live popular cast members (cached weekly)
// @access  Private
router.get('/popular', auth, castController.getPopularCast);

// @route   GET /api/cast/:id
// @desc    Get detailed cast profile (with dynamic filmography)
// @access  Private
router.get('/:id', auth, castController.getCastById);

// @route   POST /api/cast
// @desc    Create custom cast member
// @access  Private (Admin only)
router.post('/', auth, adminOnly, castController.createCast);

// @route   PUT /api/cast/:id
// @desc    Update cast member details
// @access  Private (Admin only)
router.put('/:id', auth, adminOnly, castController.updateCast);

module.exports = router;
