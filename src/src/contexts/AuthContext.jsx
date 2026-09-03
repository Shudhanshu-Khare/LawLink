// src/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api, { startKeepalive, stopKeepalive } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // socketToken is only used for socket.io auth (received from login response)
  const [socketToken, setSocketToken] = useState(localStorage.getItem('socketToken'));

  useEffect(() => {
    const loadUser = async () => {
      // If user explicitly logged out, don't even try /auth/me
      // (the httpOnly cookie might still exist because it can't be cleared from JS)
      if (localStorage.getItem('loggedOut') === 'true') {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Cookie is sent automatically — if valid, we get user data
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        startKeepalive(); // User is authenticated — keep server alive
      } catch (err) {
        // Only clear session if backend explicitly rejects auth (401)
        // Network errors (Render cold start, timeout, 502) should NOT log user out
        if (err.response && err.response.status === 401) {
          setUser(null);
          setSocketToken(null);
          localStorage.removeItem('socketToken');
        }
        // For non-401 errors: keep existing user state (may be null on first load)
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const login = (tokenValue, userData) => {
    // JWT is already set as httpOnly cookie by the server
    // We only store the token for socket.io auth (can't send cookies over WebSocket)
    localStorage.setItem('socketToken', tokenValue);
    localStorage.removeItem('loggedOut');  // Clear the logout flag
    setSocketToken(tokenValue);
    setUser(userData);
    startKeepalive(); // Start pinging server while user is logged in
  };

  const logout = async () => {
    // Mark as explicitly logged out BEFORE anything else
    // This prevents /auth/me from restoring the session even if the cookie persists
    localStorage.setItem('loggedOut', 'true');
    localStorage.removeItem('socketToken');
    setSocketToken(null);
    setUser(null);
    stopKeepalive(); // Stop pinging — server can sleep if nobody else is logged in

    // Then clear server-side cookie (best-effort, non-blocking)
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore — the loggedOut flag ensures we won't auto-login on refresh
    }
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
