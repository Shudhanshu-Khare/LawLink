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

// @desc    Get all conversations with unread counts (respects clearedBy)
// @route   GET /api/chat/conversations
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id
    })
      .populate('participants', 'name email role')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

    // Add unread count and filter by clearedBy timestamp
    const withUnread = await Promise.all(conversations.map(async (conv) => {
      const clearedAt = conv.clearedBy?.get(req.user.id);
      const msgFilter = {
        conversation: conv._id,
        sender: { $ne: req.user.id },
        status: { $ne: 'read' }
      };
      // Only count unread messages AFTER the user's clearedAt
      if (clearedAt) {
        msgFilter.createdAt = { $gt: clearedAt };
      }

      const unreadCount = await Message.countDocuments(msgFilter);

      // Check if there are ANY messages after clearedAt
      // If not, this conversation was "deleted" and has no new activity — hide it
      if (clearedAt) {
        const hasNewMessages = await Message.exists({
          conversation: conv._id,
          createdAt: { $gt: clearedAt }
        });
        if (!hasNewMessages) return null; // Hide this conversation
      }

      const convObj = conv.toObject();
      convObj.unreadCount = unreadCount;

      // If lastMessage is before clearedAt, hide it from preview
      if (clearedAt && conv.lastMessage && new Date(conv.lastMessage.createdAt) <= clearedAt) {
        convObj.lastMessage = null;
      }

      return convObj;
    }));

    // Remove null (hidden) conversations
    res.json({ success: true, conversations: withUnread.filter(Boolean) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get messages with cursor-based pagination (respects clearedBy)
// @route   GET /api/chat/conversations/:id/messages
exports.getMessages = async (req, res) => {
  try {
    const { before, limit = 50 } = req.query;
    const filter = { conversation: req.params.id };

    // Respect clearedBy — only show messages after user's clear timestamp
    const conv = await Conversation.findById(req.params.id).select('clearedBy');
    const clearedAt = conv?.clearedBy?.get(req.user.id);
    if (clearedAt) {
      filter.createdAt = { $gt: clearedAt };
    }

    if (before) {
      filter.createdAt = { ...filter.createdAt, $lt: new Date(before) };
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
    const conversations = await Conversation.find({
      participants: req.user.id
    }).select('_id clearedBy');

    let totalUnread = 0;
    for (const conv of conversations) {
      const clearedAt = conv.clearedBy?.get(req.user.id);
      const filter = {
        conversation: conv._id,
        sender: { $ne: req.user.id },
        status: { $ne: 'read' }
      };
      if (clearedAt) {
        filter.createdAt = { $gt: clearedAt };
      }
      totalUnread += await Message.countDocuments(filter);
    }

    res.json({ success: true, unreadCount: totalUnread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Clear/delete chat for current user only
// @route   DELETE /api/chat/conversations/:id
exports.clearChat = async (req, res) => {
  try {
    const conv = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user.id
    });

    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Set clearedAt for this user — messages before this won't be shown to them
    conv.clearedBy.set(req.user.id, new Date());
    await conv.save();

    // Also mark all messages as read for this user so unread badge clears
    await Message.updateMany(
      {
        conversation: conv._id,
        sender: { $ne: req.user.id },
        status: { $ne: 'read' }
      },
      { status: 'read' }
    );

    res.json({ success: true, message: 'Chat deleted from your account' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
