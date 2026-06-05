const express = require('express');
const router = express.Router();
const collectionsController = require('../controllers/collectionsController');
const auth = require('../middleware/auth');

// @route   GET /api/collections
// @desc    Get all collections for current user
// @access  Private
router.get('/', auth, collectionsController.getCollections);

// @route   GET /api/collections/:id
// @desc    Get details of a single collection with populated items
// @access  Private
router.get('/:id', auth, collectionsController.getCollectionById);

// @route   POST /api/collections
// @desc    Create a new collection
// @access  Private
router.post('/', auth, collectionsController.createCollection);

// @route   PUT /api/collections/:id
// @desc    Update collection details (name, description, coverImage)
// @access  Private
router.put('/:id', auth, collectionsController.updateCollection);

// @route   DELETE /api/collections/:id
// @desc    Delete a collection
// @access  Private
router.delete('/:id', auth, collectionsController.deleteCollection);

// @route   POST /api/collections/:id/items
// @desc    Add movie, cast, or clip to collection
// @access  Private
router.post('/:id/items', auth, collectionsController.addItem);

// @route   DELETE /api/collections/:id/items/:entityId
// @desc    Remove an item from collection
// @access  Private
router.delete('/:id/items/:entityId', auth, collectionsController.removeItem);

module.exports = router;
