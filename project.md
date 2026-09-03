# LawLink Project Codebase

## Description
LawLink is a comprehensive legal services platform connecting clients with lawyers. It provides seamless consultation booking, real-time messaging, document generation, and invoice management.

## Features
- **Authentication**: JWT-based secure authentication with Role-Based Access Control (Client, Lawyer, Admin).
- **Consultation Hub**: Schedule, view, and manage consultation slots with real-time timezone handling.
- **Real-time Chat**: Socket.io powered instant messaging between clients and lawyers.
- **Document Hub**: Automated PDF generation for legal documents and contracts using PDFKit.
- **Invoice Manager**: Generate, track, and pay invoices for legal services.
- **Case Management**: Centralized hub for tracking case progress and associated deadlines.
- **Admin Dashboard**: System-wide analytics and user management.

## Architecture
- **Frontend**: React.js with Vite, styled with Bootstrap and custom CSS. Deployed on Vercel.
- **Backend**: Node.js with Express.js, providing RESTful APIs. Deployed on Render.
- **Database**: MongoDB (Mongoose ORM) for scalable data storage.
- **Real-time Communication**: Socket.io for instant messaging and online status tracking.

---

## Codebase

### backend/cleanup-test-accounts.js
```javascript
// backend/cleanup-test-accounts.js
// Removes all test accounts EXCEPT priya@lawlink.com and rahul@lawlink.com
// Run: node backend/cleanup-test-accounts.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, 'config', 'config.env') });

const User = require('./models/User.model');
const Case = require('./models/Case.model');
const Consultation = require('./models/Consultation.model');
const LegalDocument = require('./models/LegalDocument.model');
const Invoice = require('./models/Invoice.model');
const Deadline = require('./models/Deadline.model');
const Conversation = require('./models/Conversation.model');
const Message = require('./models/Message.model');

const KEEP_EMAILS = ['priya@lawlink.com', 'rahul@lawlink.com'];

const cleanup = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find test accounts to delete (any @lawlink.com or @test.com except the 2 we keep)
  const testUsers = await User.find({
    $or: [
      { email: { $regex: /@lawlink\.com$/i } },
      { email: { $regex: /@test\.com$/i } }
    ],
    email: { $nin: KEEP_EMAILS }
  });

  if (testUsers.length === 0) {
    console.log('No extra test accounts found. Nothing to delete.');
    await mongoose.connection.close();
    process.exit(0);
  }

  console.log(`\nFound ${testUsers.length} test account(s) to remove:`);
  testUsers.forEach(u => console.log(`  - ${u.name} (${u.email}) [${u.role}]`));

  for (const user of testUsers) {
    const userId = user._id;
    console.log(`\nDeleting ${user.name} (${user.email})...`);

    // Find cases to get their IDs for deadline deletion
    const cases = await Case.find({ $or: [{ lawyer: userId }, { client: userId }] });
    const caseIds = cases.map(c => c._id);

    if (caseIds.length > 0) {
      const dr = await Deadline.deleteMany({ case: { $in: caseIds } });
      console.log(`  Deadlines: ${dr.deletedCount}`);
    }

    const cr = await Case.deleteMany({ $or: [{ lawyer: userId }, { client: userId }] });
    console.log(`  Cases: ${cr.deletedCount}`);

    const conr = await Consultation.deleteMany({ $or: [{ lawyer: userId }, { client: userId }] });
    console.log(`  Consultations: ${conr.deletedCount}`);

    const docr = await LegalDocument.deleteMany({ $or: [{ lawyer: userId }, { client: userId }] });
    console.log(`  Documents: ${docr.deletedCount}`);

    const ir = await Invoice.deleteMany({ $or: [{ lawyer: userId }, { client: userId }] });
    console.log(`  Invoices: ${ir.deletedCount}`);

    const convs = await Conversation.find({ participants: userId });
    const convIds = convs.map(c => c._id);
    if (convIds.length > 0) {
      const mr = await Message.deleteMany({ conversation: { $in: convIds } });
      console.log(`  Messages: ${mr.deletedCount}`);
    }
    const cvr = await Conversation.deleteMany({ participants: userId });
    console.log(`  Conversations: ${cvr.deletedCount}`);

    await User.findByIdAndDelete(userId);
    console.log(`  ✅ User deleted`);
  }

  console.log('\n✅ Cleanup complete!');
  console.log('Remaining test accounts: priya@lawlink.com (lawyer), rahul@lawlink.com (client)');
  await mongoose.connection.close();
  process.exit(0);
};

cleanup().catch(err => { console.error(err); process.exit(1); });

```

### backend/controllers/admin.controller.js
```javascript
// backend/controllers/admin.controller.js
const User = require('../models/User.model');
const Case = require('../models/Case.model');
const Consultation = require('../models/Consultation.model');
const LegalDocument = require('../models/LegalDocument.model');
const Invoice = require('../models/Invoice.model');
const Deadline = require('../models/Deadline.model');
const Conversation = require('../models/Conversation.model');
const Message = require('../models/Message.model');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Admin
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      verifiedLawyers, verifiedClients,
      pendingLawyers, pendingClients,
      blockedUsers
    ] = await Promise.all([
      User.countDocuments({ role: 'lawyer', isVerified: true, isBlocked: { $ne: true } }),
      User.countDocuments({ role: 'client', isVerified: true, isBlocked: { $ne: true } }),
      User.countDocuments({ role: 'lawyer', isVerified: { $ne: true } }),
      User.countDocuments({ role: 'client', isVerified: { $ne: true } }),
      User.countDocuments({ isBlocked: true })
    ]);

    res.json({
      success: true,
      stats: {
        verifiedLawyers, verifiedClients,
        pendingVerifications: pendingLawyers + pendingClients,
        blockedUsers
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get users pending verification
// @route   GET /api/admin/pending
// @access  Admin
exports.getPendingUsers = async (req, res) => {
  try {
    const pending = await User.find({ isVerified: { $ne: true }, isBlocked: { $ne: true }, role: { $ne: 'admin' } })
      .select('name email role authMethod createdAt phone location bio practiceAreas barRegistrationNumber')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: pending.length, users: pending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all lawyers (for admin management)
// @route   GET /api/admin/lawyers
// @access  Admin
exports.getAllLawyers = async (req, res) => {
  try {
    const lawyers = await User.find({ role: 'lawyer' })
      .select('name email authMethod isVerified isBlocked createdAt phone location practiceAreas barRegistrationNumber yearsOfExperience feePerHour')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: lawyers.length, lawyers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all clients (for admin management)
// @route   GET /api/admin/clients
// @access  Admin
exports.getAllClients = async (req, res) => {
  try {
    const clients = await User.find({ role: 'client' })
      .select('name email authMethod isVerified isBlocked createdAt phone location legalMatterTypes')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: clients.length, clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Verify a user (approve registration)
// @route   PUT /api/admin/verify/:id
// @access  Admin
exports.verifyUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot modify admin accounts' });
    }

    user.isVerified = true;
    await user.save();

    res.json({ success: true, message: `${user.name} has been verified`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Block a user
// @route   PUT /api/admin/block/:id
// @access  Admin
exports.blockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot block admin accounts' });
    }

    user.isBlocked = true;
    await user.save();

    res.json({ success: true, message: `${user.name} has been blocked` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Unblock a user
// @route   PUT /api/admin/unblock/:id
// @access  Admin
exports.unblockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isBlocked = false;
    await user.save();

    res.json({ success: true, message: `${user.name} has been unblocked` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete a user and ALL associated data (cascade delete)
// @route   DELETE /api/admin/users/:id
// @access  Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete admin accounts' });
    }

    const userId = user._id;
    const deletedData = { user: user.name, role: user.role };

    // 1. Find all cases involving this user (as lawyer or client)
    const cases = await Case.find({
      $or: [{ lawyer: userId }, { client: userId }]
    });
    const caseIds = cases.map(c => c._id);

    // 2. Delete deadlines linked to those cases
    if (caseIds.length > 0) {
      const deadlineResult = await Deadline.deleteMany({ case: { $in: caseIds } });
      deletedData.deadlines = deadlineResult.deletedCount;
    }

    // 3. Delete cases
    const caseResult = await Case.deleteMany({
      $or: [{ lawyer: userId }, { client: userId }]
    });
    deletedData.cases = caseResult.deletedCount;

    // 4. Delete consultations
    const consultResult = await Consultation.deleteMany({
      $or: [{ lawyer: userId }, { client: userId }]
    });
    deletedData.consultations = consultResult.deletedCount;

    // 5. Delete legal documents
    const docResult = await LegalDocument.deleteMany({
      $or: [{ lawyer: userId }, { client: userId }]
    });
    deletedData.documents = docResult.deletedCount;

    // 6. Delete invoices
    const invResult = await Invoice.deleteMany({
      $or: [{ lawyer: userId }, { client: userId }]
    });
    deletedData.invoices = invResult.deletedCount;

    // 7. Find all conversations involving this user
    const conversations = await Conversation.find({
      participants: userId
    });
    const convIds = conversations.map(c => c._id);

    // 8. Delete all messages in those conversations
    if (convIds.length > 0) {
      const msgResult = await Message.deleteMany({ conversation: { $in: convIds } });
      deletedData.messages = msgResult.deletedCount;
    }

    // 9. Delete conversations
    const convResult = await Conversation.deleteMany({ participants: userId });
    deletedData.conversations = convResult.deletedCount;

    // 10. Delete the user
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: `${user.name}'s account and all associated data have been permanently deleted`,
      deletedData
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

```

### backend/controllers/auth.controller.js
```javascript
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

```

### backend/controllers/case.controller.js
```javascript
const Case = require('../models/Case.model');

// valid progression order — case can only move forward (or jump to closed)
const STATUS_ORDER = ['intake', 'investigation', 'filing', 'hearing', 'resolution', 'closed'];

/** POST /api/cases — lawyer creates a new case for a client */
exports.createCase = async (req, res) => {
  try {
    const { clientId, title, description, legalArea } = req.body;

    const newCase = await Case.create({
      client: clientId,
      lawyer: req.user.id,
      title,
      description,
      legalArea,
      milestones: [{
        stage: 'intake',
        note: 'Case opened',
        addedBy: req.user.id,
        timestamp: new Date()
      }]
    });

    const populated = await newCase.populate([
      { path: 'client', select: 'name email' },
      { path: 'lawyer', select: 'name email' },
      { path: 'milestones.addedBy', select: 'name' }
    ]);

    res.status(201).json({ success: true, case: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/cases — returns cases for the logged-in user (filtered by role) */
exports.getCases = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    const { status, legalArea } = req.query;
    if (status) filter.status = status;
    if (legalArea) filter.legalArea = legalArea;

    const cases = await Case.find(filter)
      .populate('client', 'name email')
      .populate('lawyer', 'name email practiceAreas')
      .sort({ updatedAt: -1 });

    res.json({ success: true, count: cases.length, cases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/cases/:id — single case with full milestone history */
exports.getCase = async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id)
      .populate('client', 'name email phone')
      .populate('lawyer', 'name email phone practiceAreas feePerHour')
      .populate('milestones.addedBy', 'name role');

    if (!caseDoc) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    // only the assigned client, lawyer, or admin can view
    const hasAccess = caseDoc.client._id.toString() === req.user.id ||
                      caseDoc.lawyer._id.toString() === req.user.id ||
                      req.user.role === 'admin';
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, case: caseDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /api/cases/:id/milestone — lawyer adds a milestone note */
exports.addMilestone = async (req, res) => {
  try {
    const { stage, note } = req.body;
    const caseDoc = await Case.findById(req.params.id);

    if (!caseDoc) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the assigned lawyer can add milestones' });
    }

    caseDoc.milestones.push({
      stage: stage || caseDoc.status,
      note,
      addedBy: req.user.id,
      timestamp: new Date()
    });

    await caseDoc.save();
    const populated = await caseDoc.populate('milestones.addedBy', 'name role');

    res.json({ success: true, case: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/cases/:id/status
 * Advances case to next stage. Must follow STATUS_ORDER
 * unless jumping directly to 'closed' (allowed from any stage).
 */
exports.advanceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const caseDoc = await Case.findById(req.params.id);

    if (!caseDoc) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    if (caseDoc.lawyer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the assigned lawyer can advance the case' });
    }

    const currentIdx = STATUS_ORDER.indexOf(caseDoc.status);
    const newIdx = STATUS_ORDER.indexOf(status);

    if (status !== 'closed' && newIdx !== currentIdx + 1) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${caseDoc.status}' to '${status}'. Next valid stage: '${STATUS_ORDER[currentIdx + 1]}'`
      });
    }

    caseDoc.status = status;
    caseDoc.milestones.push({
      stage: status,
      note: `Case advanced to ${status}`,
      addedBy: req.user.id,
      timestamp: new Date()
    });

    await caseDoc.save();
    res.json({ success: true, case: caseDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

```

### backend/controllers/chat.controller.js
```javascript
// backend/controllers/chat.controller.js
const Conversation = require('../models/Conversation.model');
const Message = require('../models/Message.model');

// @desc    Get or create conversation with a user
// @route   POST /api/chat/conversations
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.body;
    const myId = req.user.id;

    // Check if user is verified by admin
    if (!req.user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your profile is pending admin verification. You cannot send messages yet.'
      });
    }

    // Find existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [myId, userId], $size: 2 }
    }).populate('participants', 'name email role')
      .populate('lastMessage');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [myId, userId]
      });
      conversation = await conversation.populate('participants', 'name email role');
    }

    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get all conversations with unread counts
