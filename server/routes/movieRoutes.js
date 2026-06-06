const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movieController');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// @route   GET /api/movies
// @desc    Get saved movies catalogue (filtered & paginated)
// @access  Private (requires token for user tag/favorite resolution)
router.get('/', auth, movieController.getMovies);

// @route   GET /api/movies/search
// @desc    Search external movie APIs (TMDB/OMDb/Wikidata/Gemini fallbacks)
// @access  Private (Authorized users)
router.get('/search', auth, movieController.searchExternal);

// @route   GET /api/movies/external-details
// @desc    Get details and auto-save/cache from external API
// @access  Private (Authorized users)
router.get('/external-details', auth, movieController.importExternalDetails);

// @route   GET /api/movies/autocomplete
// @desc    Get autocomplete recommendations (local + external)
// @access  Private
router.get('/autocomplete', auth, movieController.autocomplete);

// @route   GET /api/movies/external-details-preview
// @desc    Preview external movie/show details without importing
// @access  Private
router.get('/external-details-preview', auth, movieController.previewExternalDetails);

// @route   GET /api/movies/image-proxy
// @desc    Proxy TMDB images to bypass client ISP blocks (Public)
router.get('/image-proxy', movieController.proxyImage);

// @route   GET /api/movies/popular
// @desc    Get live popular movies (cached weekly)
// @access  Private
router.get('/popular', auth, movieController.getPopularMovies);

// @route   GET /api/movies/:id
// @desc    Get saved movie details (with populated cast members)
// @access  Private
router.get('/:id', auth, movieController.getMovieById);

// @route   POST /api/movies
// @desc    Create/Import new movie
// @access  Private (Authorized users)
router.post('/', auth, movieController.createMovie);

// @route   PUT /api/movies/:id
// @desc    Update saved movie details
// @access  Private (Admin only)
router.put('/:id', auth, adminOnly, movieController.updateMovie);

// @route   DELETE /api/movies/:id
// @desc    Delete movie (cascades to comments/tags)
// @access  Private (Admin only)
router.delete('/:id', auth, adminOnly, movieController.deleteMovie);

// @route   POST /api/movies/:id/explanation
// @desc    Generate on-demand AI explanation using Gemini
// @access  Private
router.post('/:id/explanation', auth, movieController.generateExplanation);

module.exports = router;
