// backend/controllers/auth.controller.js
const User = require('../models/User.model');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// In-memory OTP store: email → { otp, expiresAt, userData }
const otpStore = new Map();

// ── Helper: Generate 6-digit OTP ──
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ── Helper: Send OTP email ──
const sendOTPEmail = async (email, otp) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[OTP LOG] To: ${email} | OTP: ${otp}`);
    return true; // Dev fallback — log to console
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  await transporter.sendMail({
    from: `"LawLink" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'LawLink — Email Verification OTP',
    html: `
      <div style="font-family:Arial;max-width:400px;margin:0 auto;padding:20px">
        <h2 style="color:#0f172a">LawLink Verification</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing:8px;color:#2563eb;text-align:center">${otp}</h1>
        <p style="color:#64748b;font-size:13px">This code expires in 5 minutes. Do not share it.</p>
      </div>
    `
  });
  return true;
};

// @desc    Register — Step 1: Send OTP
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const method = existingUser.authMethod === 'google' ? 'Google sign-in' : 'email & password';
      return res.status(400).json({
        success: false,
        message: `Email already registered. Try signing in with ${method}.`
      });
    }

    if (role && !['client', 'lawyer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be client or lawyer' });
    }

    // Generate OTP and store with user data
    const otp = generateOTP();
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      userData: req.body
    });

    // Send OTP
    await sendOTPEmail(email, otp);

    res.json({ success: true, message: 'OTP sent to your email', requiresOTP: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Register — Step 2: Verify OTP and create account
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const stored = otpStore.get(email);
    if (!stored) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please register again.' });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ success: false, message: 'OTP expired. Please register again.' });
    }

    if (stored.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    // OTP verified — create user
    const { name, email: userEmail, password, role } = stored.userData;
    const userData = { name, email: userEmail, password, role: role || 'client', authMethod: 'password' };

    // Add lawyer fields
    if (role === 'lawyer') {
      const { barRegistrationNumber, yearsOfExperience, feePerHour, practiceAreas, bio } = stored.userData;
      if (barRegistrationNumber) userData.barRegistrationNumber = barRegistrationNumber;
      if (yearsOfExperience) userData.yearsOfExperience = Number(yearsOfExperience);
      if (feePerHour) userData.feePerHour = Number(feePerHour);
      if (practiceAreas) userData.practiceAreas = practiceAreas;
      if (bio) userData.bio = bio;
    }

    const user = await User.create(userData);
    otpStore.delete(email);

    const token = user.getSignedJwtToken();
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({ success: true, token, user: userResponse });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const stored = otpStore.get(email);
    if (!stored) {
      return res.status(400).json({ success: false, message: 'No pending registration. Please register again.' });
    }

    const otp = generateOTP();
    stored.otp = otp;
    stored.expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(email, stored);

    await sendOTPEmail(email, otp);
    res.json({ success: true, message: 'New OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Login with email + password
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check auth method
    if (user.authMethod === 'google') {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google sign-in. Please sign in with Google.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = user.getSignedJwtToken();
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ success: true, token, user: userResponse });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Google sign-in / sign-up
// @route   POST /api/auth/google
// @access  Public
exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const { sub: googleId, email, name } = ticket.getPayload();

    // Check if user exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // User exists — check auth method
      if (existingUser.authMethod === 'password') {
        return res.status(400).json({
          success: false,
          message: 'This account uses password sign-in. Please use email & password.'
        });
      }

      // Google user — log them in
      const token = existingUser.getSignedJwtToken();
      const userResponse = existingUser.toObject();
      return res.json({ success: true, token, user: userResponse });
    }

    // New user — needs to complete profile (select role, etc.)
    res.json({
      success: true,
      newUser: true,
      googleData: { googleId, email, name }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Google authentication failed' });
  }
};

// @desc    Complete Google registration (new user picks role + details)
// @route   POST /api/auth/google-register
// @access  Public
exports.googleRegister = async (req, res) => {
  try {
    const { googleId, email, name, role, barRegistrationNumber, yearsOfExperience, feePerHour, practiceAreas, bio } = req.body;

    // Double-check email not taken
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const userData = {
      name, email, googleId,
      role: role || 'client',
      authMethod: 'google'
    };

    if (role === 'lawyer') {
      if (barRegistrationNumber) userData.barRegistrationNumber = barRegistrationNumber;
      if (yearsOfExperience) userData.yearsOfExperience = Number(yearsOfExperience);
      if (feePerHour) userData.feePerHour = Number(feePerHour);
      if (practiceAreas) userData.practiceAreas = practiceAreas;
      if (bio) userData.bio = bio;
    }

    const user = await User.create(userData);
    const token = user.getSignedJwtToken();
    const userResponse = user.toObject();

    res.status(201).json({ success: true, token, user: userResponse });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = ['bio'];
    if (req.user.role === 'lawyer') {
      allowedFields.push('barRegistrationNumber', 'yearsOfExperience', 'feePerHour', 'practiceAreas', 'courtAdmissions', 'languages');
    }

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
