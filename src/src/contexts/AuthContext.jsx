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
    setSocketToken(tokenValue);
    setUser(userData);
  };

  const logout = async () => {
    // Clear local state FIRST (synchronous — prevents race conditions)
    localStorage.removeItem('socketToken');
    setSocketToken(null);
    setUser(null);

    // Clear the httpOnly cookie from the browser side as backup
    // (in case the API call below fails due to Render being down)
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';

    // Then clear server-side cookie (best-effort, non-blocking)
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore — local state and cookie already cleared
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