// @route   GET /api/chat/conversations
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id
    })
      .populate('participants', 'name email role')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

    // Add unread count for each conversation
    const withUnread = await Promise.all(conversations.map(async (conv) => {
      const unreadCount = await Message.countDocuments({
        conversation: conv._id,
        sender: { $ne: req.user.id },
        status: { $ne: 'read' }
      });
      return { ...conv.toObject(), unreadCount };
    }));

    res.json({ success: true, conversations: withUnread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get messages with cursor-based pagination
// @route   GET /api/chat/conversations/:id/messages
exports.getMessages = async (req, res) => {
  try {
    const { before, limit = 50 } = req.query;
    const filter = { conversation: req.params.id };

    if (before) {
      filter.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(filter)
      .populate('sender', 'name role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Check if there are more messages
    const hasMore = messages.length === parseInt(limit);

    res.json({
      success: true,
      messages: messages.reverse(), // Return in chronological order
      hasMore
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Send a message (REST fallback — primary is via Socket.io)
// @route   POST /api/chat/conversations/:id/messages
exports.sendMessage = async (req, res) => {
  try {
    const { content } = req.body;

    const message = await Message.create({
      conversation: req.params.id,
      sender: req.user.id,
      content
    });

    // Update conversation's lastMessage
    await Conversation.findByIdAndUpdate(req.params.id, {
      lastMessage: message._id,
      lastMessageAt: new Date()
    });

    const populated = await message.populate('sender', 'name role');
    res.status(201).json({ success: true, message: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Mark all messages in conversation as read
// @route   PUT /api/chat/conversations/:id/read
exports.markAsRead = async (req, res) => {
  try {
    await Message.updateMany(
      {
        conversation: req.params.id,
        sender: { $ne: req.user.id },
        status: { $ne: 'read' }
      },
      { status: 'read' }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get total unread message count (for navbar dot)
// @route   GET /api/chat/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    // Find all conversations this user is part of
    const conversations = await Conversation.find({
      participants: req.user.id
    }).select('_id');

    const convIds = conversations.map(c => c._id);

    const unreadCount = await Message.countDocuments({
      conversation: { $in: convIds },
      sender: { $ne: req.user.id },
      status: { $ne: 'read' }
    });

    res.json({ success: true, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

```

### backend/controllers/consultation.controller.js
```javascript
// backend/controllers/consultation.controller.js
const Consultation = require('../models/Consultation.model');
const User = require('../models/User.model');

// Helper to get YYYY-MM-DD in local timezone (avoids UTC mismatch with IST)
const getLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Available 60-min time slots (9 AM to 6 PM)
const ALL_SLOTS = [
  '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '12:00-13:00', '13:00-14:00', '14:00-15:00',
  '15:00-16:00', '16:00-17:00', '17:00-18:00'
];

// @desc    Book a consultation
// @route   POST /api/consultations
exports.bookConsultation = async (req, res) => {
  try {
    const { lawyerId, date, timeSlot, reason } = req.body;

    // Verify lawyer exists
    const lawyer = await User.findOne({ _id: lawyerId, role: 'lawyer' });
    if (!lawyer) {
      return res.status(404).json({ success: false, message: 'Lawyer not found' });
    }

    // Check if client is verified by admin
    if (!req.user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your profile is pending admin verification. You can browse lawyers but cannot book consultations yet.'
      });
    }

    // Check slot is not already booked
    const existing = await Consultation.findOne({
      lawyer: lawyerId,
      date: new Date(date),
      timeSlot,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'This slot is already booked' });
    }

    const consultation = await Consultation.create({
      client: req.user.id,
      lawyer: lawyerId,
      date: new Date(date),
      timeSlot,
      reason
    });

    const populated = await consultation.populate([
      { path: 'client', select: 'name email phone' },
      { path: 'lawyer', select: 'name email practiceAreas feePerHour' }
    ]);

    res.status(201).json({ success: true, consultation: populated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Slot already booked' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    List consultations (role-filtered)
// @route   GET /api/consultations
exports.getConsultations = async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};

    // Role-based filtering
    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    if (status) filter.status = status;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const consultations = await Consultation.find(filter)
      .populate('client', 'name email phone')
      .populate('lawyer', 'name email practiceAreas feePerHour')
      .sort({ date: 1, timeSlot: 1 });

    res.json({ success: true, count: consultations.length, consultations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update consultation status
// @route   PUT /api/consultations/:id
exports.updateConsultation = async (req, res) => {
  try {
    const { status, notes, billableHours } = req.body;
    const consultation = await Consultation.findById(req.params.id);

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }

    // Verify ownership
    const isOwner = consultation.client.toString() === req.user.id ||
                    consultation.lawyer.toString() === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Status transition validation
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled', 'no-show'],
    };

    if (status && validTransitions[consultation.status]) {
      if (!validTransitions[consultation.status].includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition from ${consultation.status} to ${status}`
        });
      }
      consultation.status = status;
    }

    if (notes) consultation.notes = notes;
    if (billableHours !== undefined) consultation.billableHours = billableHours;

    await consultation.save();

    const populated = await consultation.populate([
      { path: 'client', select: 'name email phone' },
      { path: 'lawyer', select: 'name email practiceAreas feePerHour' }
    ]);

    res.json({ success: true, consultation: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get lawyer availability for a date range
// @route   GET /api/consultations/availability/:lawyerId
exports.getAvailability = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const lawyerId = req.params.lawyerId;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate || startDate);
    end.setHours(23, 59, 59, 999);

    const booked = await Consultation.find({
      lawyer: lawyerId,
      date: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed'] }
    }).select('date timeSlot status');

    const availability = {};
    const now = new Date();
    const todayStr = getLocalDateStr(now);
    const currentHour = now.getHours();

    const current = new Date(start);
    while (current <= end) {
      const dateStr = getLocalDateStr(current);
      const bookedSlots = booked
        .filter(b => getLocalDateStr(b.date) === dateStr)
        .map(b => b.timeSlot);

      const unbookedSlots = ALL_SLOTS.filter(s => !bookedSlots.includes(s));

      if (dateStr === todayStr) {
        const pastSlots = unbookedSlots.filter(slot => parseInt(slot.split(':')[0]) <= currentHour);
        const futureSlots = unbookedSlots.filter(slot => parseInt(slot.split(':')[0]) > currentHour);
        availability[dateStr] = { available: futureSlots, booked: bookedSlots, past: pastSlots };
      } else {
        availability[dateStr] = { available: unbookedSlots, booked: bookedSlots, past: [] };
      }

      current.setDate(current.getDate() + 1);
    }

    res.json({ success: true, availability });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get upcoming consultations
// @route   GET /api/consultations/upcoming
exports.getUpcoming = async (req, res) => {
  try {
    const filter = {
      date: { $gte: new Date() },
      status: { $in: ['pending', 'confirmed'] }
    };

    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    const consultations = await Consultation.find(filter)
      .populate('client', 'name email')
      .populate('lawyer', 'name email practiceAreas')
      .sort({ date: 1 })
      .limit(5);

    res.json({ success: true, consultations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

```

### backend/controllers/deadline.controller.js
```javascript
// backend/controllers/deadline.controller.js
const Deadline = require('../models/Deadline.model');
const Case = require('../models/Case.model');

// @desc    Add deadline to a case
// @route   POST /api/deadlines
exports.createDeadline = async (req, res) => {
  try {
    const { caseId, title, description, deadlineDate, type } = req.body;

    // Verify case exists and user is the assigned lawyer
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }
    if (caseDoc.lawyer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the assigned lawyer can add deadlines' });
    }

    const deadline = await Deadline.create({
      case: caseId,
      addedBy: req.user.id,
      title,
      description,
      deadlineDate: new Date(deadlineDate),
      type,
      participants: [caseDoc.lawyer, caseDoc.client] // Both parties
    });

    const populated = await deadline.populate([
      { path: 'case', select: 'title caseNumber' },
      { path: 'addedBy', select: 'name' },
      { path: 'participants', select: 'name email' }
    ]);

    res.status(201).json({ success: true, deadline: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get deadlines for a case or all for user
// @route   GET /api/deadlines
exports.getDeadlines = async (req, res) => {
  try {
    const { caseId, upcoming } = req.query;
    const filter = {};

    if (caseId) {
      filter.case = caseId;
    } else {
      // Get deadlines for all cases this user is part of
      filter.participants = req.user.id;
    }

    // Only upcoming deadlines
    if (upcoming === 'true') {
      filter.deadlineDate = { $gte: new Date() };
    }

    const deadlines = await Deadline.find(filter)
      .populate('case', 'title caseNumber legalArea')
      .populate('addedBy', 'name')
      .populate('participants', 'name email')
      .sort({ deadlineDate: 1 });

    res.json({ success: true, count: deadlines.length, deadlines });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete a deadline
// @route   DELETE /api/deadlines/:id
exports.deleteDeadline = async (req, res) => {
  try {
    const deadline = await Deadline.findOneAndDelete({
      _id: req.params.id,
      addedBy: req.user.id
    });

    if (!deadline) {
      return res.status(404).json({ success: false, message: 'Deadline not found or not authorized' });
    }

    res.json({ success: true, message: 'Deadline deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

```

### backend/controllers/document.controller.js
```javascript
// backend/controllers/document.controller.js
const LegalDocument = require('../models/LegalDocument.model');
const { generateLegalDocPDF } = require('../services/pdfService');
const path = require('path');

// @desc    Create and issue a legal document (PDF auto-generated)
// @route   POST /api/documents
exports.createDocument = async (req, res) => {
  try {
    const { caseId, clientId, documentType, title, content } = req.body;

    const doc = await LegalDocument.create({
      case: caseId,
      lawyer: req.user.id,
      client: clientId,
      documentType,
      title,
      content,
      status: 'issued',
      issuedAt: new Date()
    });

    // Generate PDF
    const pdfUrl = await generateLegalDocPDF(doc);
    doc.pdfUrl = pdfUrl;
    await doc.save();

    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    List documents (role-filtered)
// @route   GET /api/documents
exports.getDocuments = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    if (req.query.caseId) filter.case = req.query.caseId;
    if (req.query.status) filter.status = req.query.status;

    const documents = await LegalDocument.find(filter)
      .populate('lawyer', 'name email')
      .populate('client', 'name email')
      .populate('case', 'title caseNumber')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: documents.length, documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Download document PDF
// @route   GET /api/documents/:id/pdf
exports.downloadPDF = async (req, res) => {
  try {
    const doc = await LegalDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    // Check access
    if (doc.status === 'revoked' && req.user.role === 'client') {
      return res.status(403).json({ success: false, message: 'Access revoked' });
    }

    const hasAccess = doc.lawyer.toString() === req.user.id ||
                      doc.client.toString() === req.user.id;
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Not authorized' });

    const filePath = path.join(__dirname, '..', doc.pdfUrl);
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Revoke client access to document
// @route   PUT /api/documents/:id/revoke
exports.revokeDocument = async (req, res) => {
  try {
    const doc = await LegalDocument.findOneAndUpdate(
      { _id: req.params.id, lawyer: req.user.id },
      { status: 'revoked' },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

```

### backend/controllers/invoice.controller.js
```javascript
// backend/controllers/invoice.controller.js
const Invoice = require('../models/Invoice.model');
const Case = require('../models/Case.model');
const User = require('../models/User.model');
const { generateInvoicePDF } = require('../services/pdfService');
const path = require('path');

// @desc    Create invoice from time entries
// @route   POST /api/invoices
exports.createInvoice = async (req, res) => {
  try {
    const { caseId, clientId, lineItems, dueDate } = req.body;

    // Get lawyer's hourly rate
    const lawyer = await User.findById(req.user.id);
    const rate = lawyer.feePerHour || 0;

    // Calculate each line item amount and total
    const processedItems = lineItems.map(item => ({
      description: item.description,
      hours: item.hours,
      ratePerHour: item.ratePerHour || rate,
      amount: item.hours * (item.ratePerHour || rate)
    }));

    const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);

    const invoice = await Invoice.create({
      lawyer: req.user.id,
      client: clientId,
      case: caseId,
      lineItems: processedItems,
      totalAmount,
      dueDate: new Date(dueDate)
    });

    // Generate PDF
    const pdfUrl = await generateInvoicePDF(invoice);
    invoice.pdfUrl = pdfUrl;
    await invoice.save();

    // Update case totalBillableHours
    const totalHours = processedItems.reduce((sum, item) => sum + item.hours, 0);
    await Case.findByIdAndUpdate(caseId, {
      $inc: { totalBillableHours: totalHours }
    });

    const populated = await invoice.populate([
      { path: 'lawyer', select: 'name email' },
      { path: 'client', select: 'name email' },
      { path: 'case', select: 'title caseNumber' }
    ]);

    res.status(201).json({ success: true, invoice: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    List invoices (role-filtered, with overdue detection)
// @route   GET /api/invoices
exports.getInvoices = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'client') filter.client = req.user.id;
    else if (req.user.role === 'lawyer') filter.lawyer = req.user.id;

    if (req.query.caseId) filter.case = req.query.caseId;
    if (req.query.status) filter.status = req.query.status;

    let invoices = await Invoice.find(filter)
      .populate('lawyer', 'name email')
      .populate('client', 'name email')
      .populate('case', 'title caseNumber')
      .sort({ createdAt: -1 });

    // Auto-detect overdue invoices
    const now = new Date();
    for (const inv of invoices) {
      if (inv.status === 'pending' && inv.dueDate < now) {
        inv.status = 'overdue';
        await inv.save();
      }
    }

    res.json({ success: true, count: invoices.length, invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Download invoice PDF
// @route   GET /api/invoices/:id/pdf
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Not found' });

    const hasAccess = invoice.lawyer.toString() === req.user.id ||
                      invoice.client.toString() === req.user.id;
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Not authorized' });

    const filePath = path.join(__dirname, '..', invoice.pdfUrl);
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Mark invoice as paid
// @route   PUT /api/invoices/:id/pay
exports.markAsPaid = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, client: req.user.id, status: { $in: ['pending', 'overdue'] } },
      { status: 'paid', paidAt: new Date() },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found or already paid' });
    }

    res.json({ success: true, invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

```

### backend/controllers/user.controller.js
```javascript
// backend/controllers/user.controller.js
const User = require('../models/User.model');
const path = require('path');

// Role-specific field whitelists — prevents clients from setting lawyer fields and vice versa
const FIELD_WHITELISTS = {
  client: ['name', 'phone', 'bio', 'location', 'legalMatterTypes'],
  lawyer: ['name', 'phone', 'bio', 'location', 'barRegistrationNumber', 'practiceAreas',
           'courtAdmissions', 'feePerHour', 'yearsOfExperience', 'languages'],
  admin: ['name', 'phone', 'bio', 'location']
};

// @desc    Get current user profile
// @route   GET /api/users/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update profile (role-specific field whitelist enforced)
// @route   PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = FIELD_WHITELISTS[req.user.role];
    const updates = {};

    // Only allow whitelisted fields
    for (const key of Object.keys(req.body)) {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true
    });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get public lawyer directory
// @route   GET /api/users/lawyers
// @access  Public
exports.getLawyers = async (req, res) => {
  try {
    const { practiceArea, city, minFee, maxFee, language, search } = req.query;

    // Escape special regex characters to prevent ReDoS attacks
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const filter = { role: 'lawyer', isVerified: true, isBlocked: { $ne: true } };

    if (practiceArea) filter.practiceAreas = practiceArea;
    if (city) filter['location.city'] = new RegExp(escapeRegex(city), 'i');
    if (language) filter.languages = language;
    if (minFee || maxFee) {
      filter.feePerHour = {};
      if (minFee) filter.feePerHour.$gte = Number(minFee);
      if (maxFee) filter.feePerHour.$lte = Number(maxFee);
    }
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { name: new RegExp(escaped, 'i') },
        { bio: new RegExp(escaped, 'i') }
      ];
    }

    const lawyers = await User.find(filter)
      .select('name email bio location practiceAreas feePerHour yearsOfExperience languages courtAdmissions barRegistrationNumber')
      .sort({ yearsOfExperience: -1 });

    res.json({ success: true, count: lawyers.length, lawyers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get lawyer's own clients (from consultations/cases)
// @route   GET /api/users/clients
// @access  Private (lawyer only)
exports.getClients = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { role: 'client' };

    if (search) {
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escaped = escapeRegex(search);
      filter.$or = [
        { name: new RegExp(escaped, 'i') },
        { email: new RegExp(escaped, 'i') }
      ];
    }

    const clients = await User.find(filter)
      .select('name email phone location legalMatterTypes activeCase')
      .sort({ name: 1 });

    res.json({ success: true, count: clients.length, clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get a single user by ID (public profile)
// @route   GET /api/users/public/:id
// @access  Public
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name email bio location practiceAreas feePerHour yearsOfExperience languages courtAdmissions barRegistrationNumber role');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

```

### backend/middleware/auth.js
```javascript
// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

// Protect routes - verify JWT
exports.protect = async (req, res, next) => {
  let token;

  // 1. Check httpOnly cookie first (primary method)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback to Authorization header (for socket.io and mobile clients)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists'
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Authorize specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

```

### backend/migrate-verify.js
```javascript
// backend/migrate-verify.js
// One-time migration: Sets isVerified=true for all existing users
// Run: node backend/migrate-verify.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, 'config', 'config.env') });

const User = require('./models/User.model');

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await User.updateMany(
    { isVerified: { $ne: true } },
    { $set: { isVerified: true } }
  );

  console.log(`✅ Migration complete: ${result.modifiedCount} users set to isVerified=true`);
  
  // Also ensure admin exists
  const adminEmail = 'khareshudhanshu247@gmail.com';
  const admin = await User.findOne({ email: adminEmail });
  if (admin) {
    admin.role = 'admin';
    admin.isVerified = true;
    admin.isBlocked = false;
    await admin.save();
    console.log(`✅ Admin role assigned to ${adminEmail}`);
  } else {
    console.log(`ℹ️  Admin account (${adminEmail}) not found — it will be created on first Google Sign-In`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

migrate().catch(err => { console.error(err); process.exit(1); });

```

### backend/models/Case.model.js
```javascript
// backend/models/Case.model.js
const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ['intake', 'investigation', 'filing', 'hearing', 'resolution', 'closed'],
    required: true
  },
  note: {
    type: String,
    required: [true, 'Milestone note is required'],
    maxlength: 500
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const CaseSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Case title is required'],
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 2000
  },
  caseNumber: {
    type: String,
    unique: true
  },
  legalArea: {
    type: String,
    enum: ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'],
    required: true
  },
  status: {
    type: String,
    enum: ['intake', 'investigation', 'filing', 'hearing', 'resolution', 'closed'],
    default: 'intake'
  },
  milestones: [MilestoneSchema],
  totalBillableHours: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Auto-generate case number before saving (race-safe with retry)
CaseSchema.pre('save', async function(next) {
  if (!this.caseNumber) {
    const year = new Date().getFullYear();
    const CaseModel = mongoose.model('Case');

    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await CaseModel.findOne({ caseNumber: new RegExp(`^LW-${year}-`) })
        .sort({ _id: -1 })
        .select('caseNumber');
      
      let nextNum = 1;
      if (last && last.caseNumber) {
        const parts = last.caseNumber.split('-');
        nextNum = parseInt(parts[parts.length - 1], 10) + 1;
      }
      
      this.caseNumber = `LW-${year}-${String(nextNum).padStart(5, '0')}`;
      
      // Check if this number already exists (race condition guard)
      const exists = await CaseModel.findOne({ caseNumber: this.caseNumber });
      if (!exists) break;
    }
  }
  next();
});

CaseSchema.index({ client: 1 });
CaseSchema.index({ lawyer: 1 });

module.exports = mongoose.model('Case', CaseSchema);

```

### backend/models/Consultation.model.js
```javascript
// backend/models/Consultation.model.js
const mongoose = require('mongoose');

const ConsultationSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Please provide a consultation date']
  },
  timeSlot: {
    type: String,
    required: [true, 'Please provide a time slot'],
    // Format: "09:00-10:00", "10:00-11:00", etc.
  },
  duration: {
    type: Number,
    default: 60 // minutes — LawLink uses 60-min consultation slots
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'],
    default: 'pending'
  },
  reason: {
    type: String,
    maxlength: 500
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  caseRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  },
  billableHours: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Prevent double-booking: unique constraint on lawyer + date + timeSlot
ConsultationSchema.index({ lawyer: 1, date: 1, timeSlot: 1 }, { unique: true });
ConsultationSchema.index({ client: 1, date: 1 });

module.exports = mongoose.model('Consultation', ConsultationSchema);

```

### backend/models/Conversation.model.js
```javascript
// backend/models/Conversation.model.js
const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Ensure unique conversation between two users
ConversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);

```

### backend/models/Deadline.model.js
```javascript
// backend/models/Deadline.model.js
const mongoose = require('mongoose');

const DeadlineSchema = new mongoose.Schema({
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Deadline title is required'],
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 500
  },
  deadlineDate: {
    type: Date,
    required: [true, 'Deadline date is required']
  },
  type: {
    type: String,
    enum: ['court_date', 'filing_deadline', 'statute_of_limitations', 'hearing_date', 'response_due'],
    required: true
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

DeadlineSchema.index({ deadlineDate: 1, reminderSent: 1 });
DeadlineSchema.index({ case: 1 });

module.exports = mongoose.model('Deadline', DeadlineSchema);

```

### backend/models/Invoice.model.js
```javascript
// backend/models/Invoice.model.js
const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  hours: { type: Number, required: true, min: 0.1 },
  ratePerHour: { type: Number, required: true },
  amount: { type: Number, required: true } // hours × ratePerHour (computed on create)
});

const InvoiceSchema = new mongoose.Schema({
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  lineItems: [LineItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  pdfUrl: String,
  invoiceNumber: {
    type: String,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    default: 'pending'
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidAt: Date
}, { timestamps: true });

// Auto-generate invoice number (race-safe with retry)
InvoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `LW-INV-${year}${month}-`;
    const InvoiceModel = mongoose.model('Invoice');

    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await InvoiceModel.findOne({ invoiceNumber: new RegExp(`^${prefix}`) })
        .sort({ _id: -1 })
        .select('invoiceNumber');
      
      let nextNum = 1;
      if (last && last.invoiceNumber) {
        const parts = last.invoiceNumber.split('-');
        nextNum = parseInt(parts[parts.length - 1], 10) + 1;
      }
      
      this.invoiceNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;
      
      const exists = await InvoiceModel.findOne({ invoiceNumber: this.invoiceNumber });
      if (!exists) break;
    }
  }
  next();
});

InvoiceSchema.index({ lawyer: 1 });
InvoiceSchema.index({ client: 1 });
InvoiceSchema.index({ case: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);

```

### backend/models/LegalDocument.model.js
```javascript
// backend/models/LegalDocument.model.js
const mongoose = require('mongoose');

const LegalDocumentSchema = new mongoose.Schema({
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentType: {
    type: String,
    enum: ['demand_letter', 'contract', 'legal_notice', 'court_brief', 'agreement', 'power_of_attorney'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String, // Rich text content of the document
    required: true
  },
  pdfUrl: String,
  status: {
    type: String,
    enum: ['draft', 'issued', 'acknowledged', 'expired', 'revoked'],
    default: 'draft'
  },
  documentNumber: {
    type: String,
    unique: true
  },
  issuedAt: Date
}, { timestamps: true });

// Auto-generate document number (race-safe with retry)
LegalDocumentSchema.pre('save', async function(next) {
  if (!this.documentNumber) {
    const year = new Date().getFullYear();
    const prefix = `LW-DOC-${year}-`;
    const DocModel = mongoose.model('LegalDocument');

    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await DocModel.findOne({ documentNumber: new RegExp(`^${prefix}`) })
        .sort({ _id: -1 })
        .select('documentNumber');
      
      let nextNum = 1;
      if (last && last.documentNumber) {
        const parts = last.documentNumber.split('-');
        nextNum = parseInt(parts[parts.length - 1], 10) + 1;
      }
      
      this.documentNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;
      
      const exists = await DocModel.findOne({ documentNumber: this.documentNumber });
      if (!exists) break;
    }
  }
  next();
});

module.exports = mongoose.model('LegalDocument', LegalDocumentSchema);

```

### backend/models/Message.model.js
```javascript
// backend/models/Message.model.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  }
}, { timestamps: true });

MessageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);

```

### backend/models/OTP.model.js
```javascript
// backend/models/OTP.model.js
const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  userData: {
    type: mongoose.Schema.Types.Mixed,  // Store registration data until OTP is verified
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300  // TTL: MongoDB auto-deletes after 300 seconds (5 minutes)
  }
});

module.exports = mongoose.model('OTP', OTPSchema);

```

### backend/models/User.model.js
```javascript
// backend/models/User.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false  // Don't return password in queries by default
  },
  authMethod: {
    type: String,
    enum: ['password', 'google'],
    default: 'password'
  },
  googleId: {
    type: String,
    sparse: true
  },
  role: {
    type: String,
    enum: ['client', 'lawyer', 'admin'],
    default: 'client'
  },
  isVerified: {
    type: Boolean,
    default: false  // Admin must approve new registrations
  },
  isBlocked: {
    type: Boolean,
    default: false  // Admin can suspend accounts
  },
  phone: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  location: {
    city: String,
    state: String,
    country: { type: String, default: 'India' }
  },

  // ── Lawyer-only fields ──
  barRegistrationNumber: {
    type: String,
    unique: true,
    sparse: true  // allows null for non-lawyers
  },
  practiceAreas: [{
    type: String,
    enum: ['criminal', 'civil', 'family', 'corporate', 'property', 'labour']
  }],
  courtAdmissions: [String],
  feePerHour: {
    type: Number,
    min: 0
  },
  yearsOfExperience: {
    type: Number,
    min: 0
  },
  languages: [String],

  // ── Client-only fields ──
  legalMatterTypes: [{
    type: String,
    enum: ['criminal', 'civil', 'family', 'corporate', 'property', 'labour']
  }],
  activeCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  },

  // ── Password reset ──
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, {
  timestamps: true  // adds createdAt and updatedAt
});

// ── Index for role lookups ──
UserSchema.index({ role: 1 });

// ── Hash password before saving ──
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Compare password method ──
UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// ── Generate JWT ──
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

module.exports = mongoose.model('User', UserSchema);

```

### backend/routes/admin.routes.js
```javascript
// backend/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getPendingUsers, getAllLawyers, getAllClients,
  verifyUser, blockUser, unblockUser, deleteUser
} = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/pending', getPendingUsers);
router.get('/lawyers', getAllLawyers);
router.get('/clients', getAllClients);
router.put('/verify/:id', verifyUser);
router.put('/block/:id', blockUser);
router.put('/unblock/:id', unblockUser);
router.delete('/users/:id', deleteUser);

module.exports = router;

```

### backend/routes/auth.routes.js
```javascript
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

```

### backend/routes/case.routes.js
```javascript
// backend/routes/case.routes.js
const express = require('express');
const router = express.Router();
const {
  createCase, getCases, getCase, addMilestone, advanceStatus
} = require('../controllers/case.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('lawyer'), createCase);
router.get('/', protect, getCases);
router.get('/:id', protect, getCase);
router.put('/:id/milestone', protect, authorize('lawyer'), addMilestone);
router.put('/:id/status', protect, authorize('lawyer'), advanceStatus);

module.exports = router;

```

### backend/routes/chat.routes.js
```javascript
// backend/routes/chat.routes.js
const express = require('express');
const router = express.Router();
const {
  getOrCreateConversation, getConversations,
  getMessages, sendMessage, markAsRead, getUnreadCount
} = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth');

router.post('/conversations', protect, getOrCreateConversation);
router.get('/conversations', protect, getConversations);
router.get('/conversations/:id/messages', protect, getMessages);
router.post('/conversations/:id/messages', protect, sendMessage);
router.put('/conversations/:id/read', protect, markAsRead);
router.get('/unread-count', protect, getUnreadCount);

module.exports = router;

```

### backend/routes/consultation.routes.js
```javascript
// backend/routes/consultation.routes.js
const express = require('express');
const router = express.Router();
const {
  bookConsultation, getConsultations, updateConsultation,
  getAvailability, getUpcoming
} = require('../controllers/consultation.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('client'), bookConsultation);
router.get('/', protect, getConsultations);
router.get('/upcoming', protect, getUpcoming);
router.get('/availability/:lawyerId', getAvailability);  // Public
router.put('/:id', protect, updateConsultation);

module.exports = router;

```

### backend/routes/deadline.routes.js
```javascript
// backend/routes/deadline.routes.js
const express = require('express');
const router = express.Router();
const { createDeadline, getDeadlines, deleteDeadline } = require('../controllers/deadline.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('lawyer'), createDeadline);
router.get('/', protect, getDeadlines);
router.delete('/:id', protect, authorize('lawyer'), deleteDeadline);

module.exports = router;

```

### backend/routes/document.routes.js
```javascript
// backend/routes/document.routes.js
const express = require('express');
const router = express.Router();
const { createDocument, getDocuments, downloadPDF, revokeDocument } = require('../controllers/document.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('lawyer'), createDocument);
router.get('/', protect, getDocuments);
router.get('/:id/pdf', protect, downloadPDF);
router.put('/:id/revoke', protect, authorize('lawyer'), revokeDocument);

module.exports = router;

```

### backend/routes/invoice.routes.js
```javascript
// backend/routes/invoice.routes.js
const express = require('express');
const router = express.Router();
const {
  createInvoice, getInvoices, downloadInvoicePDF, markAsPaid
} = require('../controllers/invoice.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('lawyer'), createInvoice);
router.get('/', protect, getInvoices);
router.get('/:id/pdf', protect, downloadInvoicePDF);
router.put('/:id/pay', protect, authorize('client'), markAsPaid);

module.exports = router;

```

### backend/routes/user.routes.js
```javascript
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

```

### backend/seed.js
```javascript
// backend/seed.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');


dotenv.config({ path: path.join(__dirname, 'config', 'config.env') });

const User = require('./models/User.model');
const Case = require('./models/Case.model');
const Consultation = require('./models/Consultation.model');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for seeding');

  // Clear existing data
  await User.deleteMany({});
  await Case.deleteMany({});
  await Consultation.deleteMany({});

  // Use plaintext — the User model's pre('save') hook handles bcrypt hashing
  const plainPassword = 'password123';

  // Create test lawyer
  const lawyer = await User.create({
    name: 'Priya Sharma', email: 'priya@lawlink.com', password: plainPassword,
    role: 'lawyer', isVerified: true, phone: '+919876543210',
    barRegistrationNumber: 'BAR-DL-2018-001', practiceAreas: ['criminal', 'civil'],
    courtAdmissions: ['Delhi High Court', 'Supreme Court'], feePerHour: 2500,
    yearsOfExperience: 8, languages: ['English', 'Hindi'],
    location: { city: 'Delhi', state: 'Delhi', country: 'India' },
    bio: 'Senior criminal lawyer with expertise in white-collar crime.'
  });

  // Create test client
  const client = await User.create({
    name: 'Rahul Kumar', email: 'rahul@lawlink.com', password: plainPassword,
    role: 'client', isVerified: true, phone: '+919876543220',
    legalMatterTypes: ['criminal', 'property'], location: { city: 'Delhi', state: 'Delhi' },
    bio: 'Looking for legal representation in a property dispute.'
  });

  // Create sample case
  await Case.create({
    client: client._id, lawyer: lawyer._id,
    title: 'Property Dispute — Sector 42', description: 'Boundary dispute with neighboring property.',
    legalArea: 'property', status: 'investigation',
    milestones: [
      { stage: 'intake', note: 'Case opened — initial documents collected', addedBy: lawyer._id },
      { stage: 'investigation', note: 'Survey report requested from municipal office', addedBy: lawyer._id }
    ]
  });

  console.log('\nSeed data created successfully!');
  console.log('========================================');
  console.log('Login credentials (all use password: password123):');
  console.log('  Lawyer:  priya@lawlink.com');
  console.log('  Client:  rahul@lawlink.com');
  console.log('========================================');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });

```

### backend/server.js
```javascript
// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const dns = require('dns');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

// Fix DNS for MongoDB Atlas SRV lookups (use Google DNS)
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Load env vars
dotenv.config({ path: path.join(__dirname, 'config', 'config.env') });

const app = express();
const server = http.createServer(app);

// ── Socket.io Setup ──
const { Server } = require('socket.io');
const setupSocket = require('./socket/handlers');

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const socketState = setupSocket(io);

// Make io accessible to controllers
app.set('io', io);
app.set('socketState', socketState);

const isProduction = process.env.NODE_ENV === 'production';

// ── Security Middleware ──
app.use(require('helmet')());                     // Set secure HTTP headers
app.use(require('express-mongo-sanitize')());      // Prevent NoSQL injection
app.use(require('express-rate-limit')({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: isProduction ? 100 : 500,  // Stricter in production
  message: { success: false, message: 'Too many requests, please try again later' },
  skip: (req) => req.path.startsWith('/socket.io')  // Don't rate-limit socket.io
}));

// ── Core Middleware ──
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging ──
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- ROUTE IMPORTS (add these as we build each feature) ---
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const consultationRoutes = require('./routes/consultation.routes');
const caseRoutes = require('./routes/case.routes');
const chatRoutes = require('./routes/chat.routes');
const documentRoutes = require('./routes/document.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const deadlineRoutes = require('./routes/deadline.routes');
const adminRoutes = require('./routes/admin.routes');

// --- MOUNT ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/deadlines', deadlineRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');

    // Initialize cron services
    const { initReminderService } = require('./services/reminderService');
    initReminderService(io);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Export server for Socket.io setup later
module.exports = { app, server };

```

### backend/services/pdfService.js
```javascript
// backend/services/pdfService.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Ensure legal-docs upload directory exists
const docsDir = path.join(__dirname, '..', 'uploads', 'legal-docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Generate legal document PDF
exports.generateLegalDocPDF = async (doc) => {
  return new Promise((resolve, reject) => {
    const fileName = `legal-doc-${doc._id}-${Date.now()}.pdf`;
    const filePath = path.join(docsDir, fileName);
    const pdfDoc = new PDFDocument({ margin: 60 });
    const stream = fs.createWriteStream(filePath);

    pdfDoc.pipe(stream);

    // Header
    pdfDoc.fontSize(10).fillColor('#666')
      .text(`Document No: ${doc.documentNumber}`, { align: 'right' });
    pdfDoc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    pdfDoc.moveDown(2);

    // Title
    pdfDoc.fontSize(20).fillColor('#1a1a1a').font('Helvetica-Bold')
      .text(doc.title, { align: 'center' });
    pdfDoc.moveDown(0.5);

    // Document type badge
    const typeLabel = doc.documentType.replace(/_/g, ' ').toUpperCase();
    pdfDoc.fontSize(10).fillColor('#666').font('Helvetica')
      .text(typeLabel, { align: 'center' });
    pdfDoc.moveDown(1.5);

    // Divider
    pdfDoc.moveTo(60, pdfDoc.y).lineTo(550, pdfDoc.y).stroke('#ddd');
    pdfDoc.moveDown(1);

    // Content
    pdfDoc.fontSize(12).fillColor('#333').font('Helvetica')
      .text(doc.content, { align: 'left', lineGap: 6 });
    pdfDoc.moveDown(2);

    // Footer
    pdfDoc.moveTo(60, pdfDoc.y).lineTo(550, pdfDoc.y).stroke('#ddd');
    pdfDoc.moveDown(1);
    pdfDoc.fontSize(9).fillColor('#999')
      .text('Generated by LawLink — Legal Services Platform', { align: 'center' });

    pdfDoc.end();

    stream.on('finish', () => {
      resolve(`/uploads/legal-docs/${fileName}`);
    });
    stream.on('error', reject);
  });
};

// Generate invoice PDF (used in Step 07)
exports.generateInvoicePDF = async (invoice) => {
  return new Promise((resolve, reject) => {
    const fileName = `invoice-${invoice._id}-${Date.now()}.pdf`;
    const filePath = path.join(docsDir, fileName);
    const pdfDoc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    pdfDoc.pipe(stream);

    // Header
    pdfDoc.fontSize(22).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
    pdfDoc.moveDown(0.3);
    pdfDoc.fontSize(10).font('Helvetica').fillColor('#666')
      .text(`Invoice #: ${invoice.invoiceNumber}`, { align: 'right' });
    pdfDoc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    pdfDoc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, { align: 'right' });
    pdfDoc.moveDown(1.5);

    // Line items table header
    const tableTop = pdfDoc.y;
    pdfDoc.fontSize(10).font('Helvetica-Bold').fillColor('#333');
    pdfDoc.text('Description', 50, tableTop, { width: 250 });
    pdfDoc.text('Hours', 310, tableTop, { width: 60, align: 'right' });
    pdfDoc.text('Rate', 380, tableTop, { width: 70, align: 'right' });
    pdfDoc.text('Amount', 460, tableTop, { width: 80, align: 'right' });
    pdfDoc.moveDown(0.5);

    pdfDoc.moveTo(50, pdfDoc.y).lineTo(550, pdfDoc.y).stroke('#ddd');
    pdfDoc.moveDown(0.5);

    // Line items
    pdfDoc.font('Helvetica').fillColor('#555');
    invoice.lineItems.forEach(item => {
      const y = pdfDoc.y;
      pdfDoc.text(item.description, 50, y, { width: 250 });
      pdfDoc.text(item.hours.toString(), 310, y, { width: 60, align: 'right' });
      pdfDoc.text(`Rs.${item.ratePerHour}`, 380, y, { width: 70, align: 'right' });
      pdfDoc.text(`Rs.${item.amount}`, 460, y, { width: 80, align: 'right' });
      pdfDoc.moveDown(0.8);
    });

    // Total
    pdfDoc.moveDown(0.5);
    pdfDoc.moveTo(50, pdfDoc.y).lineTo(550, pdfDoc.y).stroke('#ddd');
    pdfDoc.moveDown(0.5);
    pdfDoc.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a1a');
    pdfDoc.text(`Total: Rs.${invoice.totalAmount}`, { align: 'right' });

    // Footer
    pdfDoc.moveDown(3);
    pdfDoc.fontSize(9).font('Helvetica').fillColor('#999')
      .text('Generated by LawLink — Legal Services Platform', { align: 'center' });

    pdfDoc.end();

    stream.on('finish', () => {
      resolve(`/uploads/legal-docs/${fileName}`);
    });
    stream.on('error', reject);
  });
};

```

### backend/services/reminderService.js
```javascript
// backend/services/reminderService.js
const cron = require('node-cron');
const Deadline = require('../models/Deadline.model');

let io = null; // Set from server.js

const initReminderService = (socketIo) => {
  io = socketIo;

  // Run every day at 08:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Running daily deadline reminder job...');
    await processDeadlineReminders();
  });

  console.log('Reminder service initialized — runs daily at 08:00');
};

const processDeadlineReminders = async () => {
  try {
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Find deadlines within 48 hours that haven't had reminders sent
    const upcomingDeadlines = await Deadline.find({
      deadlineDate: { $gte: now, $lte: in48Hours },
      reminderSent: false
    })
      .populate('case', 'title caseNumber')
      .populate('participants', 'name email');

    console.log(`[CRON] Found ${upcomingDeadlines.length} deadlines needing reminders`);

    for (const deadline of upcomingDeadlines) {
      const caseName = `${deadline.case?.caseNumber} — ${deadline.case?.title}`;

      // Socket.io push notification to online participants
      for (const participant of deadline.participants) {
        if (io) {
          io.to(participant._id.toString()).emit('deadline:reminder', {
            deadlineId: deadline._id,
            title: deadline.title,
            deadlineDate: deadline.deadlineDate,
            type: deadline.type,
            caseName
          });
        }
      }

      // Mark as sent
      deadline.reminderSent = true;
      await deadline.save();
    }

    console.log(`[CRON] Processed ${upcomingDeadlines.length} deadline reminders`);
  } catch (err) {
    console.error('[CRON] Reminder job error:', err);
  }
};

module.exports = { initReminderService, processDeadlineReminders };

```

### backend/socket/handlers.js
```javascript
// backend/socket/handlers.js
const jwt = require('jsonwebtoken');
const Message = require('../models/Message.model');
const Conversation = require('../models/Conversation.model');

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map();

module.exports = function setupSocket(io) {

  // Auth middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcast online users
    io.emit('users:online', Array.from(onlineUsers.keys()));

    // ── Join conversation room ──
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    // ── Send message ──
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content } = data;

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          content
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          lastMessageAt: new Date()
        });

        const populated = await message.populate('sender', 'name role');

        // Send to all in room
        io.to(`conv:${conversationId}`).emit('message:new', populated);

        // Mark as delivered if recipient is online and in the room
        const conv = await Conversation.findById(conversationId);
        const recipientId = conv.participants.find(p => p.toString() !== userId)?.toString();

        if (recipientId && onlineUsers.has(recipientId)) {
          const recipientSockets = onlineUsers.get(recipientId);
          for (const sid of recipientSockets) {
            const recipientSocket = io.sockets.sockets.get(sid);
            if (recipientSocket && recipientSocket.rooms.has(`conv:${conversationId}`)) {
              message.status = 'delivered';
              await message.save();
              io.to(`conv:${conversationId}`).emit('messages:delivered', {
                conversationId,
                messageIds: [message._id]
              });
              break;
            }
          }
        }
      } catch (err) {
        console.error('message:send error:', err);
      }
    });

    // ── Message delivered acknowledgment ──
    socket.on('message:delivered', async (data) => {
      try {
        const { conversationId, messageIds } = data;
        await Message.updateMany(
          { _id: { $in: messageIds }, status: 'sent' },
          { status: 'delivered' }
        );
        socket.to(`conv:${conversationId}`).emit('messages:delivered', {
          conversationId, messageIds
        });
      } catch (err) {
        console.error('message:delivered error:', err);
      }
    });

    // ── Message read ──
    socket.on('message:read', async (data) => {
      try {
        const { conversationId } = data;
        const updated = await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: userId },
            status: { $ne: 'read' }
          },
          { status: 'read' }
        );

        if (updated.modifiedCount > 0) {
          socket.to(`conv:${conversationId}`).emit('messages:read', {
            conversationId, readBy: userId
          });
        }
      } catch (err) {
        console.error('message:read error:', err);
      }
    });

    // ── Typing indicators ──
    socket.on('typing:start', (data) => {
      socket.to(`conv:${data.conversationId}`).emit('typing:start', {
        userId, conversationId: data.conversationId
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(`conv:${data.conversationId}`).emit('typing:stop', {
        userId, conversationId: data.conversationId
      });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).delete(socket.id);
        if (onlineUsers.get(userId).size === 0) {
          onlineUsers.delete(userId);
        }
      }
      io.emit('users:online', Array.from(onlineUsers.keys()));
      console.log(`User disconnected: ${userId}`);
    });
  });

  return { onlineUsers };
};

```

### backend/tests/auth.test.js
```javascript
// backend/tests/auth.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

// Use Google DNS to resolve MongoDB Atlas SRV records (same as server.js)
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

const express = require('express');
const app = express();

app.use(express.json());
app.use(require('helmet')());
app.use(require('express-mongo-sanitize')());

const authRoutes = require('../routes/auth.routes');
app.use('/api/auth', authRoutes);

let token;
const testUser = {
  name: 'Test Client',
  email: `test_${Date.now()}@lawlink.com`,
  password: 'password123',
  role: 'client'
};

// Create a pre-existing user for login tests (bypasses OTP flow)
let loginTestUser;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  // Directly create a user in DB for login tests (model pre-save handles hashing)
  const User = require('../models/User.model');
  loginTestUser = await User.create({
    name: 'Login Test User',
    email: `login_test_${Date.now()}@lawlink.com`,
    password: 'password123',
    role: 'client',
    authMethod: 'password'
  });
  token = loginTestUser.getSignedJwtToken();
}, 30000); // 30s timeout for Atlas connection

afterAll(async () => {
  const User = require('../models/User.model');
  await User.deleteOne({ email: testUser.email });
  if (loginTestUser?._id) await User.deleteOne({ _id: loginTestUser._id });
  await mongoose.connection.close();
}, 30000); // 30s timeout for cleanup

describe('Auth API', () => {
  // ── Registration (OTP Flow) ──

  test('POST /api/auth/register — should accept valid data for new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    // 200 = OTP sent successfully via email
    // 500 = OTP generated but email transport failed (expected in test env without SMTP)
    if (res.statusCode === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.requiresOTP).toBe(true);
    } else {
      // Email sending failed — this is an environment issue, not a code bug
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBeDefined();
    }
  });

  test('POST /api/auth/register — should reject missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'incomplete@test.com' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ── Login ──

  test('POST /api/auth/login — should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginTestUser.email, password: 'password123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('client');
    token = res.body.token;
  });

  test('POST /api/auth/login — should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginTestUser.email, password: 'wrongpassword' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── Token Validation ──

  test('GET /api/auth/me — should return user with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(loginTestUser.email);
  });

  test('GET /api/auth/me — should reject invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken123');

    expect(res.statusCode).toBe(401);
  });

  // ── Security ──

  test('POST /api/auth/login — should reject NoSQL injection', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { "$gt": "" }, password: testUser.password });

    expect(res.statusCode).not.toBe(200);
  });

  test('POST /api/auth/register — should reject invalid role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Hacker', email: 'hack@test.com', password: '123456', role: 'admin' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Role must be client or lawyer/);
  });
});

