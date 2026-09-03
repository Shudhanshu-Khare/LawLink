// src/src/contexts/SocketContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// In dev, use same origin (Vite proxy handles /socket.io). In prod, use explicit URL.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export const SocketProvider = ({ children }) => {
  const { socketToken, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !socketToken) {
      // Clean up if user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    // Only create a new socket if we don't have one or the token changed
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(SOCKET_URL, {
      auth: { token: socketToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('users:online', (users) => {
      setOnlineUsers(users);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, socketToken]);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      onlineUsers,
      connected
    }}>
      {children}
    </SocketContext.Provider>
  );
};

// Drop-in replacement for the old useSocket hook — same API
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};
