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
