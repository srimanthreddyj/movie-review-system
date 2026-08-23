const express = require('express');
const router = express.Router();
const clipsController = require('../controllers/clipsController');
const auth = require('../middleware/auth');

// @route   GET /api/clips
// @desc    Get all clips, optionally filtered by movieId, castId, clipType, or tagId
// @access  Private
router.get('/', auth, clipsController.getClips);

// @route   POST /api/clips
// @desc    Add a new clip
// @access  Private
router.post('/', auth, clipsController.addClip);

// @route   GET /api/clips/upload-url
// @desc    Get a presigned S3 URL for Backblaze B2 upload
// @access  Private
router.get('/upload-url', auth, clipsController.getUploadUrl);

// @route   PUT /api/clips/:id
// @desc    Update an existing clip (owner or admin only)
// @access  Private
router.put('/:id', auth, clipsController.updateClip);

// @route   DELETE /api/clips/:id
// @desc    Delete a clip (owner or admin only)
// @access  Private
router.delete('/:id', auth, clipsController.deleteClip);

module.exports = router;
