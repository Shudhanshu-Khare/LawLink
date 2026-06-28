const jwt = require('jsonwebtoken');
const Message = require('../models/Message.model');
const Conversation = require('../models/Conversation.model');

const onlineUsers = new Map();

module.exports = function setupSocket(io) {

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

    socket.join(userId);

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    io.emit('users:online', Array.from(onlineUsers.keys()));

    socket.on('conversation:join', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

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

        const populated = await message.populate('sender', 'name profilePhoto role');

        io.to(`conv:${conversationId}`).emit('message:new', populated);

        const conv = await Conversation.findById(conversationId);
        const recipientId = conv.participants.find(p => p.toString() !== userId)?.toString();

        if (recipientId) {
          io.to(recipientId).emit('message:received', populated);
        }

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
