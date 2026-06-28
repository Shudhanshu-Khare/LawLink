const User = require('../models/User.model');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const otpStore = new Map();

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

async function sendOTPEmail(email, otp) {
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


exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
    }

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

    const otp = generateOTP();
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      userData: req.body
    });

    await sendOTPEmail(email, otp);
    res.json({ success: true, message: 'OTP sent to your email', requiresOTP: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


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

    const { name, email: userEmail, password, role } = stored.userData;
    const userData = { name, email: userEmail, password, role: role || 'client', authMethod: 'password' };

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

      const token = existingUser.getSignedJwtToken();
      const userResponse = existingUser.toObject();
      return res.json({ success: true, token, user: userResponse });
    }

    res.json({
      success: true,
      newUser: true,
      googleData: { googleId, email, name }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Google authentication failed' });
  }
};


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
    const token = user.getSignedJwtToken();
    const userResponse = user.toObject();

    res.status(201).json({ success: true, token, user: userResponse });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


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
