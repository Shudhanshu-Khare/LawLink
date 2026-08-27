// src/src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true,  // Send httpOnly cookies with every request
  timeout: 30000          // 30s timeout (Render cold start can take 20s)
});

// Attach Bearer token as fallback for cross-domain (cookies may be blocked)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('socketToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-retry on network errors / timeouts (handles Render cold starts)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Retry once on network error or timeout (cold start recovery)
    if (
      !config._retried &&
      (error.code === 'ECONNABORTED' || !error.response || error.response.status >= 500)
    ) {
      config._retried = true;
      // Wait 2 seconds before retry (let server finish waking up)
      await new Promise(r => setTimeout(r, 2000));
      return api(config);
    }

    // Handle 401 responses globally (token expired or missing)
    if (error.response && error.response.status === 401) {
      const url = config?.url || '';
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
