const express = require('express');
const router = express.Router();
const tagsController = require('../controllers/tagsController');
const auth = require('../middleware/auth');

// @route   GET /api/tags
// @desc    Get user's personal tag library
// @access  Private
router.get('/', auth, tagsController.getTags);

// @route   POST /api/tags
// @desc    Add a tag to user's library
// @access  Private
router.post('/', auth, tagsController.createTag);

// @route   PUT /api/tags/:id
// @desc    Update tag details (name, color)
// @access  Private
router.put('/:id', auth, tagsController.updateTag);

// @route   DELETE /api/tags/:id
// @desc    Delete tag (cascades to assignments)
// @access  Private
router.delete('/:id', auth, tagsController.deleteTag);

// @route   POST /api/tags/:tagId/assign
// @desc    Assign tag to movie, cast, or clip
// @access  Private
router.post('/:tagId/assign', auth, tagsController.assignTag);

// @route   DELETE /api/tags/:tagId/assign/:entityId
// @desc    Remove tag from movie, cast, or clip
// @access  Private
router.delete('/:tagId/assign/:entityId', auth, tagsController.unassignTag);

module.exports = router;
