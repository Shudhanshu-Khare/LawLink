// src/src/hooks/useSocket.js
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

// In dev, use same origin (Vite proxy handles /socket.io). In prod, use explicit URL.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export const useSocket = () => {
  const { socketToken, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !socketToken) return;

    const socket = io(SOCKET_URL, {
      auth: { token: socketToken },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setConnected(true);
      console.log('Socket connected');
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

  return {
    socket: socketRef.current,
    onlineUsers,
    connected
  };
};
