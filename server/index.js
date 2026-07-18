require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect Database
connectDB().then(() => {
  // Trigger cache check after MongoDB is connected
  const movieController = require('./controllers/movieController');
  if (typeof movieController.refreshPopularCacheIfExpired === 'function') {
    console.log('MongoDB connected. Initiating popular cache status check...');
    movieController.refreshPopularCacheIfExpired();
  }

  // Check cache expiration every 24 hours to automatically sync weekly if server runs continuously
  setInterval(() => {
    if (typeof movieController.refreshPopularCacheIfExpired === 'function') {
      console.log('Running daily popular cache check...');
      movieController.refreshPopularCacheIfExpired();
    }
  }, 24 * 60 * 60 * 1000);
}).catch(err => {
  console.error('Failed to run initial popular cache check:', err.message);
});

// Init Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.url}`, req.body ? `- Body: ${JSON.stringify(req.body)}` : '');
  next();
});

// Define Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/movies', require('./routes/movieRoutes'));
app.use('/api/cast', require('./routes/castRoutes'));
app.use('/api/favourites', require('./routes/favouritesRoutes'));
app.use('/api/clips', require('./routes/clipsRoutes'));
app.use('/api/collections', require('./routes/collectionsRoutes'));
app.use('/api/tags', require('./routes/tagsRoutes'));
app.use('/api/comments', require('./routes/commentsRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/cliproom', require('./routes/driveRoutes'));
// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CineTrack API is running' });
});

// Conditionally bind port only when running locally (not in serverless environments)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

module.exports = app;
