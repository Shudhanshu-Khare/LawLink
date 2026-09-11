// backend/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const {
  login, googleAuth, googleRegister,
  getMe, updateProfile, logout
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const {
  loginRules, googleAuthRules, googleRegisterRules, updateProfileRules
} = require('../validators/auth.validator');

// Email+Password login (kept for test accounts: Rahul & Priya)
router.post('/login', loginRules, login);

// Google flow (primary authentication method)
router.post('/google', googleAuthRules, googleAuth);
router.post('/google-register', googleRegisterRules, googleRegister);

// Protected
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfileRules, updateProfile);
router.post('/logout', logout);

module.exports = router;
