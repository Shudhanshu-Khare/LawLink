const express = require('express');
const router = express.Router();
const {
  register, verifyOTP, resendOTP,
  login, googleAuth, googleRegister,
  getMe, updateProfile
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);

router.post('/google', googleAuth);
router.post('/google-register', googleRegister);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
