// backend/controllers/auth.controller.js
const User = require('../models/User.model');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'postmessage' // redirect_uri for auth-code flow via popup
);

// Admin email — auto-detected on Google Sign-In
const ADMIN_EMAIL = 'khareshudhanshu247@gmail.com';

// Cookie options for JWT
const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/'
};

// Helper: sets JWT as httpOnly cookie + returns user data
const sendTokenResponse = (res, user, statusCode = 200) => {
  const token = user.getSignedJwtToken();
  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(statusCode)
    .cookie('token', token, COOKIE_OPTIONS)
    .json({ success: true, token, user: userResponse });
};


/** POST /api/auth/login — email + password (test accounts only: Rahul & Priya) */
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

    // don't let google-registered users login with password
    if (user.authMethod === 'google') {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google sign-in. Please sign in with Google.'
      });
    }

    // Check if account is blocked by admin
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Account suspended by admin. Contact support for assistance.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    sendTokenResponse(res, user);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


/**
 * POST /api/auth/google
 * Accepts { credential, mode } where mode is 'login' or 'register'.
 * Login: only allows existing users. Register: only allows new users.
 */
exports.googleAuth = async (req, res) => {
  try {
    const { credential, code, mode } = req.body;

    let googleId, email, name;

    if (credential) {
      // Flow 1: ID token from <GoogleLogin> component (Register page)
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      ({ sub: googleId, email, name } = ticket.getPayload());
    } else if (access_token) {
      // Flow 2: Access token from useGoogleLogin hook (Login page - works without secret)
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      if (!resp.ok) {
        return res.status(401).json({ success: false, message: 'Invalid Google access token' });
      }
      const profile = await resp.json();
      googleId = profile.sub;
      email = profile.email;
      name = profile.name;
    } else if (code) {
      // Flow 3: Auth code from useGoogleLogin hook
      const { tokens } = await googleClient.getToken(code);
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      ({ sub: googleId, email, name } = ticket.getPayload());
    } else {
      return res.status(400).json({ success: false, message: 'Missing credential, access_token, or code' });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.authMethod === 'password') {
        return res.status(400).json({
          success: false,
          message: 'This account uses password sign-in. Please use email & password.'
        });
      }

      // Register mode — user already exists, reject
      if (mode === 'register') {
        return res.status(400).json({
          success: false,
          message: 'This Gmail is already registered. Please sign in instead.'
        });
      }

      // Check if account is blocked by admin
      if (existingUser.isBlocked) {
        return res.status(403).json({ success: false, message: 'Account suspended by admin. Contact support for assistance.' });
      }

      // Auto-upgrade to admin if this is the admin email
      if (email === ADMIN_EMAIL && existingUser.role !== 'admin') {
        existingUser.role = 'admin';
        existingUser.isVerified = true;
        await existingUser.save();
      }

      // returning google user — log them in
      return sendTokenResponse(res, existingUser);
    }

    // Auto-detect admin by email
    if (email === ADMIN_EMAIL) {
      const adminUser = await User.create({
        name, email, googleId,
        role: 'admin',
        authMethod: 'google',
        isVerified: true
      });
      return sendTokenResponse(res, adminUser);
    }

    // Login mode — user doesn't exist, reject
    if (mode === 'login') {
      return res.status(400).json({
        success: false,
        message: 'This Gmail is not registered. Please sign up first.'
      });
    }

    // new user (register mode) — frontend will show the role-selection form
    res.json({
      success: true,
      newUser: true,
      googleData: { googleId, email, name }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Google authentication failed' });
  }
};


/**
 * POST /api/auth/google-register
 * Called after a new Google user picks their role + fills lawyer details.
 */
exports.googleRegister = async (req, res) => {
  try {
    const { googleId, email, name, role, barRegistrationNumber, yearsOfExperience, feePerHour, practiceAreas, bio } = req.body;

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
    sendTokenResponse(res, user, 201);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


/** GET /api/auth/me — returns the logged-in user's profile */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    // Prevent browsers from caching this response (fixes ghost-login after logout)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


/**
 * PUT /api/auth/profile
 * Whitelist approach — only specific fields can be updated.
 * Lawyers get access to professional fields, everyone can edit bio.
 */
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


/** POST /api/auth/logout — clears the httpOnly JWT cookie */
exports.logout = (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    expires: new Date(0),
    path: '/'
  });
  res.json({ success: true, message: 'Logged out successfully' });
};
