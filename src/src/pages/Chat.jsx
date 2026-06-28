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

  useEffect(() => {
    const loadConversations = async () => {
      const { data } = await api.get('/chat/conversations');
      setConversations(data.conversations);
    };
    loadConversations();
  }, []);

  useEffect(() => {
    if (!activeConv || !socket) return;

    socket.emit('conversation:join', activeConv._id);
    loadMessages(activeConv._id);

    socket.emit('message:read', { conversationId: activeConv._id });

    return undefined;
  }, [activeConv, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMsg = (msg) => {
      if (activeConv && msg.conversation === activeConv._id) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
        socket.emit('message:read', { conversationId: activeConv._id });
      }
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
    if (status === 'read') return <span style={{ color: '#3b82f6' }}>✓✓</span>;
    return '✓';
  };

  return (
    <div className="container-fluid p-0" style={{ height: 'calc(100vh - 20px)' }}>
      <div className="row g-0 h-100">
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

        <div className="col-md-8 d-flex flex-column h-100">
          {activeConv ? (
            <>
              <div className="p-3 border-bottom d-flex align-items-center">
                <strong>{getOtherUser(activeConv)?.name}</strong>
                {onlineUsers.includes(getOtherUser(activeConv)?._id) && (
                  <small className="text-success ms-2">● Online</small>
                )}
              </div>

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

              <div className="p-3 border-top">
                <div className="d-flex gap-2">
                  <input type="text" className="form-control" placeholder="Type a message..."
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
