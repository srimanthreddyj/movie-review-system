require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Cast = require('./models/Cast');
const Clip = require('./models/Clip');
const Collection = require('./models/Collection');
const Comment = require('./models/Comment');
const TagAssignment = require('./models/TagAssignment');
const CacheMetadata = require('./models/CacheMetadata');

async function reset() {
  try {
    await connectDB();
    console.log('MongoDB Connected.');

    // 1. Delete all movies, cast members, clips, comments, collections, tag assignments, cache metadata
    console.log('Clearing Movie collection...');
    await Movie.deleteMany({});
    
    console.log('Clearing Cast collection...');
    await Cast.deleteMany({});
    
    console.log('Clearing Clip collection...');
    await Clip.deleteMany({});
    
    console.log('Clearing Collection (custom collections) collection...');
    await Collection.deleteMany({});
    
    console.log('Clearing Comment collection...');
    await Comment.deleteMany({});
    
    console.log('Clearing TagAssignment collection...');
    await TagAssignment.deleteMany({});
    
    console.log('Clearing CacheMetadata collection...');
    await CacheMetadata.deleteMany({});

    // 2. Clear favorites and custom tags inside user documents (preserving the user login credentials)
    console.log('Clearing favourites and tags from all user accounts...');
    await User.updateMany({}, {
      $set: {
        "favourites.movies": [],
        "favourites.cast": [],
        "favourites.clips": [],
        tags: []
      }
    });

    console.log('Database cleanup completed successfully (User account login credentials preserved).');
    
    // 3. Trigger weekly sync to re-seed the popular dashboard lists immediately
    console.log('Re-seeding popular movies and cast members from Gemini...');
    const movieApiService = require('./services/movieApiService');
    
    // Clear flags and run sync
    const popularMovies = await movieApiService.getPopularMovies();
    console.log(`Fetched ${popularMovies.length} movies for seeding.`);
    
    for (const item of popularMovies) {
      const fallbackMovie = new Movie({
        title: item.title,
        originalTitle: item.originalTitle || '',
        releaseDate: item.releaseDate,
        posterUrl: item.posterUrl,
        synopsis: item.synopsis,
        tmdbId: item.refId,
        dataSource: item.source || 'tmdb',
        isPopular: true,
        genre: item.genre || []
      });
      await fallbackMovie.save();
    }
    console.log('Seeded popular movies.');

    const popularCast = await movieApiService.getPopularCast();
    console.log(`Fetched ${popularCast.length} cast members for seeding.`);
    
    for (const item of popularCast) {
      const fallbackCast = new Cast({
        name: item.name,
        photoUrl: item.photoUrl,
        gender: item.gender,
        knownFor: item.knownForDepartment || 'Actor',
        tmdbId: item.tmdbId,
        dataSource: item.source || 'tmdb',
        isPopular: true
      });
      await fallbackCast.save();
    }
    console.log('Seeded popular cast.');

    // Write cache metadata so it counts as clean
    const cacheKey = 'popular_cache';
    const cache = new CacheMetadata({ key: cacheKey, lastUpdated: new Date() });
    await cache.save();
    console.log('Popular cache timestamp created.');

    console.log('All logs and counts refreshed. System is clean and seeded.');
    mongoose.disconnect();
  } catch (err) {
    console.error('Error resetting database:', err);
    mongoose.disconnect();
  }
}

reset();
