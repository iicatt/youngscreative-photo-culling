/**
 * Axios instance terpusat dengan interceptor JWT
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

// Sertakan JWT token dari localStorage (via zustand persist)
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('yc-auth');
    if (stored) {
      const { state } = JSON.parse(stored);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    }
  } catch (_) { /* abaikan */ }
  return config;
});

// Tangani 401 secara global — hapus sesi
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('yc-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
