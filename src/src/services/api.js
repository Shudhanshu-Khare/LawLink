// src/src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true,  // Send httpOnly cookies with every request
  timeout: 60000          // 60s timeout (Render cold start can take up to 60s)
});

// Attach Bearer token as fallback for cross-domain (cookies may be blocked)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('socketToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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
      const isOnAuthPage = ['/login', '/register', '/forgot-password', '/reset-password']
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

// Keep Render alive: ping /api/health every 4 minutes while the page is open
// Render free tier spins down after 15 min of no requests — this prevents that
setInterval(() => {
  if (document.visibilityState === 'visible') {
    api.get('/health').catch(() => {});
  }
}, 4 * 60 * 1000);

export default api;
