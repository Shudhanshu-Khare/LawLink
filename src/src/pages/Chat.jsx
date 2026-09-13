// src/src/pages/Chat.jsx
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
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
        c._id === msg.conversation ? { ...c, lastMessage: msg, lastMessageAt: new Date() } : c
      ));
    };
    const handleDelivered = ({ messageIds }) => {
      setMessages(prev => prev.map(m => messageIds.includes(m._id) ? { ...m, status: 'delivered' } : m));
    };
    const handleRead = ({ conversationId }) => {
      if (activeConv?._id === conversationId) {
        setMessages(prev => prev.map(m => m.sender._id === user._id ? { ...m, status: 'read' } : m));
      }
    };
    const handleTypingStart = ({ userId, conversationId }) => {
      if (activeConv?._id === conversationId && userId !== user._id) setTyping(userId);
    };
    const handleTypingStop = () => setTyping(null);

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
    if (before) { setMessages(prev => [...data.messages, ...prev]); }
    else { setMessages(data.messages); setTimeout(scrollToBottom, 100); }
    setHasMore(data.hasMore);
    setLoadingMsgs(false);
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const sendMessage = () => {
    if (!newMsg.trim() || !socket || !activeConv) return;
    socket.emit('message:send', { conversationId: activeConv._id, content: newMsg.trim() });
    setNewMsg('');
    socket.emit('typing:stop', { conversationId: activeConv._id });
  };

  const handleTyping = (e) => {
    setNewMsg(e.target.value);
    if (!socket || !activeConv) return;
    socket.emit('typing:start', { conversationId: activeConv._id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socket.emit('typing:stop', { conversationId: activeConv._id }), 1500);
  };

  const getOtherUser = (conv) => conv.participants?.find(p => p._id !== user._id);

  const getStatusIcon = (status) => {
    if (status === 'read') return <span style={{ color: '#fff', fontWeight: 'bold' }}>✓✓</span>;
    return <span style={{ color: 'rgba(255,255,255,0.6)' }}>✓</span>;
  };

  const handleDeleteChat = async (convId, otherName, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Delete this chat with ${otherName}?\n\nThis only deletes from YOUR account.`)) return;
    try {
      await api.delete(`/chat/conversations/${convId}`);
      setConversations(prev => prev.filter(c => c._id !== convId));
      if (activeConv?._id === convId) { setActiveConv(null); setMessages([]); }
    } catch { alert('Failed to delete chat'); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: 'calc(100vh - 120px)', gap: 0 }}>
      {/* Conversation sidebar */}
      <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0 }}>Messages</h3>
        </div>
        {conversations.length === 0 ? (
          <div className="ll-empty" style={{ padding: '32px 16px' }}>
            <i className="bi bi-chat-square" />
            <p style={{ fontSize: '0.85rem' }}>No conversations yet.</p>
          </div>
        ) : conversations.map(conv => {
          const other = getOtherUser(conv);
          const isOnline = onlineUsers.includes(other?._id);
          const isActive = activeConv?._id === conv._id;
          return (
            <div key={conv._id}
                 style={{
                   display: 'flex', alignItems: 'center', padding: '14px 20px', gap: '12px',
                   cursor: 'pointer', borderBottom: '1px solid var(--accent-light)',
                   background: isActive ? 'var(--accent-light)' : 'transparent',
                   transition: 'background 0.1s'
                 }}
                 onClick={() => setActiveConv(conv)}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div className="ll-avatar" style={{ width: 40, height: 40 }}>
                  {other?.name?.charAt(0).toUpperCase()}
                </div>
                {isOnline && (
                  <span style={{
                    position: 'absolute', bottom: 0, right: 0, width: 10, height: 10,
                    borderRadius: '50%', background: '#22c55e', border: '2px solid var(--bg-card)'
                  }} />
                )}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.85rem' }}>{other?.name}</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {conv.unreadCount > 0 && (
                      <span style={{
                        background: 'var(--accent)', color: '#fff', borderRadius: '10px',
                        padding: '1px 8px', fontSize: '0.7rem', fontWeight: 600
                      }}>{conv.unreadCount}</span>
                    )}
                    <button style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                            title="Delete chat"
                            onClick={(e) => handleDeleteChat(conv._id, other?.name, e)}>✕</button>
                  </div>
                </div>
                <small style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                  {conv.lastMessage?.content || 'Start a conversation'}
                </small>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat area */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>
        {activeConv ? (
          <>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="ll-avatar" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                  {getOtherUser(activeConv)?.name?.charAt(0)}
                </div>
                <div>
                  <strong style={{ fontSize: '0.9rem' }}>{getOtherUser(activeConv)?.name}</strong>
                  {onlineUsers.includes(getOtherUser(activeConv)?._id) && (
                    <small style={{ color: 'var(--success)', marginLeft: '8px' }}>● Online</small>
                  )}
                </div>
              </div>
              <button className="ll-btn ll-btn-sm ll-btn-ghost" style={{ color: 'var(--danger)' }}
                      onClick={(e) => handleDeleteChat(activeConv._id, getOtherUser(activeConv)?.name, e)}>
                <i className="bi bi-trash" /> Delete
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {hasMore && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <button className="ll-btn ll-btn-sm ll-btn-outline"
                          onClick={() => loadMessages(activeConv._id, messages[0]?.createdAt)}
                          disabled={loadingMsgs}>Load older</button>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMine = msg.sender._id === user._id;
                return (
                  <motion.div key={msg._id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                              style={{ display: 'flex', marginBottom: '8px', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      padding: '10px 16px', borderRadius: '16px', maxWidth: '70%',
                      background: isMine ? 'var(--accent)' : 'var(--accent-light)',
                      color: isMine ? '#fff' : 'var(--text-primary)'
                    }}>
                      <div style={{ fontSize: '0.875rem' }}>{msg.content}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMine && <span style={{ fontSize: '0.65rem' }}>{getStatusIcon(msg.status)}</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {typing && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>typing...</div>}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input className="ll-input" type="text" placeholder="Type a message..." maxLength={2000}
                       value={newMsg} onChange={handleTyping}
                       onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                <button className="ll-btn ll-btn-primary" onClick={sendMessage}>
                  <i className="bi bi-send" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="ll-empty" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <i className="bi bi-chat-square-text" />
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
