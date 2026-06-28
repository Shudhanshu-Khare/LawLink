// backend/controllers/chat.controller.js
const Conversation = require('../models/Conversation.model');
const Message = require('../models/Message.model');

// @desc    Get or create conversation with a user
// @route   POST /api/chat/conversations
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.body;
    const myId = req.user.id;

    // Find existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [myId, userId], $size: 2 }
    }).populate('participants', 'name email profilePhoto role')
      .populate('lastMessage');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [myId, userId]
      });
      conversation = await conversation.populate('participants', 'name email profilePhoto role');
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
      .populate('participants', 'name email profilePhoto role')
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
      .populate('sender', 'name profilePhoto role')
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

    const populated = await message.populate('sender', 'name profilePhoto role');
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
