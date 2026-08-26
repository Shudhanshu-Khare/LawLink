// backend/routes/user.routes.js
const express = require('express');
const router = express.Router();
const {
  getProfile, updateProfile, getLawyers, getClients, getUserById
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');

// Public
router.get('/lawyers', getLawyers);
router.get('/public/:id', getUserById);

// Protected
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

// Lawyer only
router.get('/clients', protect, authorize('lawyer', 'admin'), getClients);

module.exports = router;
