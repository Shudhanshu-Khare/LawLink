// src/src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true,  // Send httpOnly cookies with every request
  timeout: 60000          // 60s timeout (Render cold start can take up to 60s)
});

// Track user activity for session timeout
export const touchActivity = () => {
  localStorage.setItem('lastActivity', Date.now().toString());
};

export const isSessionExpired = () => {
  const last = localStorage.getItem('lastActivity');
  if (!last) return false; // No activity recorded yet (first visit)
  return (Date.now() - parseInt(last, 10)) > SESSION_TIMEOUT_MS;
};

// Attach Bearer token + update activity on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('socketToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Every API call = user is active
  touchActivity();
  return config;
});

// Auto-retry with exponential backoff (handles Render cold starts + momentary failures)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    // Track retry count (up to 3 retries with increasing delays: 3s, 6s, 12s)
    config._retryCount = config._retryCount || 0;
    const MAX_RETRIES = 3;

    const isRetryable =
      error.code === 'ECONNABORTED' ||      // timeout
      !error.response ||                      // no response (network error / CORS block)
      error.response.status >= 500;           // server error

    if (isRetryable && config._retryCount < MAX_RETRIES) {
      config._retryCount += 1;
      const delay = config._retryCount * 3000; // 3s, 6s, 9s
      await new Promise(r => setTimeout(r, delay));
      return api(config);
    }

    // Handle 401 responses globally (token expired or missing)
    if (error.response && error.response.status === 401) {
      const url = config?.url || '';
      const isAuthCheck = url.includes('/auth/me');
      const isOnAuthPage = ['/login', '/register']
        .some(path => window.location.pathname.startsWith(path));

      if (!isAuthCheck && !isOnAuthPage) {
        localStorage.setItem('loggedOut', 'true');
        localStorage.removeItem('socketToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Keepalive ping — only runs when a user is logged in
// Server sleeps when nobody is actively using the app
let keepaliveInterval = null;

export const startKeepalive = () => {
  if (keepaliveInterval) return; // already running
  // Ping immediately to wake server if sleeping
  api.get('/health').catch(() => {});
  // Then ping every 4 minutes
  keepaliveInterval = setInterval(() => {
    api.get('/health').catch(() => {});
  }, 4 * 60 * 1000);
};

export const stopKeepalive = () => {
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
  }
};

export default api;
