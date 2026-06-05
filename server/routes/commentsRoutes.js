const express = require('express');
const router = express.Router();
const commentsController = require('../controllers/commentsController');
const auth = require('../middleware/auth');

// @route   GET /api/comments
// @desc    Get user's comments on a specific entity
// @access  Private
router.get('/', auth, commentsController.getComments);

// @route   POST /api/comments
// @desc    Add a comment/note to an entity
// @access  Private
router.post('/', auth, commentsController.addComment);

// @route   PUT /api/comments/:id
// @desc    Update a comment
// @access  Private
router.put('/:id', auth, commentsController.updateComment);

// @route   DELETE /api/comments/:id
// @desc    Delete a comment
// @access  Private
router.delete('/:id', auth, commentsController.deleteComment);

module.exports = router;
