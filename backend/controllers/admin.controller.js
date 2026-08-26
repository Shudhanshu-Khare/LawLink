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
