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
