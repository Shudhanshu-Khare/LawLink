const User = require('../models/User.model');
const OTP = require('../models/OTP.model');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Admin email — auto-detected on Google Sign-In
const ADMIN_EMAIL = 'khareshudhanshu247@gmail.com';

// Cookie options for JWT
const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,         // JS cannot access this cookie
  secure: isProduction,   // HTTPS only in production
  sameSite: isProduction ? 'none' : 'lax',  // 'none' needed for cross-domain (Vercel→Render)
  maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days (matches JWT_EXPIRE)
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

// OTP generator (no in-memory store — uses MongoDB with TTL)
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

async function sendOTPEmail(email, otp) {
  // if email creds aren't set, just log (useful during dev)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[OTP] ${email} → ${otp}`);
    return true;
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
}


/**
 * POST /api/auth/register
 * Step 1 of email registration — validates input, sends OTP
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const method = existingUser.authMethod === 'google' ? 'Google sign-in' : 'email & password';
      return res.status(400).json({
        success: false,
        message: `Email already registered. Try signing in with ${method}.`
      });
    }

    const otp = generateOTP();

    // Upsert OTP in MongoDB (replaces any existing OTP for this email)
    await OTP.findOneAndUpdate(
      { email },
      { otp, userData: req.body, attempts: 0, createdAt: new Date() },
      { upsert: true, new: true }
    );

    await sendOTPEmail(email, otp);
    res.json({ success: true, message: 'OTP sent to your email', requiresOTP: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


/**
 * POST /api/auth/verify-otp
 * Step 2 — checks OTP, creates the account if valid
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const stored = await OTP.findOne({ email });
    if (!stored) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please register again.' });
    }

    // Brute force protection — max 5 attempts per OTP
    if (stored.attempts >= 5) {
      await OTP.deleteOne({ email });
      return res.status(429).json({ success: false, message: 'Too many failed attempts. Please register again.' });
    }

    if (stored.otp !== otp) {
      await OTP.updateOne({ email }, { $inc: { attempts: 1 } });
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    // OTP checks out — build user object
    const { name, email: userEmail, password, role } = stored.userData;
    const userData = { name, email: userEmail, password, role: role || 'client', authMethod: 'password' };

    // attach lawyer-specific fields if applicable
    if (role === 'lawyer') {
      const { barRegistrationNumber, yearsOfExperience, feePerHour, practiceAreas, bio } = stored.userData;
      if (barRegistrationNumber) userData.barRegistrationNumber = barRegistrationNumber;
      if (yearsOfExperience) userData.yearsOfExperience = Number(yearsOfExperience);
      if (feePerHour) userData.feePerHour = Number(feePerHour);
      if (practiceAreas) userData.practiceAreas = practiceAreas;
      if (bio) userData.bio = bio;
    }

    const user = await User.create(userData);
    await OTP.deleteOne({ email });

    sendTokenResponse(res, user, 201);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


/** POST /api/auth/resend-otp */
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const stored = await OTP.findOne({ email });
    if (!stored) {
      return res.status(400).json({ success: false, message: 'No pending registration. Please register again.' });
    }

    const otp = generateOTP();
    await OTP.updateOne({ email }, { otp, createdAt: new Date() });  // Reset TTL

    await sendOTPEmail(email, otp);
    res.json({ success: true, message: 'New OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


/** POST /api/auth/login — email + password only */
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
 * Handles both login and signup initiation via Google OAuth.
 * If user exists with google auth → logs them in.
 * If user exists with password auth → rejects (strict separation).
 * If new user → returns googleData for profile completion.
 */
exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const { sub: googleId, email, name } = ticket.getPayload();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.authMethod === 'password') {
        return res.status(400).json({
          success: false,
          message: 'This account uses password sign-in. Please use email & password.'
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

    // new user — frontend will show the role-selection form
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


/** POST /api/auth/forgot-password — sends a password reset email */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists — always show success
      return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    }

    if (user.authMethod === 'google') {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google sign-in. Please sign in with Google.'
      });
    }

    // Generate a secure token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save();

    // Build reset URL
    const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetURL = `${clientURL}/reset-password/${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"LawLink" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'LawLink — Password Reset',
      html: `
        <div style="font-family:Arial;max-width:400px;margin:0 auto;padding:20px">
          <h2 style="color:#0f172a">Password Reset</h2>
          <p>You requested a password reset. Click the link below (valid for 30 minutes):</p>
          <a href="${resetURL}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Reset Password</a>
          <p style="color:#64748b;font-size:13px">If you didn't request this, ignore this email.</p>
        </div>
      `
    });

    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


/** PUT /api/auth/reset-password/:token — resets the password */
exports.resetPassword = async (req, res) => {
  try {
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save(); // pre-save hook hashes the password

    sendTokenResponse(res, user);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
