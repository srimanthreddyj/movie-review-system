require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Movie = require('./models/User'); // wait, let's make sure models are loaded correctly
const Cast = require('./models/Cast');
const MovieModel = require('./models/Movie');

const runPopularSync = async () => {
  const movieApiService = require('./services/movieApiService');
  console.log('Background Cache Sync: Starting fetching popular content from TMDB...');

  try {
    // 1. Fetch & Caching Popular Movies
    const popularMovies = await movieApiService.getPopularMovies();
    console.log(`Fetched ${popularMovies.length} popular movies from TMDB.`);
    
    // Clear previous popular flags
    await MovieModel.updateMany({ isPopular: true }, { $set: { isPopular: false } });
    console.log('Cleared existing local isPopular flags for movies.');

    let successCount = 0;
    for (const item of popularMovies) {
      console.log(`Syncing movie: "${item.title}" (TMDB ID: ${item.refId})`);
      let movie = await MovieModel.findOne({ tmdbId: item.refId });
      if (movie) {
        movie.isPopular = true;
        movie.posterUrl = item.posterUrl || movie.posterUrl;
        movie.synopsis = item.synopsis || movie.synopsis;
        movie.rating = item.rating || movie.rating;
        await movie.save();
        console.log(`Updated existing popular movie: "${item.title}"`);
        successCount++;
      } else {
        try {
          if (item.source === 'gemini') {
            throw new Error('Gemini source early bypass');
          }
          const details = await movieApiService.getMovieDetails(item.refId, 'tmdb', item.title, 'movie');
          const processedCast = [];
          if (details.cast && Array.isArray(details.cast)) {
            for (const actor of details.cast) {
              if (!actor.name) continue;
              let castMember = await Cast.findOne({
                $or: [{ tmdbId: actor.tmdbId }, { name: actor.name }]
              });
              if (!castMember) {
                castMember = new Cast({
                  name: actor.name,
                  photoUrl: actor.photoUrl || '',
                  bio: actor.bio || '',
                  gender: actor.gender || 'Unspecified',
                  tmdbId: actor.tmdbId || '',
                  knownFor: actor.knownFor || 'Actor',
                  dataSource: 'tmdb'
                });
                await castMember.save();
              } else if (actor.tmdbId && !castMember.tmdbId) {
                castMember.tmdbId = actor.tmdbId;
                await castMember.save();
              }
              processedCast.push({
                castId: castMember._id,
                characterName: actor.characterName || '',
                role: actor.role || 'Actor'
              });
            }
          }

          const newMovie = new MovieModel({
            title: details.title,
            originalTitle: details.originalTitle || '',
            language: details.language || 'English',
            languages: details.languages || ['English'],
            genre: details.genre || [],
            releaseDate: details.releaseDate,
            status: details.status || 'released',
            mediaType: 'movie',
            posterUrl: details.posterUrl || '',
            bannerUrl: details.bannerUrl || '',
            synopsis: details.synopsis || '',
            rating: details.rating || 0,
            imdbId: details.imdbId || '',
            tmdbId: details.tmdbId || '',
            dataSource: 'tmdb',
            isPopular: true,
            cast: processedCast
          });
          await newMovie.save();
          console.log(`Created new popular movie in catalog: "${details.title}"`);
          successCount++;
        } catch (movieErr) {
          console.warn(`Full cache failed for popular movie ID ${item.refId}:`, movieErr.message);
          const fallbackMovie = new MovieModel({
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
          console.log(`Created fallback popular movie in catalog: "${item.title}"`);
          successCount++;
        }
      }
    }
    console.log(`Successfully synced ${successCount} popular movies.`);

    // 2. Fetch & Caching Popular Cast Members
    const popularCast = await movieApiService.getPopularCast();
    console.log(`Fetched ${popularCast.length} popular cast members from TMDB.`);
    await Cast.updateMany({ isPopular: true }, { $set: { isPopular: false } });
    console.log('Cleared existing local isPopular flags for cast.');

    let castSuccessCount = 0;
    for (const item of popularCast) {
      console.log(`Syncing cast member: "${item.name}" (TMDB ID: ${item.tmdbId})`);
      const queryConditions = [];
      if (item.tmdbId) queryConditions.push({ tmdbId: item.tmdbId });
      queryConditions.push({ name: item.name });

      let castMember = await Cast.findOne({ $or: queryConditions });
      if (castMember) {
        castMember.isPopular = true;
        if (item.tmdbId && !castMember.tmdbId) castMember.tmdbId = item.tmdbId;
        castMember.photoUrl = item.photoUrl || castMember.photoUrl;
        await castMember.save();
        console.log(`Updated existing popular cast: "${item.name}"`);
        castSuccessCount++;
      } else {
        try {
          if (item.source === 'gemini') {
            throw new Error('Gemini source early bypass');
          }
          const details = await movieApiService.getTmdbPersonDetails(item.tmdbId);
          const newCast = new Cast({
            name: details.name,
            photoUrl: details.photoUrl || '',
            bio: details.bio || '',
            birthDate: details.birthDate,
            nationality: details.nationality || '',
            gender: details.gender || 'Unspecified',
            tmdbId: details.tmdbId,
            imdbId: details.imdbId || '',
            dataSource: 'tmdb',
            isPopular: true
          });
          await newCast.save();
          console.log(`Created new popular cast in catalog: "${details.name}"`);
          castSuccessCount++;
        } catch (castErr) {
          console.warn(`Full cache failed for popular cast ID ${item.tmdbId}:`, castErr.message);
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
          console.log(`Created fallback popular cast in catalog: "${item.name}"`);
          castSuccessCount++;
        }
      }
    }
    console.log(`Successfully synced ${castSuccessCount} popular cast members.`);
    console.log('Background Cache Sync: Weekly sync completed successfully.');
  } catch (err) {
    console.error('Background Cache Sync failed:', err.message);
  }
};

async function test() {
  await connectDB();
  await runPopularSync();
  mongoose.disconnect();
}

test();