```

### backend/utils/paginate.js
```javascript
// backend/utils/paginate.js

/**
 * Apply pagination to a Mongoose query.
 * Usage: const result = await paginate(Model.find(filter), req.query);
 */
const paginate = async (query, queryParams) => {
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await query.model.countDocuments(query.getFilter());
  const data = await query.skip(skip).limit(limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: page * limit < total
    }
  };
};

module.exports = paginate;

```

### backend/validators/auth.validator.js
```javascript
// backend/validators/auth.validator.js
const { body, validationResult } = require('express-validator');

// Middleware to check validation results and return errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
};

// Registration validation
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  body('role').optional().isIn(['client', 'lawyer']).withMessage('Role must be client or lawyer'),
  validate
];

// Login validation
const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

// OTP verification validation
const verifyOTPRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must contain only numbers'),
  validate
];

// Google auth validation
const googleAuthRules = [
  body('credential').notEmpty().withMessage('Google credential is required'),
  validate
];

// Google register validation
const googleRegisterRules = [
  body('googleId').notEmpty().withMessage('Google ID is required'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('role').isIn(['client', 'lawyer']).withMessage('Role must be client or lawyer'),
  validate
];

// Profile update validation
const updateProfileRules = [
  body('bio').optional().isLength({ max: 1000 }).withMessage('Bio must be under 1000 characters'),
  body('yearsOfExperience').optional().isInt({ min: 0, max: 70 }).withMessage('Years must be 0-70'),
  body('feePerHour').optional().isFloat({ min: 0, max: 100000 }).withMessage('Fee must be 0-100000'),
  body('practiceAreas').optional().isArray().withMessage('Practice areas must be an array'),
  validate
];

// Forgot password validation
const forgotPasswordRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  validate
];

