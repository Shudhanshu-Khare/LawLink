// backend/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const {
  register, verifyOTP, resendOTP,
  login, googleAuth, googleRegister,
  getMe, updateProfile, logout,
  forgotPassword, resetPassword
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const {
  registerRules, loginRules, verifyOTPRules,
  googleAuthRules, googleRegisterRules, updateProfileRules,
  forgotPasswordRules, resetPasswordRules
} = require('../validators/auth.validator');

// Email + Password flow
router.post('/register', registerRules, register);        // Step 1: Send OTP
router.post('/verify-otp', verifyOTPRules, verifyOTP);    // Step 2: Verify OTP, create account
router.post('/resend-otp', resendOTP);                     // Resend OTP
router.post('/login', loginRules, login);

// Password reset flow
router.post('/forgot-password', forgotPasswordRules, forgotPassword);
router.put('/reset-password/:token', resetPasswordRules, resetPassword);

// Google flow
router.post('/google', googleAuthRules, googleAuth);
router.post('/google-register', googleRegisterRules, googleRegister);

// Protected
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfileRules, updateProfile);
router.post('/logout', logout);  // Clears httpOnly JWT cookie

module.exports = router;
