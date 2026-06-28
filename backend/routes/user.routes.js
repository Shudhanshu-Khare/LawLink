// backend/routes/user.routes.js
const express = require('express');
const router = express.Router();
const {
  getProfile, updateProfile, uploadPhoto, getLawyers, getClients
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadProfilePhoto } = require('../middleware/upload');

// Public
router.get('/lawyers', getLawyers);

// Protected
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/profile/photo', protect, uploadProfilePhoto, uploadPhoto);

// Lawyer only
router.get('/clients', protect, authorize('lawyer', 'admin'), getClients);

module.exports = router;
