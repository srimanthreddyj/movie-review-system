import axios from 'axios';

export const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    const protocol = window.location.protocol || 'http:';
    return `${protocol}//${host}:5000/api`;
  }
  return 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
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
    const baseURL = getBaseURL();
    return `${baseURL}/movies/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

export default api;