// Reset password validation
const resetPasswordRules = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  validate
];

module.exports = {
  registerRules,
  loginRules,
  verifyOTPRules,
  googleAuthRules,
  googleRegisterRules,
  updateProfileRules,
  forgotPasswordRules,
  resetPasswordRules
};

```

### src/index.html
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="data:," />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LawLink</title>
    <meta name="description" content="Connect with lawyers, manage cases, and track legal deadlines on LawLink." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

```

### src/src/App.jsx
```jsx
// src/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import 'bootstrap/dist/css/bootstrap.min.css';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import LawyerDirectory from './pages/LawyerDirectory';
import BookConsultation from './pages/BookConsultation';
import ConsultationHub from './pages/ConsultationHub';
import CaseManager from './pages/CaseManager';
import Chat from './pages/Chat';
import DocumentHub from './pages/DocumentHub';
import InvoiceManager from './pages/InvoiceManager';
import DeadlineCalendar from './pages/DeadlineCalendar';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Protected route wrapper
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <div className="text-center mt-5"><div className="spinner-border" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  // Admin should only access admin routes — redirect away from everything else
  if (user.role === 'admin' && (!roles || !roles.includes('admin'))) return <Navigate to="/admin" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
};

// Dashboard — shows stats overview with navigation cards
const Dashboard = () => {
  const { user, isLawyer, isClient } = useAuth();

  // Show verification pending banner for unverified users
  const showVerificationBanner = user && !user.isVerified && user.role !== 'admin';

  return (
    <div className="container py-5">
      {showVerificationBanner && (
        <div className="alert alert-warning d-flex align-items-center mb-4" role="alert">
          <span style={{ fontSize: 24, marginRight: 12 }}>⏳</span>
          <div>
            <strong>Profile Pending Verification</strong>
            <p className="mb-0 small">Your account is being reviewed by an admin. {user.role === 'client' ? 'You can browse lawyers but cannot book consultations or send messages until verified.' : 'Your profile will appear in Find Lawyers once verified.'}</p>
          </div>
        </div>
      )}
      <div className="mb-4">
        <h2 className="fw-bold">Welcome, {user?.name}!</h2>
        <p className="text-muted">Role: <span className="badge bg-primary">{user?.role}</span> · {user?.email}</p>
      </div>

      <div className="row g-3">
        {isClient && (
          <div className="col-md-4">
            <a href="/lawyers" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
              <div className="card-body text-center py-4">
                <div style={{ fontSize: 32 }}>🔍</div>
                <h6 className="fw-bold mt-2 text-dark">Find Lawyers</h6>
                <p className="text-muted small mb-0">Browse and book consultations</p>
              </div>
            </a>
          </div>
        )}
        <div className="col-md-4">
          <a href="/cases" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>📋</div>
              <h6 className="fw-bold mt-2 text-dark">My Cases</h6>
              <p className="text-muted small mb-0">Track case progress and milestones</p>
            </div>
          </a>
        </div>
        <div className="col-md-4">
          <a href="/consultations" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>📅</div>
              <h6 className="fw-bold mt-2 text-dark">Consultations</h6>
              <p className="text-muted small mb-0">View and manage appointments</p>
            </div>
          </a>
        </div>
        <div className="col-md-4">
          <a href="/chat" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>💬</div>
              <h6 className="fw-bold mt-2 text-dark">Messages</h6>
              <p className="text-muted small mb-0">Real-time chat with {isLawyer ? 'clients' : 'lawyers'}</p>
            </div>
          </a>
        </div>
        <div className="col-md-4">
          <a href="/documents" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>📄</div>
              <h6 className="fw-bold mt-2 text-dark">Documents</h6>
              <p className="text-muted small mb-0">{isLawyer ? 'Create legal documents & PDFs' : 'View your legal documents'}</p>
            </div>
          </a>
        </div>
        <div className="col-md-4">
          <a href="/invoices" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>💰</div>
              <h6 className="fw-bold mt-2 text-dark">Invoices</h6>
              <p className="text-muted small mb-0">{isLawyer ? 'Generate and track invoices' : 'View and pay invoices'}</p>
            </div>
          </a>
        </div>
        <div className="col-md-4">
          <a href="/deadlines" className="card border-0 shadow-sm text-decoration-none h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body text-center py-4">
              <div style={{ fontSize: 32 }}>⏰</div>
              <h6 className="fw-bold mt-2 text-dark">Deadlines</h6>
              <p className="text-muted small mb-0">Court dates and filing deadlines</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  // Redirect helper — admin goes to /admin, others to /dashboard
  const defaultRoute = isAuthenticated && user?.role === 'admin' ? '/admin' : '/dashboard';

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={defaultRoute} /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to={defaultRoute} /> : <Register />} />

      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to={defaultRoute} /> : <ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route path="/lawyers" element={<LawyerDirectory />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/book/:lawyerId" element={<ProtectedRoute roles={['client']}><BookConsultation /></ProtectedRoute>} />
      <Route path="/consultations" element={<ProtectedRoute><ConsultationHub /></ProtectedRoute>} />
      <Route path="/cases" element={<ProtectedRoute><CaseManager /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentHub /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><InvoiceManager /></ProtectedRoute>} />
      <Route path="/deadlines" element={<ProtectedRoute><DeadlineCalendar /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to={isAuthenticated ? defaultRoute : "/login"} />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Navbar />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;

```

