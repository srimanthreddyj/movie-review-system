import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Automatically inject JWT token into requests if available in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper to rewrite TMDB image URLs (routing via backend proxy to bypass ISP blocks in India)
export const getProxiedImageUrl = (url) => {
  if (!url) return '';
  if (url.includes('image.tmdb.org')) {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${baseURL}/movies/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

export default api;
