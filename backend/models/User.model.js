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
    select: false
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
  phone: {
    type: String,
    trim: true
  },
  profilePhoto: {
    type: String,
    default: ''
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

  barRegistrationNumber: {
    type: String,
    unique: true,
    sparse: true
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

  legalMatterTypes: [{
    type: String,
    enum: ['criminal', 'civil', 'family', 'corporate', 'property', 'labour']
  }],
  activeCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case'
  }
}, {
  timestamps: true
});

UserSchema.index({ role: 1 });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

module.exports = mongoose.model('User', UserSchema);
