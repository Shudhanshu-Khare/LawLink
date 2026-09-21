// src/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { startKeepalive, stopKeepalive, isSessionExpired, touchActivity } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverWaking, setServerWaking] = useState(false);
  // socketToken is only used for socket.io auth (received from login response)
  const [socketToken, setSocketToken] = useState(localStorage.getItem('socketToken'));

  useEffect(() => {
    const loadUser = async () => {
      // If user explicitly logged out, don't even try /auth/me
      if (localStorage.getItem('loggedOut') === 'true') {
        setUser(null);
        setLoading(false);
        return;
      }

      // Check if session expired due to inactivity (15 min)
      if (isSessionExpired()) {
        setUser(null);
        setSocketToken(null);
        localStorage.setItem('loggedOut', 'true');
        localStorage.removeItem('socketToken');
        localStorage.removeItem('lastActivity');
        setLoading(false);
        return;
      }

      try {
        // Show "server starting" if response takes >4s
        const wakeTimer = setTimeout(() => setServerWaking(true), 4000);

        // Cookie is sent automatically — if valid, we get user data
        const { data } = await api.get('/auth/me');
        clearTimeout(wakeTimer);
        setServerWaking(false);
        setUser(data.user);
        touchActivity(); // Mark as active
        startKeepalive(); // User is authenticated — keep server alive
      } catch (err) {
        setServerWaking(false);
        // Only clear session if backend explicitly rejects auth (401)
        if (err.response && err.response.status === 401) {
          setUser(null);
          setSocketToken(null);
          localStorage.removeItem('socketToken');
        }
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  // Track user activity (any interaction keeps session alive)
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => touchActivity();
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity, true);
    window.addEventListener('mousemove', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity, true);
      window.removeEventListener('mousemove', handleActivity);
    };
  }, [user]);

  const login = (tokenValue, userData) => {
    localStorage.setItem('socketToken', tokenValue);
    localStorage.removeItem('loggedOut');
    touchActivity(); // Mark session start
    setSocketToken(tokenValue);
    setUser(userData);
    startKeepalive();
  };

  const logout = useCallback(async () => {
    localStorage.setItem('loggedOut', 'true');
    localStorage.removeItem('socketToken');
    localStorage.removeItem('lastActivity');
    setSocketToken(null);
    setUser(null);
    stopKeepalive();

    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore — the loggedOut flag ensures we won't auto-login on refresh
    }
  }, []);

  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  return (
    <AuthContext.Provider value={{
      user,
      socketToken,
      loading,
      serverWaking,
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

