// backend/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const {
  register, verifyOTP, resendOTP,
  login, googleAuth, googleRegister,
  getMe, updateProfile
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

// Email + Password flow
router.post('/register', register);        // Step 1: Send OTP
router.post('/verify-otp', verifyOTP);     // Step 2: Verify OTP, create account
router.post('/resend-otp', resendOTP);     // Resend OTP
router.post('/login', login);

// Google flow
router.post('/google', googleAuth);           // Google sign-in / check
router.post('/google-register', googleRegister); // Complete Google registration

// Protected
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