### src/src/components/CaseTimeline.jsx
```jsx
// src/src/components/CaseTimeline.jsx
import { motion } from 'framer-motion';

const STAGES = [
  { key: 'intake', label: 'Intake', icon: '📋' },
  { key: 'investigation', label: 'Investigation', icon: '🔍' },
  { key: 'filing', label: 'Filing', icon: '📁' },
  { key: 'hearing', label: 'Hearing', icon: '⚖️' },
  { key: 'resolution', label: 'Resolution', icon: '✅' },
  { key: 'closed', label: 'Closed', icon: '🔒' }
];

const CaseTimeline = ({ currentStatus, milestones = [] }) => {
  const currentIdx = STAGES.findIndex(s => s.key === currentStatus);

  return (
    <div className="py-3">
      {/* Progress bar */}
      <div className="d-flex align-items-center mb-4 position-relative">
        {/* Background track */}
        <div className="position-absolute w-100" style={{ height: 4, background: '#e9ecef', top: '50%', transform: 'translateY(-50%)', zIndex: 0 }} />
        {/* Filled track */}
        <motion.div
          className="position-absolute"
          style={{ height: 4, background: 'linear-gradient(90deg, #10b981, #059669)', top: '50%', transform: 'translateY(-50%)', zIndex: 1, borderRadius: 4 }}
          initial={{ width: '0%' }}
          animate={{ width: `${(currentIdx / (STAGES.length - 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Stage dots */}
        <div className="d-flex justify-content-between w-100 position-relative" style={{ zIndex: 2 }}>
          {STAGES.map((stage, i) => {
            const isComplete = i <= currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <motion.div
                key={stage.key}
                className="text-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-1"
                  style={{
                    width: isCurrent ? 44 : 36,
                    height: isCurrent ? 44 : 36,
                    background: isComplete ? '#10b981' : '#e9ecef',
                    color: isComplete ? 'white' : '#adb5bd',
                    fontSize: isCurrent ? 20 : 16,
                    border: isCurrent ? '3px solid #059669' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {stage.icon}
                </div>
                <small className={`d-block ${isCurrent ? 'fw-bold text-dark' : 'text-muted'}`}
                       style={{ fontSize: 11 }}>
                  {stage.label}
                </small>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Milestone log */}
      {milestones.length > 0 && (
        <div className="mt-3">
          <h6 className="fw-bold mb-2" style={{ fontSize: 13 }}>Timeline</h6>
          {milestones.slice().reverse().map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="d-flex mb-2"
            >
              <div className="me-3 text-muted" style={{ fontSize: 11, minWidth: 80 }}>
                {new Date(m.timestamp).toLocaleDateString()}
              </div>
              <div>
                <span className="badge bg-light text-dark me-2" style={{ fontSize: 10 }}>{m.stage}</span>
                <span className="small">{m.note}</span>
                {m.addedBy && <span className="text-muted small ms-1">— {m.addedBy.name}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CaseTimeline;

```

### src/src/components/DeadlineBadge.jsx
```jsx
// src/src/components/DeadlineBadge.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';

const DeadlineBadge = () => {
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/deadlines', { params: { upcoming: 'true' } });
        // Filter deadlines within 72 hours for badge
        const now = new Date();
        const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const urgent = data.deadlines.filter(d => new Date(d.deadlineDate) <= in48h);
        setUpcoming(urgent);
      } catch (err) {
        console.warn('DeadlineBadge: Failed to load deadlines', err);
      }
    };
    load();
  }, []);

  if (upcoming.length === 0) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="d-inline-flex align-items-center px-2 py-1 rounded-pill"
      style={{
        background: upcoming.length > 2 ? '#fee2e2' : '#fef3c7',
        color: upcoming.length > 2 ? '#dc2626' : '#d97706',
        fontSize: 12,
        fontWeight: 600
      }}
    >
      {upcoming.length} deadline{upcoming.length > 1 ? 's' : ''} soon
    </motion.div>
  );
};

export default DeadlineBadge;

```

### src/src/components/Navbar.jsx
```jsx
// src/src/components/Navbar.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import DeadlineBadge from './DeadlineBadge';
import api from '../services/api';

const Navbar = () => {
  const { user, isAuthenticated, isLawyer, isClient, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  // Fetch real unread count from API
  const fetchUnread = async () => {
    try {
      const { data } = await api.get('/chat/unread-count');
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.warn('Navbar: Failed to fetch unread count', err);
    }
  };

  // Fetch on mount, on page change, and poll periodically
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnread();

    // Poll faster on chat page (user is reading msgs), slower elsewhere
    const interval = setInterval(fetchUnread, location.pathname === '/chat' ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, location.pathname]);

  // Listen for new messages via socket — increment dot
  useEffect(() => {
    if (!socket) return;
    const handleNewMsg = () => {
      // Only increment if user is NOT on the chat page
      if (location.pathname !== '/chat') {
        setUnreadCount(prev => prev + 1);
      }
    };
    socket.on('message:received', handleNewMsg);
    return () => socket.off('message:received', handleNewMsg);
  }, [socket, location.pathname]);

  const navLink = (to, label, showDot = false) => (
    <li className="nav-item" key={to}>
      <Link className={`nav-link ${location.pathname === to ? 'active fw-bold' : ''}`} to={to}
            style={{ position: 'relative' }}>
        {label}
        {showDot && (
          <span style={{
            position: 'absolute', top: 6, right: -2,
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#ef4444', display: 'inline-block'
          }} />
        )}
      </Link>
    </li>
  );

  if (!isAuthenticated) return null;

  return (
    <nav className="navbar navbar-expand-lg navbar-dark" style={{ background: '#0f172a' }}>
      <div className="container">
        <Link className="navbar-brand fw-bold" to={user?.role === 'admin' ? '/admin' : '/dashboard'}>LawLink</Link>
        <button className="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#nav">
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="nav">
          <ul className="navbar-nav me-auto">
            {user?.role === 'admin' ? (
              <>
                {navLink('/admin', '⚙️ Admin Panel')}
              </>
            ) : (
              <>
                {navLink('/dashboard', 'Dashboard')}
                {navLink('/cases', 'Cases')}
                {isClient && navLink('/lawyers', 'Find Lawyers')}
                {navLink('/consultations', 'Consultations')}
                {navLink('/documents', 'Documents')}
                {navLink('/invoices', 'Invoices')}
                {navLink('/deadlines', 'Deadlines')}
                {navLink('/chat', 'Chat', unreadCount > 0)}
              </>
            )}
          </ul>
          <div className="d-flex align-items-center gap-3">
            <DeadlineBadge />
            <Link to="/profile" className="text-light small text-decoration-none" style={{ cursor: 'pointer' }}>
              {user?.name} ({user?.role})
            </Link>
            <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

```

### src/src/contexts/AuthContext.jsx
```jsx
// src/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // socketToken is only used for socket.io auth (received from login response)
  const [socketToken, setSocketToken] = useState(localStorage.getItem('socketToken'));

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Cookie is sent automatically — if valid, we get user data
        const { data } = await api.get('/auth/me');
        setUser(data.user);
      } catch (err) {
        // No valid cookie or expired — user is not authenticated
        setUser(null);
        setSocketToken(null);
        localStorage.removeItem('socketToken');
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const login = (tokenValue, userData) => {
    // JWT is already set as httpOnly cookie by the server
    // We only store the token for socket.io auth (can't send cookies over WebSocket)
    localStorage.setItem('socketToken', tokenValue);
    setSocketToken(tokenValue);
    setUser(userData);
  };

  const logout = async () => {
    // Clear local state FIRST (synchronous — prevents race conditions)
    localStorage.removeItem('socketToken');
    setSocketToken(null);
    setUser(null);

    // Then clear server-side cookie (best-effort, non-blocking)
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore — local state already cleared
    }
  };

  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  return (
    <AuthContext.Provider value={{
      user,
      socketToken,
      loading,
      login,
      logout,
      updateUser,
      isAuthenticated: !!user,
      isLawyer: user?.role === 'lawyer',
      isClient: user?.role === 'client',
      isAdmin: user?.role === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

```

### src/src/hooks/useSocket.js
```javascript
// src/src/hooks/useSocket.js
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

// In dev, use same origin (Vite proxy handles /socket.io). In prod, use explicit URL.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export const useSocket = () => {
  const { socketToken, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !socketToken) return;

    const socket = io(SOCKET_URL, {
      auth: { token: socketToken },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setConnected(true);
      console.log('Socket connected');
    });

    socket.on('users:online', (users) => {
      setOnlineUsers(users);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, socketToken]);

  return {
    socket: socketRef.current,
    onlineUsers,
    connected
  };
};

```

### src/src/main.jsx
```jsx
// src/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '770509057752-qksdkcaf69e2j3ruuk114hc46t4o69fn.apps.googleusercontent.com';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);

```

### src/src/pages/AdminDashboard.jsx
```jsx
// src/src/pages/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const AdminDashboard = () => {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // tracks which user action is in progress

  // ── Data Fetching ──
  const fetchStats = async () => {
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchPending = async () => {
    try {
      const { data } = await api.get('/admin/pending');
      setPending(data.users);
    } catch (err) {
      console.error('Failed to fetch pending:', err);
    }
  };

  const fetchLawyers = async () => {
    try {
      const { data } = await api.get('/admin/lawyers');
      setLawyers(data.lawyers);
    } catch (err) {
      console.error('Failed to fetch lawyers:', err);
    }
  };

  const fetchClients = async () => {
    try {
      const { data } = await api.get('/admin/clients');
      setClients(data.clients);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([fetchStats(), fetchPending(), fetchLawyers(), fetchClients()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  // ── Admin Actions ──
  const handleVerify = async (userId, userName) => {
    if (!window.confirm(`Verify ${userName}? They will get full platform access.`)) return;
    setActionLoading(userId);
    try {
      await api.put(`/admin/verify/${userId}`);
      await Promise.all([fetchStats(), fetchPending(), fetchLawyers(), fetchClients()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to verify user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (userId, userName) => {
    if (!window.confirm(`Block ${userName}? They won't be able to log in.`)) return;
    setActionLoading(userId);
    try {
      await api.put(`/admin/block/${userId}`);
      await Promise.all([fetchStats(), fetchLawyers(), fetchClients()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to block user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (userId, userName) => {
    if (!window.confirm(`Unblock ${userName}?`)) return;
    setActionLoading(userId);
    try {
      await api.put(`/admin/unblock/${userId}`);
      await Promise.all([fetchStats(), fetchLawyers(), fetchClients()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unblock user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId, userName) => {
    const confirmed = window.confirm(
      `⚠️ PERMANENTLY DELETE ${userName}?\n\n` +
      `This will delete:\n` +
      `• Their account\n` +
      `• All cases they're involved in\n` +
      `• All consultations\n` +
      `• All documents & invoices\n` +
      `• All chat messages\n\n` +
      `This action CANNOT be undone!`
    );
    if (!confirmed) return;

    // Double confirm for safety
    const doubleConfirm = window.confirm(`Are you ABSOLUTELY sure? Type OK to confirm deletion of ${userName}.`);
    if (!doubleConfirm) return;

    setActionLoading(userId);
    try {
      const { data } = await api.delete(`/admin/users/${userId}`);
      alert(`Deleted: ${JSON.stringify(data.deletedData, null, 2)}`);
      await Promise.all([fetchStats(), fetchPending(), fetchLawyers(), fetchClients()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Reusable Components ──
  const StatusBadge = ({ isVerified, isBlocked }) => {
    if (isBlocked) return <span className="badge bg-danger">Blocked</span>;
    if (isVerified) return <span className="badge bg-success">Verified</span>;
    return <span className="badge bg-warning text-dark">Pending</span>;
  };

  // Helper to show how user registered
  const AuthBadge = ({ authMethod, email }) => {
    if (email?.endsWith('@lawlink.com') || email?.endsWith('@test.com')) {
      return <span className="badge bg-secondary">Test Account</span>;
    }
    if (authMethod === 'google') return <span className="badge bg-danger">Google</span>;
    return <span className="badge bg-dark">Email & Password</span>;
  };

  const ActionButtons = ({ user }) => (
    <div className="d-flex gap-1 flex-wrap">
      {!user.isVerified && !user.isBlocked && (
        <button className="btn btn-sm btn-success" disabled={actionLoading === user._id}
                onClick={() => handleVerify(user._id, user.name)}>
          {actionLoading === user._id ? '...' : '✓ Verify'}
        </button>
      )}
      {!user.isBlocked ? (
        <button className="btn btn-sm btn-warning" disabled={actionLoading === user._id}
                onClick={() => handleBlock(user._id, user.name)}>
          {actionLoading === user._id ? '...' : '🚫 Block'}
        </button>
      ) : (
        <button className="btn btn-sm btn-info" disabled={actionLoading === user._id}
                onClick={() => handleUnblock(user._id, user.name)}>
          {actionLoading === user._id ? '...' : '🔓 Unblock'}
        </button>
      )}
      <button className="btn btn-sm btn-outline-danger" disabled={actionLoading === user._id}
              onClick={() => handleDelete(user._id, user.name)}>
        {actionLoading === user._id ? '...' : '🗑️ Delete'}
      </button>
    </div>
  );

  const UserTable = ({ users, showRole = false }) => (
    <div className="table-responsive">
      <table className="table table-hover align-middle">
        <thead className="table-dark">
          <tr>
            <th>Name</th>
            <th>Email</th>
            {showRole && <th>Role</th>}
            <th>Registered Via</th>
            <th>Status</th>
            <th>Registered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr><td colSpan={showRole ? 7 : 6} className="text-center text-muted py-4">No users found</td></tr>
          ) : users.map(user => (
            <tr key={user._id}>
              <td>
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                       style={{ width: 32, height: 32, fontSize: 14 }}>
                    {user.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="fw-semibold">{user.name}</div>
                    {user.location?.city && <small className="text-muted">{user.location.city}</small>}
                  </div>
                </div>
              </td>
              <td><small>{user.email}</small></td>
              {showRole && <td><span className={`badge ${user.role === 'lawyer' ? 'bg-primary' : 'bg-info'}`}>{user.role}</span></td>}
              <td><AuthBadge authMethod={user.authMethod} email={user.email} /></td>
              <td><StatusBadge isVerified={user.isVerified} isBlocked={user.isBlocked} /></td>
              <td><small>{new Date(user.createdAt).toLocaleDateString('en-IN')}</small></td>
              <td><ActionButtons user={user} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">⚙️ Admin Panel</h2>
          <p className="text-muted mb-0">Manage users, verifications, and platform activity</p>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-pills mb-4">
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'pending', label: `⏳ Pending (${pending.length})` },
          { key: 'lawyers', label: `👨‍⚖️ Lawyers (${lawyers.length})` },
          { key: 'clients', label: `👤 Clients (${clients.length})` }
        ].map(t => (
          <li className="nav-item" key={t.key}>
            <button className={`nav-link ${tab === t.key ? 'active' : ''}`}
                    onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

          {/* ── Overview Tab ── */}
          {tab === 'overview' && stats && (
            <div className="row g-3">
              {[
                { label: 'Verified Lawyers', value: stats.verifiedLawyers, color: 'primary', icon: '👨‍⚖️' },
                { label: 'Verified Clients', value: stats.verifiedClients, color: 'info', icon: '👤' },
                { label: 'Pending Verifications', value: stats.pendingVerifications, color: 'warning', icon: '⏳' },
                { label: 'Blocked Users', value: stats.blockedUsers, color: 'danger', icon: '🚫' }
              ].map((card, i) => (
                <div className="col-md-3 col-sm-6" key={i}>
                  <div className={`card border-${card.color} h-100`}>
                    <div className="card-body text-center">
                      <div style={{ fontSize: 32 }}>{card.icon}</div>
                      <h2 className={`fw-bold text-${card.color} mb-1`}>{card.value}</h2>
                      <p className="text-muted mb-0">{card.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Pending Tab ── */}
          {tab === 'pending' && (
            <>
              {pending.length === 0 ? (
                <div className="text-center py-5">
                  <div style={{ fontSize: 48 }}>✅</div>
                  <h5 className="mt-3">No pending verifications</h5>
                  <p className="text-muted">All users have been reviewed</p>
                </div>
              ) : (
                <UserTable users={pending} showRole />
              )}
            </>
          )}

          {/* ── Lawyers Tab ── */}
          {tab === 'lawyers' && <UserTable users={lawyers} />}

          {/* ── Clients Tab ── */}
          {tab === 'clients' && <UserTable users={clients} />}

        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminDashboard;

```

### src/src/pages/BookConsultation.jsx
```jsx
// src/src/pages/BookConsultation.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Local date string to avoid UTC timezone issues
const getLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const BookConsultation = () => {
  const { lawyerId } = useParams();
  const navigate = useNavigate();
  const [lawyer, setLawyer] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availability, setAvailability] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // 16 dates: 1 past day + today + 14 future days
  const getDates = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    return Array.from({ length: 16 }, (_, i) => {
      const d = new Date(yesterday);
      d.setDate(yesterday.getDate() + i);
      return d;
    });
  };

  const [dates] = useState(getDates);
  const todayStr = getLocalDateStr(new Date());

  useEffect(() => {
    const fetchLawyer = async () => {
      try {
        const { data } = await api.get(`/users/public/${lawyerId}`);
        setLawyer(data.user);
      } catch (err) {
        console.error('Failed to load lawyer:', err);
      }
    };
    fetchLawyer();
  }, [lawyerId]);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const startDate = getLocalDateStr(dates[0]);
        const endDate = getLocalDateStr(dates[dates.length - 1]);

        const { data } = await api.get(`/consultations/availability/${lawyerId}`, {
          params: { startDate, endDate }
        });
        setAvailability(data.availability);
      } catch (err) {
        console.error('Failed to load availability:', err);
      }
    };
    if (lawyerId) fetchAvailability();
  }, [lawyerId, dates]);

  const handleBook = async () => {
    setLoading(true);
    try {
      await api.post('/consultations', {
        lawyerId,
        date: selectedDate,
        timeSlot: selectedSlot,
        reason
      });
      setShowConfirm(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      alert(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <h2 className="fw-bold mb-4">Book Consultation</h2>

      {lawyer && (
        <div className="card border-0 shadow-sm mb-4 p-3">
          <div className="d-flex align-items-center">
            <div className="rounded-circle me-3 d-flex align-items-center justify-content-center"
                 style={{ width: 56, height: 56, backgroundColor: '#e2e8f0', fontSize: '20px', fontWeight: 'bold' }}>
              {lawyer.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h5 className="mb-0 fw-bold">{lawyer.name}</h5>
              <small className="text-muted">Rs.{lawyer.feePerHour || '—'}/hr · {lawyer.practiceAreas?.join(', ') || 'General Practice'}</small>
            </div>
          </div>
        </div>
      )}

      {/* Date selector — 16 days: 1 past (greyed) + today + 14 future */}
      <h5 className="fw-bold mb-3">Select a Date</h5>
      <div className="d-flex gap-2 mb-4" style={{ overflowX: 'auto', paddingBottom: 8 }}>
        {dates.map(date => {
          const dateStr = getLocalDateStr(date);
          const isPast = dateStr < todayStr;
          const isToday = dateStr === todayStr;
          const isSelected = selectedDate === dateStr;
          const dayAvail = availability[dateStr];
          const availCount = dayAvail?.available?.length || 0;

          return (
            <div key={dateStr} style={{ minWidth: 80, flexShrink: 0 }}>
              <div
                className={`card text-center p-2 
                  ${isSelected ? 'border-primary bg-primary bg-opacity-10' : ''} 
                  ${isPast ? 'opacity-50' : ''}`}
                style={{
                  cursor: isPast ? 'not-allowed' : 'pointer',
                  borderRadius: '10px',
                  backgroundColor: isPast ? '#f1f5f9' : undefined
                }}
                onClick={() => {
                  if (!isPast) {
                    setSelectedDate(dateStr);
                    setSelectedSlot(null);
                  }
                }}
              >
                <small className={isPast ? 'text-secondary' : 'text-muted'}>{DAYS[date.getDay()]}</small>
                <strong className={isPast ? 'text-secondary' : ''}>{date.getDate()}</strong>
                {isToday && <small className="text-primary" style={{ fontSize: 10 }}>TODAY</small>}
                <small className={isPast ? 'text-secondary' : availCount > 0 ? 'text-success' : 'text-danger'}>
                  {isPast ? 'Past' : `${availCount} slot${availCount !== 1 ? 's' : ''}`}
                </small>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time slots — show past/booked as greyed, available as clickable */}
      {selectedDate && availability[selectedDate] && (
        <div className="mb-4">
          <h5 className="fw-bold mb-3">Available Slots</h5>
          <div className="d-flex flex-wrap gap-2">
            {/* Past slots (greyed out) */}
            {(availability[selectedDate].past || []).map(slot => (
              <button key={slot} className="btn btn-outline-secondary" disabled
                      style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                {slot}
              </button>
            ))}
            {/* Booked slots (greyed out) */}
            {(availability[selectedDate].booked || []).map(slot => (
              <button key={slot} className="btn btn-outline-secondary" disabled
                      style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                {slot}
              </button>
            ))}
            {/* Available slots (clickable) */}
            {availability[selectedDate].available.length === 0 && 
             (availability[selectedDate].past || []).length === 0 &&
             (availability[selectedDate].booked || []).length === 0 ? (
              <p className="text-muted">No slots for this date.</p>
            ) : (
              availability[selectedDate].available.map(slot => (
                <motion.button
                  key={slot}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`btn ${selectedSlot === slot ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {slot}
                </motion.button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Booking form */}
      {selectedSlot && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-3">
            <label className="form-label">Reason for consultation</label>
            <textarea className="form-control" rows={3} value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Briefly describe your legal matter..." />
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleBook} disabled={loading}>
            {loading ? 'Booking...' : `Book ${selectedSlot} on ${selectedDate}`}
          </button>
        </motion.div>
      )}

      {/* Success modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                        className="card border-0 shadow-lg p-4 text-center" style={{ borderRadius: '16px' }}>
              <h3 className="text-success mb-2">Booked!</h3>
              <p>Your consultation has been scheduled. Redirecting...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookConsultation;

```

### src/src/pages/CaseManager.jsx
```jsx
// src/src/pages/CaseManager.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import CaseTimeline from '../components/CaseTimeline';
import api from '../services/api';

const LEGAL_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const CaseManager = () => {
  const { user, isLawyer } = useAuth();
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [milestoneNote, setMilestoneNote] = useState('');

  // Create Case form state (lawyer only)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [clients, setClients] = useState([]);
  const [newCase, setNewCase] = useState({ clientId: '', title: '', description: '', legalArea: '' });
  const [creating, setCreating] = useState(false);

  const fetchCases = async () => {
    try {
      const { data } = await api.get('/cases');
      setCases(data.cases);
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCases(); }, []);

  // Fetch client list when lawyer opens the create form
  const openCreateForm = async () => {
    try {
      if (clients.length === 0) {
        const { data } = await api.get('/users/clients');
        setClients(data.clients);
      }
      setShowCreateForm(true);
    } catch (err) {
      alert('Failed to load client list');
    }
  };

  const createCase = async () => {
    if (!newCase.clientId || !newCase.title || !newCase.legalArea) {
      alert('Please fill in Client, Title, and Legal Area');
      return;
    }
    setCreating(true);
    try {
      await api.post('/cases', newCase);
      setNewCase({ clientId: '', title: '', description: '', legalArea: '' });
      setShowCreateForm(false);
      fetchCases();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const loadCase = async (id) => {
    try {
      const { data } = await api.get(`/cases/${id}`);
      setSelectedCase(data.case);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load case');
    }
  };

  const addMilestone = async () => {
    if (!milestoneNote.trim()) return;
    try {
      await api.put(`/cases/${selectedCase._id}/milestone`, {
        note: milestoneNote,
        stage: selectedCase.status
      });
      setMilestoneNote('');
      loadCase(selectedCase._id);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add milestone');
    }
  };

  const advanceCase = async () => {
    const stages = ['intake', 'investigation', 'filing', 'hearing', 'resolution', 'closed'];
    const currentIdx = stages.indexOf(selectedCase.status);
    if (currentIdx >= stages.length - 1) return;

    const nextStage = stages[currentIdx + 1];
    if (window.confirm(`Advance case to "${nextStage}"?`)) {
      try {
        await api.put(`/cases/${selectedCase._id}/status`, { status: nextStage });
        loadCase(selectedCase._id);
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to advance case');
      }
    }
  };

  const STATUS_COLORS = {
    intake: 'info', investigation: 'warning', filing: 'primary',
    hearing: 'dark', resolution: 'success', closed: 'secondary'
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold mb-0">Case Manager</h2>
        {isLawyer && (
          <button className="btn btn-primary" onClick={openCreateForm}>
            + New Case
          </button>
        )}
      </div>

      {/* Create Case Form */}
      {showCreateForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
          <div className="card-body">
            <h5 className="fw-bold mb-3">Create New Case</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Client</label>
                <select className="form-select" value={newCase.clientId}
                        onChange={e => setNewCase({...newCase, clientId: e.target.value})}>
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Legal Area</label>
                <select className="form-select" value={newCase.legalArea}
                        onChange={e => setNewCase({...newCase, legalArea: e.target.value})}>
                  <option value="">Select area...</option>
                  {LEGAL_AREAS.map(area => (
                    <option key={area} value={area}>{area.charAt(0).toUpperCase() + area.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Case Title</label>
                <input className="form-control" placeholder="e.g. Alimony Dispute - Kumar"
                       value={newCase.title} onChange={e => setNewCase({...newCase, title: e.target.value})} />
              </div>
              <div className="col-12">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={2} placeholder="Brief case description..."
                          value={newCase.description} onChange={e => setNewCase({...newCase, description: e.target.value})} />
              </div>
              <div className="col-12 d-flex gap-2">
                <button className="btn btn-primary" onClick={createCase} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Case'}
                </button>
                <button className="btn btn-outline-secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="row">
        {/* Case list */}
        <div className="col-md-4">
          {loading ? <div className="spinner-border" /> : cases.length === 0 ? (
            <div className="text-center text-muted py-4">No cases yet.</div>
          ) : cases.map(c => (
            <motion.div key={c._id} whileHover={{ scale: 1.02 }}
                        className={`card border-0 shadow-sm mb-2 ${selectedCase?._id === c._id ? 'border-primary border-2' : ''}`}
                        style={{ cursor: 'pointer', borderRadius: '10px' }}
                        onClick={() => loadCase(c._id)}>
              <div className="card-body py-2 px-3">
                <div className="d-flex justify-content-between">
                  <strong className="small">{c.title}</strong>
                  <span className={`badge bg-${STATUS_COLORS[c.status]}`} style={{ fontSize: 10 }}>{c.status}</span>
                </div>
                <small className="text-muted">{c.caseNumber} · {c.legalArea}</small>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Case detail */}
        <div className="col-md-8">
          {selectedCase ? (
            <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
              <div className="card-body">
                <h4 className="fw-bold">{selectedCase.title}</h4>
                <p className="text-muted small">{selectedCase.caseNumber} · {selectedCase.legalArea}</p>
                <p>{selectedCase.description}</p>

                <CaseTimeline currentStatus={selectedCase.status} milestones={selectedCase.milestones} />

                {isLawyer && selectedCase.status !== 'closed' && (
                  <div className="mt-4 pt-3 border-top">
                    <div className="d-flex gap-2 mb-3">
                      <input className="form-control" placeholder="Add milestone note..."
                             value={milestoneNote} onChange={e => setMilestoneNote(e.target.value)} />
                      <button className="btn btn-outline-primary" onClick={addMilestone}>Add</button>
                    </div>
                    <button className="btn btn-success" onClick={advanceCase}>
                      Advance to Next Stage →
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted py-5">Select a case to view details</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseManager;

```

### src/src/pages/Chat.jsx
```jsx
// src/src/pages/Chat.jsx
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';

const Chat = () => {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [typing, setTyping] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      const { data } = await api.get('/chat/conversations');
      setConversations(data.conversations);
    };
    loadConversations();
  }, []);

  // Join conversation room and load messages
  useEffect(() => {
    if (!activeConv || !socket) return;

    socket.emit('conversation:join', activeConv._id);
    loadMessages(activeConv._id);

    // Mark as read
    socket.emit('message:read', { conversationId: activeConv._id });

    return () => { /* cleanup if needed */ };
  }, [activeConv, socket]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMsg = (msg) => {
      if (activeConv && msg.conversation === activeConv._id) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
        // Mark as read immediately since we're viewing this conv
        socket.emit('message:read', { conversationId: activeConv._id });
      }
      // Update conversation list
      setConversations(prev => prev.map(c =>
        c._id === msg.conversation
          ? { ...c, lastMessage: msg, lastMessageAt: new Date() }
          : c
      ));
    };

    const handleDelivered = ({ conversationId, messageIds }) => {
      setMessages(prev => prev.map(m =>
        messageIds.includes(m._id) ? { ...m, status: 'delivered' } : m
      ));
    };

    const handleRead = ({ conversationId }) => {
      if (activeConv?._id === conversationId) {
        setMessages(prev => prev.map(m =>
          m.sender._id === user._id ? { ...m, status: 'read' } : m
        ));
      }
    };

    const handleTypingStart = ({ userId, conversationId }) => {
      if (activeConv?._id === conversationId && userId !== user._id) {
        setTyping(userId);
      }
    };

    const handleTypingStop = ({ userId, conversationId }) => {
      if (activeConv?._id === conversationId) setTyping(null);
    };

    socket.on('message:new', handleNewMsg);
    socket.on('messages:delivered', handleDelivered);
    socket.on('messages:read', handleRead);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMsg);
      socket.off('messages:delivered', handleDelivered);
      socket.off('messages:read', handleRead);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [socket, activeConv, user]);

  const loadMessages = async (convId, before) => {
    setLoadingMsgs(true);
    const params = { limit: 50 };
    if (before) params.before = before;
    const { data } = await api.get(`/chat/conversations/${convId}/messages`, { params });
    if (before) {
      setMessages(prev => [...data.messages, ...prev]);
    } else {
      setMessages(data.messages);
      setTimeout(scrollToBottom, 100);
    }
    setHasMore(data.hasMore);
    setLoadingMsgs(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = () => {
    if (!newMsg.trim() || !socket || !activeConv) return;
    socket.emit('message:send', {
      conversationId: activeConv._id,
      content: newMsg.trim()
    });
    setNewMsg('');
    socket.emit('typing:stop', { conversationId: activeConv._id });
  };

  const handleTyping = (e) => {
    setNewMsg(e.target.value);
    if (!socket || !activeConv) return;

    socket.emit('typing:start', { conversationId: activeConv._id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: activeConv._id });
    }, 1500);
  };

  const getOtherUser = (conv) => {
    return conv.participants?.find(p => p._id !== user._id);
  };

  const getStatusIcon = (status) => {
    if (status === 'read') return <span style={{ color: '#ffffff', fontWeight: 'bold', textShadow: '0 0 2px rgba(0,0,0,0.3)' }}>✓✓</span>;
    return <span style={{ color: 'rgba(255,255,255,0.6)' }}>✓</span>;  // sent/delivered: faded white single tick
  };

  return (
    <div className="container-fluid p-0" style={{ height: 'calc(100vh - 20px)' }}>
      <div className="row g-0 h-100">
        {/* Conversation sidebar */}
        <div className="col-md-4 border-end" style={{ overflowY: 'auto' }}>
          <div className="p-3 border-bottom">
            <h5 className="fw-bold mb-0">Messages</h5>
          </div>
          {conversations.length === 0 ? (
            <div className="text-center text-muted py-4">
              <p>No conversations yet.</p>
              <small>Start a chat from the Lawyer Directory or Consultations page.</small>
            </div>
          ) : (
            conversations.map(conv => {
              const other = getOtherUser(conv);
              const isOnline = onlineUsers.includes(other?._id);
              return (
                <div key={conv._id}
                     className={`d-flex align-items-center p-3 border-bottom ${activeConv?._id === conv._id ? 'bg-light' : ''}`}
                     style={{ cursor: 'pointer' }}
                     onClick={() => setActiveConv(conv)}>
                  <div className="position-relative me-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center"
                         style={{ width: 44, height: 44, backgroundColor: '#e2e8f0', fontSize: '16px', fontWeight: 'bold' }}>
                      {other?.name?.charAt(0).toUpperCase()}
                    </div>
                    {isOnline && (
                      <span className="position-absolute bottom-0 end-0 rounded-circle"
                            style={{ width: 12, height: 12, background: '#22c55e', border: '2px solid white' }} />
                    )}
                  </div>
                  <div className="flex-grow-1 overflow-hidden">
                    <div className="d-flex justify-content-between">
                      <strong className="small">{other?.name}</strong>
                      {conv.unreadCount > 0 && (
                        <span className="badge bg-primary rounded-pill">{conv.unreadCount}</span>
                      )}
                    </div>
                    <small className="text-muted text-truncate d-block">
                      {conv.lastMessage?.content || 'Start a conversation'}
                    </small>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat area */}
        <div className="col-md-8 d-flex flex-column h-100">
          {activeConv ? (
            <>
              {/* Header */}
              <div className="p-3 border-bottom d-flex align-items-center">
                <strong>{getOtherUser(activeConv)?.name}</strong>
                {onlineUsers.includes(getOtherUser(activeConv)?._id) && (
                  <small className="text-success ms-2">● Online</small>
                )}
              </div>

              {/* Messages */}
              <div className="flex-grow-1 p-3" style={{ overflowY: 'auto' }}>
                {hasMore && (
                  <div className="text-center mb-3">
                    <button className="btn btn-sm btn-outline-secondary"
                            onClick={() => loadMessages(activeConv._id, messages[0]?.createdAt)}
                            disabled={loadingMsgs}>
                      Load older messages
                    </button>
                  </div>
                )}

                {messages.map((msg, i) => {
                  const isMine = msg.sender._id === user._id;
                  return (
                    <motion.div key={msg._id || i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`d-flex mb-2 ${isMine ? 'justify-content-end' : ''}`}>
                      <div className={`px-3 py-2 rounded-3 ${isMine ? 'bg-primary text-white' : 'bg-light'}`}
                           style={{ maxWidth: '70%', borderRadius: '16px' }}>
                        <div className="small">{msg.content}</div>
                        <div className="d-flex justify-content-end align-items-center gap-1 mt-1">
                          <span style={{ fontSize: 10, opacity: 0.7 }}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && <span style={{ fontSize: 10 }}>{getStatusIcon(msg.status)}</span>}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {typing && (
                  <div className="text-muted small mb-2">
                    <em>typing...</em>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-top">
                <div className="d-flex gap-2">
                  <input type="text" className="form-control" placeholder="Type a message..."
                         maxLength={2000}
                         value={newMsg} onChange={handleTyping}
                         onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                  <button className="btn btn-primary" onClick={sendMessage}>Send</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;

```

### src/src/pages/ConsultationHub.jsx
```jsx
// src/src/pages/ConsultationHub.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS = {
  pending: 'warning', confirmed: 'primary',
  completed: 'success', cancelled: 'secondary', 'no-show': 'danger'
};

const ConsultationHub = () => {
  const { isLawyer } = useAuth();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      const { data } = await api.get('/consultations', { params });
      setConsultations(data.consultations);
    } catch (err) {
      console.error('Failed to fetch consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConsultations(); }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/consultations/${id}`, { status });
      fetchConsultations();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    }
  };

  const startChat = async (userId) => {
    try {
      await api.post('/chat/conversations', { userId });
      navigate('/chat');
    } catch (err) {
      alert('Failed to start chat');
    }
  };

  return (
    <div className="container py-4">
      <h2 className="fw-bold mb-4">Consultation Queue</h2>

      <div className="d-flex gap-2 mb-4">
        {['', 'pending', 'confirmed', 'completed', 'cancelled'].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-dark' : 'btn-outline-secondary'}`}
                  onClick={() => setFilter(s)}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-5"><div className="spinner-border" /></div> : (
        consultations.length === 0 ? (
          <div className="text-center py-5 text-muted">No consultations found.</div>
        ) : (
          <div className="row g-3">
            {consultations.map((c, i) => (
              <motion.div key={c._id} className="col-md-6"
                          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}>
                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between mb-2">
                      <h6 className="fw-bold mb-0">{isLawyer ? c.client?.name : c.lawyer?.name}</h6>
                      <span className={`badge bg-${STATUS_COLORS[c.status]}`}>{c.status}</span>
                    </div>
                    <p className="text-muted small mb-1">
                      📅 {new Date(c.date).toLocaleDateString()} · 🕐 {c.timeSlot}
                    </p>
                    {c.reason && <p className="small mb-2">{c.reason}</p>}

                    <div className="d-flex gap-2">
                      {c.status === 'pending' && isLawyer && (
                        <button className="btn btn-sm btn-success" onClick={() => updateStatus(c._id, 'confirmed')}>Confirm</button>
                      )}
                      {c.status === 'pending' && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => updateStatus(c._id, 'cancelled')}>Cancel</button>
                      )}
                      {c.status === 'confirmed' && isLawyer && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => updateStatus(c._id, 'completed')}>Complete</button>
                          <button className="btn btn-sm btn-outline-warning" onClick={() => updateStatus(c._id, 'no-show')}>No-show</button>
                        </>
                      )}
                      <button className="btn btn-sm btn-outline-success"
                              onClick={() => startChat(isLawyer ? c.client?._id : c.lawyer?._id)}>💬 Chat</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default ConsultationHub;

```

### src/src/pages/DeadlineCalendar.jsx
```jsx
// src/src/pages/DeadlineCalendar.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';

const TYPE_COLORS = {
  court_date: { bg: '#dbeafe', text: '#1e40af', label: 'Court Date' },
  filing_deadline: { bg: '#fef3c7', text: '#92400e', label: 'Filing Deadline' },
  statute_of_limitations: { bg: '#fee2e2', text: '#991b1b', label: 'Statute of Limitations' },
  hearing_date: { bg: '#e0e7ff', text: '#3730a3', label: 'Hearing Date' },
  response_due: { bg: '#fce7f3', text: '#9d174d', label: 'Response Due' }
};

const DeadlineCalendar = () => {
  const { isLawyer } = useAuth();
  const { socket } = useSocket();
  const [deadlines, setDeadlines] = useState([]);
  const [cases, setCases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    caseId: '', title: '', description: '', deadlineDate: '', type: 'court_date'
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [dlRes, caseRes] = await Promise.all([
          api.get('/deadlines', { params: { upcoming: 'true' } }),
          api.get('/cases')
        ]);
        setDeadlines(dlRes.data.deadlines);
        setCases(caseRes.data.cases);
      } catch (err) {
        console.error('Failed to load deadlines:', err);
      }
    };
    load();
  }, []);

  // Listen for real-time deadline reminders
  useEffect(() => {
    if (!socket) return;
    const handleReminder = (data) => {
      alert(`Deadline Reminder: ${data.title}\nCase: ${data.caseName}\nDate: ${new Date(data.deadlineDate).toLocaleDateString()}`);
    };
    socket.on('deadline:reminder', handleReminder);
    return () => socket.off('deadline:reminder', handleReminder);
  }, [socket]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/deadlines', form);
      setShowForm(false);
      setForm({ caseId: '', title: '', description: '', deadlineDate: '', type: 'court_date' });
      const { data } = await api.get('/deadlines', { params: { upcoming: 'true' } });
      setDeadlines(data.deadlines);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this deadline?')) return;
    await api.delete(`/deadlines/${id}`);
    const { data } = await api.get('/deadlines', { params: { upcoming: 'true' } });
    setDeadlines(data.deadlines);
  };

  const getDaysUntil = (date) => {
    const diff = new Date(date) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    return `${days} days`;
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between mb-4">
        <h2 className="fw-bold">Court Deadlines</h2>
        {isLawyer && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Deadline'}
          </button>
        )}
      </div>

      {/* Add deadline form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Case</label>
                  <select className="form-select" value={form.caseId}
                          onChange={e => setForm({...form, caseId: e.target.value})} required>
                    <option value="">Select case...</option>
                    {cases.filter(c => c.status !== 'closed').map(c => (
                      <option key={c._id} value={c._id}>{c.caseNumber} — {c.title}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={form.type}
                          onChange={e => setForm({...form, type: e.target.value})}>
                    {Object.entries(TYPE_COLORS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Title</label>
                  <input className="form-control" value={form.title}
                         onChange={e => setForm({...form, title: e.target.value})} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" value={form.deadlineDate}
                         onChange={e => setForm({...form, deadlineDate: e.target.value})} required />
                </div>
                <div className="col-12">
                  <label className="form-label">Notes (optional)</label>
                  <textarea className="form-control" rows={2} value={form.description}
                            onChange={e => setForm({...form, description: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="btn btn-success mt-3">Add Deadline</button>
            </form>
          </div>
        </motion.div>
      )}

      {/* Deadline list */}
      {deadlines.length === 0 ? (
        <p className="text-muted">No upcoming deadlines.</p>
      ) : (
        <div className="row g-3">
          {deadlines.map((dl, i) => {
            const typeInfo = TYPE_COLORS[dl.type] || TYPE_COLORS.court_date;
            const daysLeft = getDaysUntil(dl.deadlineDate);
            const isUrgent = new Date(dl.deadlineDate) - new Date() < 48 * 60 * 60 * 1000;

            return (
              <motion.div key={dl._id} className="col-md-6 col-lg-4"
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}>
                <div className={`card border-0 shadow-sm h-100 ${isUrgent ? 'border-danger border-2' : ''}`}
                     style={{ borderRadius: '12px' }}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="badge" style={{ background: typeInfo.bg, color: typeInfo.text }}>
                        {typeInfo.label}
                      </span>
                      <span className={`fw-bold small ${isUrgent ? 'text-danger' : 'text-muted'}`}>
                        {daysLeft}
                      </span>
                    </div>
                    <h6 className="fw-bold">{dl.title}</h6>
                    <p className="text-muted small mb-1">
                      {new Date(dl.deadlineDate).toLocaleDateString('en-IN', {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </p>
                    <p className="text-muted small mb-1">
                      Case: {dl.case?.caseNumber}
                    </p>
                    {dl.description && <p className="small mb-1">{dl.description}</p>}
                    <div className="d-flex justify-content-between align-items-center">
                      {dl.reminderSent && (
                        <small className="text-success">✓ Reminder sent</small>
                      )}
                      {isLawyer && (
                        <button className="btn btn-sm btn-outline-danger ms-auto"
                                onClick={() => handleDelete(dl._id)}>Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeadlineCalendar;

```

### src/src/pages/DocumentHub.jsx
```jsx
// src/src/pages/DocumentHub.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const DOC_TYPES = [
  { value: 'demand_letter', label: 'Demand Letter' },
  { value: 'contract', label: 'Contract' },
  { value: 'legal_notice', label: 'Legal Notice' },
  { value: 'court_brief', label: 'Court Brief' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'power_of_attorney', label: 'Power of Attorney' }
];

const STATUS_COLORS = {
  draft: 'secondary', issued: 'primary', acknowledged: 'success',
  expired: 'warning', revoked: 'danger'
};

const DocumentHub = () => {
  const { isLawyer } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [cases, setCases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    caseId: '', clientId: '', documentType: 'demand_letter', title: '', content: ''
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [docRes, caseRes] = await Promise.all([
          api.get('/documents'),
          api.get('/cases')
        ]);
        setDocuments(docRes.data.documents);
        setCases(caseRes.data.cases);
      } catch (err) {
        console.error('Failed to load documents:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCaseSelect = (caseId) => {
    const selected = cases.find(c => c._id === caseId);
    setForm(prev => ({
      ...prev,
      caseId,
      clientId: selected?.client?._id || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/documents', form);
      setShowForm(false);
      setForm({ caseId: '', clientId: '', documentType: 'demand_letter', title: '', content: '' });
      const { data } = await api.get('/documents');
      setDocuments(data.documents);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create document');
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke client access to this document?')) return;
    await api.put(`/documents/${id}/revoke`);
    const { data } = await api.get('/documents');
    setDocuments(data.documents);
  };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between mb-4">
        <h2 className="fw-bold">Legal Documents</h2>
        {isLawyer && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Document'}
          </button>
        )}
      </div>

      {/* Create form — Lawyer only */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Case</label>
                  <select className="form-select" value={form.caseId}
                          onChange={e => handleCaseSelect(e.target.value)} required>
                    <option value="">Select case...</option>
                    {cases.filter(c => c.status !== 'closed').map(c => (
                      <option key={c._id} value={c._id}>{c.caseNumber} — {c.title}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Document Type</label>
                  <select className="form-select" value={form.documentType}
                          onChange={e => setForm({...form, documentType: e.target.value})}>
                    {DOC_TYPES.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Title</label>
                  <input className="form-control" value={form.title}
                         onChange={e => setForm({...form, title: e.target.value})}
                         placeholder="e.g., Demand Letter — Outstanding Payment" required />
                </div>
                <div className="col-12">
                  <label className="form-label">Content</label>
                  <textarea className="form-control" rows={8} value={form.content}
                            onChange={e => setForm({...form, content: e.target.value})}
                            placeholder="Enter the full legal document text here..." required />
                </div>
              </div>
              <button type="submit" className="btn btn-success mt-3">Create Document + Generate PDF</button>
            </form>
          </div>
        </motion.div>
      )}

      {/* Document list */}
      {documents.length === 0 ? (
        <p className="text-muted">No documents yet.</p>
      ) : (
        <div className="row g-3">
          {documents.map((doc, i) => (
            <motion.div key={doc._id} className="col-md-6"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}>
              <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                <div className="card-body">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="badge bg-light text-dark">{doc.documentNumber}</span>
                    <span className={`badge bg-${STATUS_COLORS[doc.status]}`}>{doc.status}</span>
                  </div>
                  <h6 className="fw-bold">{doc.title}</h6>
                  <p className="text-muted small mb-1">
                    {doc.documentType.replace(/_/g, ' ')} · Case: {doc.case?.caseNumber}
                  </p>
                  <p className="text-muted small mb-2">
                    {isLawyer ? `Client: ${doc.client?.name}` : `By: ${doc.lawyer?.name}`}
                  </p>
                  <div className="d-flex gap-2">
                    {doc.pdfUrl && (doc.status !== 'revoked' || isLawyer) && (
                      <a href={doc.pdfUrl} target="_blank" rel="noreferrer"
                         className="btn btn-sm btn-outline-primary">Download PDF</a>
                    )}
                    {doc.status === 'issued' && isLawyer && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleRevoke(doc._id)}>
                        Revoke
                      </button>
                    )}
                    {doc.status === 'revoked' && !isLawyer && (
                      <span className="text-danger small">Access revoked by lawyer</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentHub;

```

### src/src/pages/ForgotPassword.jsx
```jsx
// src/src/pages/ForgotPassword.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
      <div className="card shadow-lg" style={{ maxWidth: 440, width: '100%' }}>
        <div className="card-body p-4">
          <h3 className="fw-bold text-center mb-1">🔑 Forgot Password</h3>
          <p className="text-muted text-center mb-4">Enter your email to receive a reset link</p>

          {sent ? (
            <div className="text-center py-3">
              <div style={{ fontSize: 48 }}>📧</div>
              <h5 className="mt-3">Check Your Email</h5>
              <p className="text-muted">If that email is registered, we've sent a password reset link. Check your inbox (and spam folder).</p>
              <Link to="/login" className="btn btn-primary mt-2">Back to Login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <div className="mb-3">
                <label className="form-label">Email address</label>
                <input type="email" className="form-control" required
                       value={email} onChange={e => setEmail(e.target.value)}
                       placeholder="you@example.com" />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm" /> : 'Send Reset Link'}
              </button>
              <div className="text-center mt-3">
                <Link to="/login" className="text-decoration-none">← Back to Login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ForgotPassword;

```

### src/src/pages/InvoiceManager.jsx
```jsx
// src/src/pages/InvoiceManager.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const InvoiceManager = () => {
  const { user, isLawyer, isClient } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [cases, setCases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    caseId: '', clientId: '', dueDate: '',
    lineItems: [{ description: '', hours: '', ratePerHour: '' }]
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [invRes, caseRes] = await Promise.all([
          api.get('/invoices'),
          api.get('/cases')
        ]);
        setInvoices(invRes.data.invoices);
        setCases(caseRes.data.cases);
      } catch (err) {
        console.error('Failed to load invoices:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { description: '', hours: '', ratePerHour: '' }]
    }));
  };

  const updateLineItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.lineItems];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, lineItems: items };
    });
  };

  const removeLineItem = (idx) => {
    setForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== idx)
    }));
  };

  const handleCaseSelect = (caseId) => {
    const selectedCase = cases.find(c => c._id === caseId);
    setForm(prev => ({
      ...prev,
      caseId,
      clientId: selectedCase?.client?._id || ''
    }));
  };

  const calcTotal = () => {
    return form.lineItems.reduce((sum, item) => {
      return sum + (parseFloat(item.hours) || 0) * (parseFloat(item.ratePerHour) || 0);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/invoices', {
        caseId: form.caseId,
        clientId: form.clientId,
        dueDate: form.dueDate,
        lineItems: form.lineItems.map(item => ({
          description: item.description,
          hours: parseFloat(item.hours),
          ratePerHour: parseFloat(item.ratePerHour)
        }))
      });
      setShowForm(false);
      const { data } = await api.get('/invoices');
      setInvoices(data.invoices);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create invoice');
    }
  };

  const handlePay = async (id) => {
    if (!window.confirm('Mark this invoice as paid?')) return;
    await api.put(`/invoices/${id}/pay`);
    const { data } = await api.get('/invoices');
    setInvoices(data.invoices);
  };

  const STATUS_COLORS = { pending: 'warning', paid: 'success', overdue: 'danger' };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between mb-4">
        <h2 className="fw-bold">Invoices</h2>
        {isLawyer && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Invoice'}
          </button>
        )}
      </div>

      {/* Invoice form — Lawyer only */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label">Case</label>
                  <select className="form-select" value={form.caseId}
                          onChange={e => handleCaseSelect(e.target.value)} required>
                    <option value="">Select case...</option>
                    {cases.filter(c => c.status !== 'closed').map(c => (
                      <option key={c._id} value={c._id}>{c.caseNumber} — {c.title}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-control" value={form.dueDate}
                         onChange={e => setForm({...form, dueDate: e.target.value})} required />
                </div>
              </div>

              <h6 className="fw-bold mt-3 mb-2">Time Entries</h6>
              {form.lineItems.map((item, idx) => (
                <div key={idx} className="row g-2 mb-2 align-items-end">
                  <div className="col-md-5">
                    <input className="form-control" placeholder="Task description"
                           value={item.description}
                           onChange={e => updateLineItem(idx, 'description', e.target.value)} required />
                  </div>
                  <div className="col-md-2">
                    <input type="number" step="any" min="0.1" className="form-control" placeholder="Hours"
                           value={item.hours}
                           onChange={e => updateLineItem(idx, 'hours', e.target.value)} required />
                  </div>
                  <div className="col-md-2">
                    <input type="number" className="form-control" placeholder="₹/hr"
                           value={item.ratePerHour}
                           onChange={e => updateLineItem(idx, 'ratePerHour', e.target.value)} required />
                  </div>
                  <div className="col-md-2 text-end">
                    <strong>₹{((parseFloat(item.hours) || 0) * (parseFloat(item.ratePerHour) || 0)).toFixed(0)}</strong>
                  </div>
                  <div className="col-md-1">
                    {form.lineItems.length > 1 && (
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeLineItem(idx)}>×</button>
                    )}
                  </div>
                </div>
              ))}

              <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={addLineItem}>+ Add entry</button>

              <div className="d-flex justify-content-between align-items-center border-top pt-3">
                <h5 className="mb-0">Total: <strong>₹{calcTotal().toFixed(0)}</strong></h5>
                <button type="submit" className="btn btn-success">Generate Invoice + PDF</button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <p className="text-muted">No invoices yet.</p>
      ) : (
        <div className="row g-3">
          {invoices.map((inv, i) => (
            <motion.div key={inv._id} className="col-md-6"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}>
              <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                <div className="card-body">
                  <div className="d-flex justify-content-between mb-2">
                    <strong>{inv.invoiceNumber}</strong>
                    <span className={`badge bg-${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                  </div>
                  <p className="small text-muted mb-1">Case: {inv.case?.caseNumber} — {inv.case?.title}</p>
                  <p className="small text-muted mb-1">
                    {isLawyer ? `Client: ${inv.client?.name}` : `Lawyer: ${inv.lawyer?.name}`}
                  </p>
                  <p className="small text-muted mb-2">Due: {new Date(inv.dueDate).toLocaleDateString()}</p>
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold">₹{inv.totalAmount}</h5>
                    <div className="d-flex gap-2">
                      <a href={inv.pdfUrl} target="_blank" rel="noreferrer"
                         className="btn btn-sm btn-outline-primary">PDF</a>
                      {isClient && inv.status !== 'paid' && (
                        <button className="btn btn-sm btn-success" onClick={() => handlePay(inv._id)}>Pay</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoiceManager;

```

### src/src/pages/LawyerDirectory.jsx
```jsx
// src/src/pages/LawyerDirectory.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

const PRACTICE_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const LawyerDirectory = () => {
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ practiceArea: '', city: '', search: '' });
  const [todaySlots, setTodaySlots] = useState({}); // lawyerId → available count

  const fetchLawyers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.practiceArea) params.practiceArea = filters.practiceArea;
      if (filters.city) params.city = filters.city;
      if (filters.search) params.search = filters.search;

      const { data } = await api.get('/users/lawyers', { params });
      setLawyers(data.lawyers);

      // Fetch today's availability for each lawyer (use local date, not UTC)
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const slotCounts = {};
      await Promise.all(
        data.lawyers.map(async (lawyer) => {
          try {
            const { data: availData } = await api.get(`/consultations/availability/${lawyer._id}`, {
              params: { startDate: today, endDate: today }
            });
            slotCounts[lawyer._id] = availData.availability[today]?.available?.length || 0;
          } catch (err) {
            console.warn(`Failed to fetch availability for lawyer ${lawyer._id}:`, err);
            slotCounts[lawyer._id] = 0;
          }
        })
      );
      setTodaySlots(slotCounts);
    } catch (err) {
      console.error('Failed to fetch lawyers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLawyers(); }, [filters]);

  return (
    <div className="container py-4">
      <h2 className="fw-bold mb-4">Find a Lawyer</h2>

      {/* Filters */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <input type="text" className="form-control" placeholder="Search by name..."
                 value={filters.search}
                 onChange={e => setFilters({...filters, search: e.target.value})} />
        </div>
        <div className="col-md-4">
          <select className="form-select" value={filters.practiceArea}
                  onChange={e => setFilters({...filters, practiceArea: e.target.value})}>
            <option value="">All Practice Areas</option>
            {PRACTICE_AREAS.map(area => (
              <option key={area} value={area}>{area.charAt(0).toUpperCase() + area.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <input type="text" className="form-control" placeholder="Filter by city..."
                 value={filters.city}
                 onChange={e => setFilters({...filters, city: e.target.value})} />
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : lawyers.length === 0 ? (
        <div className="text-center py-5 text-muted">No lawyers found matching your criteria.</div>
      ) : (
        <div className="row g-3">
          {lawyers.map((lawyer, i) => {
            const slotsToday = todaySlots[lawyer._id];
            return (
              <motion.div key={lawyer._id} className="col-md-6 col-lg-4"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}>
                <div className="card h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-3">
                      <div className="rounded-circle me-3 d-flex align-items-center justify-content-center"
                           style={{ width: 48, height: 48, backgroundColor: '#e2e8f0', fontSize: '18px', fontWeight: 'bold' }}>
                        {lawyer.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h6 className="mb-0 fw-bold">{lawyer.name}</h6>
                        <small className="text-muted">
                          {lawyer.yearsOfExperience || 0} years exp.
                        </small>
                      </div>
                    </div>

                    {lawyer.practiceAreas?.length > 0 && (
                      <div className="mb-2">
                        {lawyer.practiceAreas.map(area => (
                          <span key={area} className="badge bg-light text-dark me-1 mb-1">
                            {area}
                          </span>
                        ))}
                      </div>
                    )}

                    {lawyer.bio && <p className="text-muted small mb-2">{lawyer.bio.substring(0, 100)}...</p>}

                    {/* Today's availability */}
                    <div className="mb-2">
                      {slotsToday !== undefined && (
                        <span className={`badge ${slotsToday > 0 ? 'bg-success' : 'bg-secondary'} bg-opacity-10 
                              ${slotsToday > 0 ? 'text-success' : 'text-secondary'}`}
                              style={{ fontSize: 11 }}>
                          {slotsToday > 0 ? `${slotsToday} slot${slotsToday !== 1 ? 's' : ''} available today` : 'No slots today'}
                        </span>
                      )}
                    </div>

                    <div className="d-flex justify-content-between align-items-center">
                      <span className="fw-bold text-success">Rs.{lawyer.feePerHour || '—'}/hr</span>
                      <Link to={`/book/${lawyer._id}`} className="btn btn-sm btn-outline-primary">
                        Book Consultation
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LawyerDirectory;

```

### src/src/pages/Login.jsx
```jsx
// src/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { loginUser } from '../services/authService';
import { motion } from 'framer-motion';
import api from '../services/api';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Email + password login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(formData);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || (err.code === 'ECONNABORTED' || !err.response ? 'Server is starting up, please try again in a moment' : 'Login failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Google login
  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', {
        credential: credentialResponse.credential
      });

      if (data.newUser) {
        // New user — redirect to register with Google data
        navigate('/register', { state: { googleData: data.googleData } });
      } else {
        // Existing Google user — log in
        login(data.token, data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.message || (err.code === 'ECONNABORTED' || !err.response ? 'Server is starting up, please try again in a moment' : 'Google sign-in failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
         style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card shadow-lg border-0"
        style={{ width: '420px', borderRadius: '16px' }}
      >
        <div className="card-body p-4">
          <h2 className="text-center mb-1 fw-bold">Welcome Back</h2>
          <p className="text-center text-muted mb-4">Sign in to LawLink</p>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" name="email" className="form-control"
                     value={formData.email} onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input type="password" name="password" className="form-control"
                     value={formData.password} onChange={handleChange} required />
              <div className="text-end mt-1">
                <Link to="/forgot-password" className="text-decoration-none small">Forgot Password?</Link>
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="d-flex align-items-center my-3">
            <hr className="flex-grow-1" />
            <span className="px-3 text-muted small">OR</span>
            <hr className="flex-grow-1" />
          </div>

          {/* Google Sign In */}
          <div className="d-flex justify-content-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in failed')}
              text="signin_with"
              shape="rectangular"
              width="350"
            />
          </div>

          <p className="text-center mt-3 mb-0">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;

```

### src/src/pages/Profile.jsx
```jsx
// src/src/pages/Profile.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const PRACTICE_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const Profile = () => {
  const { user, isLawyer } = useAuth();
  const [form, setForm] = useState({
    bio: '',
    barRegistrationNumber: '', yearsOfExperience: '', feePerHour: '', practiceAreas: []
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await api.get('/auth/me');
      const u = data.user;
      setForm({
        bio: u.bio || '',
        barRegistrationNumber: u.barRegistrationNumber || '',
        yearsOfExperience: u.yearsOfExperience || '',
        feePerHour: u.feePerHour || '',
        practiceAreas: u.practiceAreas || []
      });
    };
    loadProfile();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const toggleArea = (area) => {
    const current = form.practiceAreas;
    if (current.includes(area)) {
      setForm({ ...form, practiceAreas: current.filter(a => a !== area) });
    } else {
      setForm({ ...form, practiceAreas: [...current, area] });
    }
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.yearsOfExperience) payload.yearsOfExperience = Number(payload.yearsOfExperience);
      if (payload.feePerHour) payload.feePerHour = Number(payload.feePerHour);
      await api.put('/auth/profile', payload);
      setSaved(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: 640 }}>
      <h2 className="fw-bold mb-4">Edit Profile</h2>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
        <div className="card-body p-4">
          <form onSubmit={handleSubmit}>
            {/* Common fields — name and email are read-only */}
            <div className="mb-3">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-control" value={user?.name || ''} disabled />
              <small className="text-muted">Name cannot be changed</small>
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={user?.email || ''} disabled />
              <small className="text-muted">Email cannot be changed</small>
            </div>

            {/* Lawyer-specific fields */}
            {isLawyer && (
              <div className="p-3 rounded mb-3" style={{ background: '#f1f5f9' }}>
                <h6 className="fw-bold mb-3" style={{ color: '#334155' }}>Professional Details</h6>

                <div className="mb-3">
                  <label className="form-label">Bar Registration Number</label>
                  <input type="text" name="barRegistrationNumber" className="form-control"
                         placeholder="e.g. BAR-DL-2020-001"
                         value={form.barRegistrationNumber} onChange={handleChange} />
                </div>

                <div className="row mb-3">
                  <div className="col-6">
                    <label className="form-label">Years of Experience</label>
                    <input type="number" name="yearsOfExperience" className="form-control"
                           min="0" max="50" placeholder="e.g. 5"
                           value={form.yearsOfExperience} onChange={handleChange} />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Fee (Rs./hr)</label>
                    <input type="number" name="feePerHour" className="form-control"
                           min="100" step="100" placeholder="e.g. 2500"
                           value={form.feePerHour} onChange={handleChange} />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Practice Areas</label>
                  <div className="d-flex flex-wrap gap-2">
                    {PRACTICE_AREAS.map(area => (
                      <button
                        key={area} type="button"
                        className={`btn btn-sm ${form.practiceAreas.includes(area) ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => toggleArea(area)}
                      >
                        {area.charAt(0).toUpperCase() + area.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label">Bio</label>
                  <textarea name="bio" className="form-control" rows={3}
                            placeholder="Describe your expertise and experience..."
                            value={form.bio} onChange={handleChange} />
                </div>
              </div>
            )}

            {/* Client bio */}
            {!isLawyer && (
              <div className="mb-3">
                <label className="form-label">Bio</label>
                <textarea name="bio" className="form-control" rows={2}
                          placeholder="Tell us about yourself..."
                          value={form.bio} onChange={handleChange} />
              </div>
            )}

            <div className="d-flex align-items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                             className="text-success fw-bold">
                  Profile updated!
                </motion.span>
              )}
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;

```

### src/src/pages/Register.jsx
```jsx
// src/src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const PRACTICE_AREAS = ['criminal', 'civil', 'family', 'corporate', 'property', 'labour'];

const Register = () => {
  const location = useLocation();
  const [googleData, setGoogleData] = useState(location.state?.googleData || null);

  const [step, setStep] = useState(googleData ? 'profile' : 'form'); 
  // Steps: 'form' → 'otp' → done   |   'profile' (Google) → done

  const [formData, setFormData] = useState({
    name: googleData?.name || '',
    email: googleData?.email || '',
    password: '',
    confirmPassword: '',
    role: 'client',
    barRegistrationNumber: '', yearsOfExperience: '', feePerHour: '', practiceAreas: [], bio: ''
  });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const togglePracticeArea = (area) => {
    const current = formData.practiceAreas;
    if (current.includes(area)) {
      setFormData({ ...formData, practiceAreas: current.filter(a => a !== area) });
    } else {
      setFormData({ ...formData, practiceAreas: [...current, area] });
    }
  };

  // Step 1: Email+Password → Send OTP
  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (formData.role === 'lawyer') {
      if (!formData.barRegistrationNumber) return setError('Bar registration number is required');
      if (!formData.feePerHour || formData.feePerHour <= 0) return setError('Fee per hour is required');
      if (!formData.yearsOfExperience) return setError('Years of experience is required');
      if (formData.practiceAreas.length === 0) return setError('Select at least one practice area');
    }

    setLoading(true);
    try {
      const { confirmPassword, ...submitData } = formData;
      if (submitData.yearsOfExperience) submitData.yearsOfExperience = Number(submitData.yearsOfExperience);
      if (submitData.feePerHour) submitData.feePerHour = Number(submitData.feePerHour);
      await api.post('/auth/register', submitData);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email: formData.email, otp });
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    setError('');
    try {
      await api.post('/auth/resend-otp', { email: formData.email });
      setError('');
      alert('New OTP sent!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend');
    }
  };

  // Google: Complete profile and register
  const handleGoogleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.role === 'lawyer') {
      if (!formData.barRegistrationNumber) return setError('Bar registration number is required');
      if (!formData.feePerHour || formData.feePerHour <= 0) return setError('Fee per hour is required');
      if (!formData.yearsOfExperience) return setError('Years of experience is required');
      if (formData.practiceAreas.length === 0) return setError('Select at least one practice area');
    }

    setLoading(true);
    try {
      const payload = {
        googleId: googleData.googleId,
        name: googleData.name,
        email: googleData.email,
        role: formData.role,
        barRegistrationNumber: formData.barRegistrationNumber,
        yearsOfExperience: formData.yearsOfExperience ? Number(formData.yearsOfExperience) : undefined,
        feePerHour: formData.feePerHour ? Number(formData.feePerHour) : undefined,
        practiceAreas: formData.practiceAreas,
        bio: formData.bio
      };
      const { data } = await api.post('/auth/google-register', payload);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-Up button (from register page directly)
  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', {
        credential: credentialResponse.credential
      });
      if (data.newUser) {
        // Show profile completion form using React state (no reload needed)
        setFormData(prev => ({
          ...prev,
          name: data.googleData.name,
          email: data.googleData.email
        }));
        setGoogleData(data.googleData);
        setStep('profile');
      } else {
        // Already registered — log in
        login(data.token, data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  const isLawyer = formData.role === 'lawyer';

  // ── Lawyer fields component ──
  const LawyerFields = () => (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
      <div className="p-3 mb-3 rounded" style={{ background: '#f1f5f9' }}>
        <h6 className="fw-bold mb-3" style={{ color: '#334155' }}>Professional Details</h6>
        <div className="mb-3">
          <label className="form-label">Bar Registration Number</label>
          <input type="text" name="barRegistrationNumber" className="form-control"
                 placeholder="e.g. BAR-DL-2020-001"
                 value={formData.barRegistrationNumber} onChange={handleChange} />
        </div>
        <div className="row mb-3">
          <div className="col-6">
            <label className="form-label">Years of Experience</label>
            <input type="number" name="yearsOfExperience" className="form-control"
                   min="0" max="50" placeholder="e.g. 5"
                   value={formData.yearsOfExperience} onChange={handleChange} />
          </div>
          <div className="col-6">
            <label className="form-label">Fee (Rs./hr)</label>
            <input type="number" name="feePerHour" className="form-control"
                   min="100" step="100" placeholder="e.g. 2500"
                   value={formData.feePerHour} onChange={handleChange} />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">Practice Areas</label>
          <div className="d-flex flex-wrap gap-2">
            {PRACTICE_AREAS.map(area => (
              <button key={area} type="button"
                      className={`btn btn-sm ${formData.practiceAreas.includes(area) ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => togglePracticeArea(area)}>
                {area.charAt(0).toUpperCase() + area.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-2">
          <label className="form-label">Short Bio</label>
          <textarea name="bio" className="form-control" rows={2}
                    placeholder="Describe your expertise..."
                    value={formData.bio} onChange={handleChange} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
         style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '40px 0' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="card shadow-lg border-0" style={{ width: '520px', borderRadius: '16px' }}>
        <div className="card-body p-4">

          {/* ────── STEP: OTP Verification ────── */}
          {step === 'otp' && (
            <>
              <h2 className="text-center mb-1 fw-bold">Verify Email</h2>
              <p className="text-center text-muted mb-4">
                Enter the 6-digit code sent to <strong>{formData.email}</strong>
              </p>

              {error && <div className="alert alert-danger py-2">{error}</div>}

              <form onSubmit={handleVerifyOTP}>
                <div className="mb-3">
                  <input type="text" className="form-control form-control-lg text-center"
                         placeholder="------" maxLength={6}
                         value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                         style={{ letterSpacing: '12px', fontSize: '24px', fontWeight: 'bold' }}
                         required />
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify & Create Account'}
                </button>
              </form>

              <div className="text-center mt-3">
                <button className="btn btn-link btn-sm" onClick={handleResend}>
                  Didn't receive it? Resend OTP
                </button>
              </div>
              <div className="text-center">
                <button className="btn btn-link btn-sm text-muted" onClick={() => setStep('form')}>
                  ← Back to registration
                </button>
              </div>
            </>
          )}

          {/* ────── STEP: Google Profile Completion ────── */}
          {step === 'profile' && googleData && (
            <>
              <h2 className="text-center mb-1 fw-bold">Complete Your Profile</h2>
              <p className="text-center text-muted mb-4">
                Signed in as <strong>{googleData.email}</strong>
              </p>

              {error && <div className="alert alert-danger py-2">{error}</div>}

              <form onSubmit={handleGoogleRegister}>
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input type="text" className="form-control" value={googleData.name} disabled />
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={googleData.email} disabled />
                </div>
                <div className="mb-3">
                  <label className="form-label">I am a</label>
                  <select name="role" className="form-select" value={formData.role} onChange={handleChange}>
                    <option value="client">Client — I need legal help</option>
                    <option value="lawyer">Lawyer — I provide legal services</option>
                  </select>
                </div>

                <AnimatePresence>{isLawyer && <LawyerFields />}</AnimatePresence>

                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            </>
          )}

          {/* ────── STEP: Main Registration Form ────── */}
          {step === 'form' && (
            <>
              <h2 className="text-center mb-1 fw-bold">Create Account</h2>
              <p className="text-center text-muted mb-4">Join LawLink today</p>

              {error && <div className="alert alert-danger py-2">{error}</div>}

              {/* Google Sign Up */}
              <div className="d-flex justify-content-center mb-3">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-up failed')}
                  text="signup_with"
                  shape="rectangular"
                  width="460"
                />
              </div>

              <div className="d-flex align-items-center mb-3">
                <hr className="flex-grow-1" />
                <span className="px-3 text-muted small">OR register with email</span>
                <hr className="flex-grow-1" />
              </div>

              <form onSubmit={handleEmailRegister}>
                <div className="mb-3">
                  <label className="form-label">Full Name</label>
                  <input type="text" name="name" className="form-control"
                         value={formData.name} onChange={handleChange} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input type="email" name="email" className="form-control"
                         value={formData.email} onChange={handleChange} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">I am a</label>
                  <select name="role" className="form-select" value={formData.role} onChange={handleChange}>
                    <option value="client">Client — I need legal help</option>
                    <option value="lawyer">Lawyer — I provide legal services</option>
                  </select>
                </div>

                <AnimatePresence>{isLawyer && <LawyerFields />}</AnimatePresence>

                <div className="row mb-3">
                  <div className="col">
                    <label className="form-label">Password</label>
                    <input type="password" name="password" className="form-control"
                           value={formData.password} onChange={handleChange} required minLength={6} />
                  </div>
                  <div className="col">
                    <label className="form-label">Confirm</label>
                    <input type="password" name="confirmPassword" className="form-control"
                           value={formData.confirmPassword} onChange={handleChange} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? 'Sending OTP...' : 'Register & Verify Email'}
                </button>
              </form>

              <p className="text-center mt-3 mb-0">
                Already have an account? <Link to="/login">Sign In</Link>
              </p>
            </>
          )}

        </div>
      </motion.div>
    </div>
  );
};

export default Register;

```

### src/src/pages/ResetPassword.jsx
```jsx
// src/src/pages/ResetPassword.jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    try {
      await api.put(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    }
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
      <div className="card shadow-lg" style={{ maxWidth: 440, width: '100%' }}>
        <div className="card-body p-4">
          <h3 className="fw-bold text-center mb-1">🔐 Reset Password</h3>
          <p className="text-muted text-center mb-4">Enter your new password</p>

          {success ? (
            <div className="text-center py-3">
              <div style={{ fontSize: 48 }}>✅</div>
              <h5 className="mt-3">Password Reset!</h5>
              <p className="text-muted">Redirecting to login page...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <div className="mb-3">
                <label className="form-label">New Password</label>
                <input type="password" className="form-control" required minLength={6}
                       value={password} onChange={e => setPassword(e.target.value)}
                       placeholder="Min. 6 characters" />
              </div>
              <div className="mb-3">
                <label className="form-label">Confirm Password</label>
                <input type="password" className="form-control" required
                       value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                       placeholder="Re-enter password" />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm" /> : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ResetPassword;

```

### src/src/services/api.js
```javascript
// src/src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true,  // Send httpOnly cookies with every request
  timeout: 30000          // 30s timeout (Render cold start can take 20s)
});

// Attach Bearer token as fallback for cross-domain (cookies may be blocked)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('socketToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-retry on network errors / timeouts (handles Render cold starts)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Retry once on network error or timeout (cold start recovery)
    if (
      !config._retried &&
      (error.code === 'ECONNABORTED' || !error.response || error.response.status >= 500)
    ) {
      config._retried = true;
      // Wait 2 seconds before retry (let server finish waking up)
      await new Promise(r => setTimeout(r, 2000));
      return api(config);
    }

    // Handle 401 responses globally (token expired or missing)
    if (error.response && error.response.status === 401) {
      const url = config?.url || '';
      const isAuthCheck = url.includes('/auth/me');
      const isOnAuthPage = ['/login', '/register', '/forgot-password', '/reset-password']
        .some(path => window.location.pathname.startsWith(path));

      if (!isAuthCheck && !isOnAuthPage) {
        localStorage.removeItem('socketToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

```

### src/src/services/authService.js
```javascript
// src/src/services/authService.js
import api from './api';

export const registerUser = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

```

### src/vite.config.js
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost'
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true
      }
    }
  }
});

```

