// src/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // socketToken is only used for socket.io auth (received from login response)
  const [socketToken, setSocketToken] = useState(localStorage.getItem('socketToken'));

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Cookie is sent automatically — if valid, we get user data
        const { data } = await api.get('/auth/me');
        setUser(data.user);
      } catch (err) {
        // No valid cookie or expired — user is not authenticated
        setUser(null);
        setSocketToken(null);
        localStorage.removeItem('socketToken');
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const login = (tokenValue, userData) => {
    // JWT is already set as httpOnly cookie by the server
    // We only store the token for socket.io auth (can't send cookies over WebSocket)
    localStorage.setItem('socketToken', tokenValue);
    setSocketToken(tokenValue);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');  // Server clears httpOnly cookie
    } catch (err) {
      // Ignore — clear local state regardless
    }
    localStorage.removeItem('socketToken');
    setSocketToken(null);
    setUser(null);
  };

  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  return (
    <AuthContext.Provider value={{
      user,
      socketToken,
      loading,
      login,
      logout,
      updateUser,
      isAuthenticated: !!user,
      isLawyer: user?.role === 'lawyer',
      isClient: user?.role === 'client',
      isAdmin: user?.role === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
