// src/src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // Send httpOnly cookies with every request
});

// Attach Bearer token as fallback for cross-domain (cookies may be blocked)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('socketToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally (token expired or missing)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      // Don't redirect for /auth/me (expected 401 when not logged in)
      // Don't redirect if already on login/register/forgot-password pages
      const isAuthCheck = url.includes('/auth/me');
      const isOnAuthPage = ['/login', '/register', '/forgot-password', '/reset-password']
        .some(path => window.location.pathname.startsWith(path));

      if (!isAuthCheck && !isOnAuthPage) {
        localStorage.removeItem('socketToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
