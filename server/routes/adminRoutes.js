const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// Dashboard Metrics
router.get('/metrics', auth, adminOnly, adminController.getMetrics);

module.exports = router;
