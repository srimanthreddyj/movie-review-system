const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// Settings are admin-only
router.get('/', auth, adminOnly, settingsController.getSettings);
router.put('/', auth, adminOnly, settingsController.updateSettings);

// Maintenance scripts
router.post('/cleanup/cast', auth, adminOnly, settingsController.cleanupDuplicateCast);

module.exports = router;
