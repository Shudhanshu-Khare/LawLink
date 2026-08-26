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
