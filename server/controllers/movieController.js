const Movie = require('../models/Movie');
const Cast = require('../models/Cast');
const TagAssignment = require('../models/TagAssignment');
const Comment = require('../models/Comment');
const movieApiService = require('../services/movieApiService');
const aiService = require('../services/aiService');

// Helper to check if a cast member exists, or create them
const resolveCastMember = async (actor, dataSource) => {
  let queryCondition = { name: actor.name };
  if (actor.tmdbId) queryCondition.tmdbId = actor.tmdbId;
  else if (actor.imdbId) queryCondition.imdbId = actor.imdbId;

  let castMember = await Cast.findOne(queryCondition);
  
  if (!castMember) {
    // If the imported cast member lacks a photo or contains a placeholder, enrich from TMDB
    const isEmpty = !actor.photoUrl;
    const hasPlaceholder = actor.photoUrl && actor.photoUrl.includes('example.com');
    if (isEmpty || hasPlaceholder) {
      try {
        const movieApiService = require('../services/movieApiService');
        const enriched = await movieApiService.enrichCastProfile(actor.name);
        if (enriched) {
          actor.photoUrl = enriched.photoUrl || actor.photoUrl;
          actor.bio = enriched.bio || actor.bio;
          actor.birthDate = enriched.birthDate || actor.birthDate;
          actor.nationality = enriched.nationality || actor.nationality;
          actor.gender = enriched.gender !== 'Unspecified' ? enriched.gender : actor.gender;
          actor.tmdbId = enriched.tmdbId || actor.tmdbId;
          actor.imdbId = enriched.imdbId || actor.imdbId;
        }
      } catch (err) {
        console.warn(`Failed to enrich actor ${actor.name} on creation:`, err.message);
      }
    }

    castMember = new Cast({
      name: actor.name,
      photoUrl: actor.photoUrl || '',
      bio: actor.bio || '',
      birthDate: actor.birthDate || null,
      nationality: actor.nationality || '',
      knownFor: actor.knownFor || actor.role || 'Actor',
      gender: actor.gender || 'Unspecified',
      imdbId: actor.imdbId || '',
      tmdbId: actor.tmdbId || '',
      dataSource: dataSource || 'manual'
    });
    await castMember.save();
  } else {
    // If the cast member exists but has no gender/photo yet (e.g. from OMDb), update it if TMDB provides it
    let updated = false;
    if (actor.gender && actor.gender !== 'Unspecified' && castMember.gender === 'Unspecified') {
      castMember.gender = actor.gender;
      updated = true;
    }
    if (actor.photoUrl && !castMember.photoUrl) {
      castMember.photoUrl = actor.photoUrl;
      updated = true;
    }
    if (updated) {
      await castMember.save();
    }
  }

  return castMember;
};

// Helper: Process and save cast list
const processCastList = async (rawCast, dataSource, onlyActresses = false) => {
  const processedCast = [];
  if (rawCast && Array.isArray(rawCast)) {
    for (const actor of rawCast) {
      if (!actor.name) continue;

      // Filter out non-female cast members if onlyActresses is enabled
      if (onlyActresses) {
        const isFemale = actor.gender === 'Female' || actor.role === 'Actress';
        if (!isFemale) continue;
      }

      const castMember = await resolveCastMember(actor, dataSource);
      processedCast.push({
        castId: castMember._id,
        characterName: actor.characterName || '',
        role: actor.role || 'Actor'
      });
    }
  }
  return processedCast;
};

// 1. Search External API (Database-First Caching & Merging)
exports.searchExternal = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ message: 'Query parameter q is required' });
    }

    // Step A: Search local database
    const localMovies = await Movie.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { originalTitle: { $regex: query, $options: 'i' } }
      ]
    }).limit(15);

    const formattedLocal = localMovies.map(movie => ({
      title: movie.title,
      originalTitle: movie.originalTitle || '',
      releaseDate: movie.releaseDate,
      posterUrl: movie.posterUrl,
      refId: movie._id.toString(),
      source: 'local',
      mediaType: movie.mediaType || 'movie',
      synopsis: movie.synopsis || ''
    }));

    // Step B: Search TMDB/external sources via movieApiService
    let externalMovies = [];
    try {
      externalMovies = await movieApiService.searchMovies(query);
    } catch (err) {
      console.warn('External search failed in controller:', err.message);
    }

    // Step C: Merge and deduplicate
    const filteredExternal = [];
    for (const item of externalMovies) {
      // Check if this external item is already in our DB by tmdbId, imdbId or exact title match
      let existingLocal = null;
      if (item.source === 'tmdb') {
        existingLocal = localMovies.find(m => m.tmdbId === item.refId);
      } else if (item.source === 'omdb') {
        existingLocal = localMovies.find(m => m.imdbId === item.refId);
      }

      // Fallback check by exact title
      if (!existingLocal) {
        existingLocal = localMovies.find(
          m => m.title.toLowerCase().trim() === item.title.toLowerCase().trim()
        );
      }

      if (existingLocal) {
        // If it is already in our database, it will be included in the formattedLocal list.
        // Therefore, we skip adding it again as an external item.
        continue;
      } else {
        filteredExternal.push(item);
      }
    }

    const combined = [...formattedLocal, ...filteredExternal];
    res.json(combined);
  } catch (error) {
    res.status(500).json({ message: 'External search failed', error: error.message });
  }
};

// 2. Import External Details & Auto-Save (Caching on-the-fly)
exports.importExternalDetails = async (req, res) => {
  try {
    const { refId, source, mediaType = 'movie', title, onlyActresses } = req.query;

    if (!refId || !source) {
      return res.status(400).json({ message: 'Parameters refId and source are required' });
    }

    // A. If source is local, return directly from database
    if (source === 'local') {
      const movie = await Movie.findById(refId).populate('cast.castId');
      if (!movie) return res.status(404).json({ message: 'Local movie not found' });
      return res.json(movie);
    }

    // B. Check if movie already exists locally by reference IDs
    let existingQuery = {};
    if (source === 'tmdb') existingQuery = { tmdbId: refId };
    else if (source === 'omdb') existingQuery = { imdbId: refId };

    if (Object.keys(existingQuery).length > 0) {
      const existingMovie = await Movie.findOne(existingQuery).populate('cast.castId');
      if (existingMovie) {
        return res.json(existingMovie);
      }
    }

    // C. Fetch movie details from external service
    console.log(`Auto-saving lookup details: refId=${refId}, source=${source}, mediaType=${mediaType}`);
    const details = await movieApiService.getMovieDetails(refId, source, title, mediaType);

    // D. Process cast profiles (saving/matching)
    const filterOnlyActresses = onlyActresses === 'true';
    const processedCast = await processCastList(details.cast, details.dataSource, filterOnlyActresses);

    // E. Save Movie/Series to MongoDB
    const newMovie = new Movie({
      title: details.title,
      originalTitle: details.originalTitle || '',
      language: details.language || 'English',
      languages: details.languages || ['English'],
      genre: details.genre || [],
      releaseDate: details.releaseDate,
      status: details.status || 'released',
      mediaType: details.mediaType || mediaType,
      posterUrl: details.posterUrl || '',
      bannerUrl: details.bannerUrl || '',
      synopsis: details.synopsis || '',
      rating: details.rating || 0,
      imdbId: details.imdbId || '',
      tmdbId: details.tmdbId || '',
      dataSource: details.dataSource || source,
      cast: processedCast
    });

    await newMovie.save();
    
    // Populate cast and return
    const populatedMovie = await Movie.findById(newMovie._id).populate('cast.castId');
    res.json(populatedMovie);
  } catch (error) {
    res.status(500).json({ message: 'Fetching/importing details failed', error: error.message });
  }
};

// 3. Create Movie (Manual creation)
exports.createMovie = async (req, res) => {
  try {
    const {
      title,
      originalTitle,
      language,
      languages,
      genre,
      releaseDate,
      status,
      mediaType = 'movie',
      posterUrl,
      bannerUrl,
      synopsis,
      rating,
      imdbId,
      tmdbId,
      dataSource = 'manual',
      rawCast
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Movie title is required' });
    }

    let existingQuery = { title };
    if (tmdbId) existingQuery.tmdbId = tmdbId;
    else if (imdbId) existingQuery.imdbId = imdbId;

    let existingMovie = await Movie.findOne(existingQuery);
    if (existingMovie) {
      return res.status(400).json({ message: 'Movie already imported/created', movie: existingMovie });
    }

    const processedCast = await processCastList(rawCast, dataSource);

    const newMovie = new Movie({
      title,
      originalTitle: originalTitle || '',
      language: language || 'English',
      languages: languages || [language || 'English'],
      genre: genre || [],
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      status: status || 'released',
      mediaType,
      posterUrl: posterUrl || '',
      bannerUrl: bannerUrl || '',
      synopsis: synopsis || '',
      rating: rating || 0,
      imdbId: imdbId || '',
      tmdbId: tmdbId || '',
      dataSource,
      cast: processedCast
    });

    await newMovie.save();
    res.status(201).json(newMovie);
  } catch (error) {
    res.status(500).json({ message: 'Creating movie failed', error: error.message });
  }
};

// 4. Get Movies (Catalogue list with filters & pagination)
exports.getMovies = async (req, res) => {
  try {
    const { page = 1, limit = 10, genre, language, status, mediaType, tagId } = req.query;
    const query = {};

    if (genre) {
      query.genre = { $in: [genre] };
    }
    if (language) {
      query.language = language;
    }
    if (status) {
      query.status = status;
    }
    if (mediaType) {
      query.mediaType = mediaType;
    }

    if (tagId) {
      const assignments = await TagAssignment.find({
        userId: req.user.id,
        tagId,
        entityType: 'movie'
      });
      const movieIds = assignments.map(a => a.entityId);
      query._id = { $in: movieIds };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const movies = await Movie.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await Movie.countDocuments(query);

    res.json({
      movies,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalMovies: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Fetching catalogue failed', error: error.message });
  }
};

// 5. Get Movie by ID (Detail with cast resolved)
exports.getMovieById = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).populate('cast.castId');
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }
    res.json(movie);
  } catch (error) {
    res.status(500).json({ message: 'Fetching movie details failed', error: error.message });
  }
};

// 6. Update Movie
exports.updateMovie = async (req, res) => {
  try {
    const updatedMovie = await Movie.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedMovie) {
      return res.status(404).json({ message: 'Movie not found' });
    }
    res.json(updatedMovie);
  } catch (error) {
    res.status(500).json({ message: 'Updating movie failed', error: error.message });
  }
};

// 7. Delete Movie
exports.deleteMovie = async (req, res) => {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    await TagAssignment.deleteMany({ entityId: movie._id, entityType: 'movie' });
    await Comment.deleteMany({ entityId: movie._id, entityType: 'movie' });

    res.json({ message: 'Movie deleted successfully, associated comments and tag assignments cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Deleting movie failed', error: error.message });
  }
};

// 8. Generate Movie Explanation using Gemini AI
exports.generateExplanation = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).populate('cast.castId');
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Map cast to pass it with names and roles
    const castMembers = movie.cast.map(c => {
      const castDoc = c.castId;
      return {
        name: castDoc ? castDoc.name : 'Unknown',
        characterName: c.characterName,
        role: c.role
      };
    });

    console.log(`Generating AI explanation for Movie: ${movie.title} (${movie._id})...`);
    
    let explanationText;
    let isFallback = false;
    let fallbackError = null;

    try {
      explanationText = await aiService.generateMovieExplanation(movie, castMembers);
    } catch (error) {
      console.warn(`Gemini API call failed, recovering using local fallback generator... Error: ${error.message}`);
      explanationText = aiService.generateLocalFallbackExplanation(movie, castMembers);
      isFallback = true;
      fallbackError = error.message;
    }

    // Save to database
    movie.explanation = explanationText;
    movie.explanationGeneratedAt = new Date();
    await movie.save();

    if (isFallback) {
      return res.json({
        message: 'Failed to reach Gemini API. Generated fallback profile from local metadata.',
        explanation: movie.explanation,
        explanationGeneratedAt: movie.explanationGeneratedAt,
        isFallback: true,
        error: fallbackError
      });
    }

    res.json({
      message: 'Explanation generated successfully',
      explanation: movie.explanation,
      explanationGeneratedAt: movie.explanationGeneratedAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate AI explanation', error: error.message });
  }
};

// 9. Proxy TMDB images to bypass client ISP blocks
exports.proxyImage = async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ message: 'URL query parameter is required' });
    }

    // Security check: only allow TMDB image domain
    const parsedUrl = new URL(imageUrl);
    if (parsedUrl.hostname !== 'image.tmdb.org') {
      return res.status(400).json({ message: 'Only TMDB images can be proxied' });
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch image');
    }

    // Forward content type
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('content-type', contentType);
    }
    
    // Add caching headers to let the browser cache the image
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day

    // Pipe the image buffer to response
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    console.error('Image proxy failed:', error.message);
    res.status(500).send('Image proxy error: ' + error.message);
  }
};

// 10. Preview external movie details without saving to local MongoDB
exports.previewExternalDetails = async (req, res) => {
  try {
    const { refId, source, mediaType = 'movie', title } = req.query;
    if (!refId || !source) {
      return res.status(400).json({ message: 'Parameters refId and source are required' });
    }

    console.log(`Previewing lookup details: refId=${refId}, source=${source}, mediaType=${mediaType}`);
    const details = await movieApiService.getMovieDetails(refId, source, title, mediaType);
    res.json(details);
  } catch (error) {
    res.status(500).json({ message: 'Previewing external details failed', error: error.message });
  }
};

// 11. Autocomplete Search recommendations combining local and live TMDB multi-search results
exports.autocomplete = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    // 1. Local Search (Movies & Cast)
    const localMoviesPromise = Movie.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { originalTitle: { $regex: query, $options: 'i' } }
      ]
    }).limit(5);

    const localCastPromise = Cast.find({
      name: { $regex: query, $options: 'i' }
    }).limit(5);

    // 2. External Search (TMDB Multi Search)
    const externalSearchPromise = movieApiService.searchExternalMulti(query);

    const [localMovies, localCast, externalResults] = await Promise.all([
      localMoviesPromise,
      localCastPromise,
      externalSearchPromise
    ]);

    // Format local results
    const formattedLocalMovies = localMovies.map(movie => ({
      title: movie.title,
      mediaType: movie.mediaType || 'movie',
      source: 'local',
      refId: movie._id.toString(),
      posterUrl: movie.posterUrl || '',
      releaseDate: movie.releaseDate,
      local: true
    }));

    const formattedLocalCast = localCast.map(person => ({
      title: person.name,
      mediaType: 'person',
      source: 'local',
      refId: person._id.toString(),
      posterUrl: person.photoUrl || '',
      releaseDate: null,
      synopsis: person.knownFor || '',
      local: true
    }));

    // Deduplicate external results against local ones using tmdbId/title/name
    const localMovieTmdbIds = new Set(localMovies.map(m => m.tmdbId).filter(Boolean));
    const localMovieTitles = new Set(localMovies.map(m => m.title.toLowerCase().trim()));
    const localCastTmdbIds = new Set(localCast.map(c => c.tmdbId).filter(Boolean));
    const localCastNames = new Set(localCast.map(c => c.name.toLowerCase().trim()));

    const filteredExternal = externalResults.map(item => {
      if (item.mediaType === 'movie' || item.mediaType === 'series') {
        const isLocal = localMovieTmdbIds.has(item.refId) || localMovieTitles.has(item.title.toLowerCase().trim());
        if (isLocal) return null;
      } else if (item.mediaType === 'person') {
        const isLocal = localCastTmdbIds.has(item.refId) || localCastNames.has(item.title.toLowerCase().trim());
        if (isLocal) return null;
      }
      return {
        title: item.title,
        mediaType: item.mediaType,
        source: item.source,
        refId: item.refId,
        posterUrl: item.posterUrl,
        releaseDate: item.releaseDate,
        synopsis: item.synopsis || '',
        local: false
      };
    }).filter(Boolean);

    const combined = [...formattedLocalMovies, ...formattedLocalCast, ...filteredExternal];
    res.json(combined.slice(0, 15));
  } catch (error) {
    console.error('Autocomplete failed:', error);
    res.status(500).json({ message: 'Autocomplete failed', error: error.message });
  }
};

let isSyncingPopular = false;

// Helper to run background popular movies & cast cache sync
const runPopularSync = async () => {
  if (isSyncingPopular) {
    console.log('Background Cache Sync: Already syncing, skipping parallel run.');
    return;
  }
  isSyncingPopular = true;
  const movieApiService = require('../services/movieApiService');
  console.log('Background Cache Sync: Starting fetching popular content from TMDB...');

  try {
    // 1. Fetch & Caching Popular Movies
    const popularMovies = await movieApiService.getPopularMovies();
    await Movie.updateMany({ isPopular: true }, { $set: { isPopular: false } });

    for (const item of popularMovies) {
      let movie = await Movie.findOne({ tmdbId: item.refId });
      const isComplete = movie && movie.posterUrl && movie.cast && movie.cast.length > 0;

      if (movie && isComplete) {
        movie.isPopular = true;
        movie.posterUrl = item.posterUrl || movie.posterUrl;
        movie.synopsis = item.synopsis || movie.synopsis;
        movie.rating = item.rating || movie.rating;
        await movie.save();
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

          if (movie) {
            // Update the existing movie to heal empty/incomplete data
            movie.originalTitle = details.originalTitle || movie.originalTitle;
            movie.language = details.language || movie.language;
            movie.languages = details.languages || movie.languages;
            movie.genre = details.genre || movie.genre;
            movie.releaseDate = details.releaseDate || movie.releaseDate;
            movie.status = details.status || movie.status;
            movie.posterUrl = details.posterUrl || movie.posterUrl;
            movie.bannerUrl = details.bannerUrl || movie.bannerUrl;
            movie.synopsis = details.synopsis || movie.synopsis;
            movie.rating = details.rating || movie.rating;
            movie.imdbId = details.imdbId || movie.imdbId;
            movie.dataSource = 'tmdb';
            movie.isPopular = true;
            movie.cast = processedCast;
            await movie.save();
          } else {
            // Create a new movie
            const newMovie = new Movie({
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
          }
        } catch (movieErr) {
          console.warn(`Full cache failed for popular movie ID ${item.refId}:`, movieErr.message);
          if (movie) {
            movie.isPopular = true;
            movie.posterUrl = item.posterUrl || movie.posterUrl;
            movie.synopsis = item.synopsis || movie.synopsis;
            movie.rating = item.rating || movie.rating;
            await movie.save();
          } else {
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
        }
      }
    }

    // 2. Fetch & Caching Popular Cast Members
    const popularCast = await movieApiService.getPopularCast();
    await Cast.updateMany({ isPopular: true }, { $set: { isPopular: false } });

    for (const item of popularCast) {
      let castMember = await Cast.findOne({ tmdbId: item.tmdbId });
      if (castMember) {
        castMember.isPopular = true;
        castMember.photoUrl = item.photoUrl || castMember.photoUrl;
        await castMember.save();
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
        }
      }
    }

    console.log('Background Cache Sync: Weekly sync completed successfully.');
  } catch (err) {
    console.error('Background Cache Sync failed:', err.message);
    throw err;
  } finally {
    isSyncingPopular = false;
  }
};

// Helper: check popular cache metadata
const refreshPopularCacheIfExpired = async (force = false) => {
  try {
    const CacheMetadata = require('../models/CacheMetadata');
    const cacheKey = 'popular_cache';
    let cache = await CacheMetadata.findOne({ key: cacheKey });
    const now = new Date();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

    if (force || !cache || (now - cache.lastUpdated > sevenDaysInMs)) {
      console.log(force ? 'Force sync requested. Triggering popular cache update...' : 'Popular cache expired or missing. Triggering weekly background cache update...');
      runPopularSync()
        .then(async () => {
          let cacheToSave = await CacheMetadata.findOne({ key: cacheKey });
          if (!cacheToSave) {
            cacheToSave = new CacheMetadata({ key: cacheKey, lastUpdated: new Date() });
          } else {
            cacheToSave.lastUpdated = new Date();
          }
          await cacheToSave.save();
          console.log('Popular cache timestamp updated in DB.');
        })
        .catch(err => console.error('Popular sync trigger failed:', err.message));
    }
  } catch (err) {
    console.error('Checking popular cache status failed:', err.message);
  }
};

// Controller: Get popular movies (with weekly cache refresh check)
exports.getPopularMovies = async (req, res) => {
  try {
    const forceSync = req.query.forceSync === 'true';
    await refreshPopularCacheIfExpired(forceSync);
    const popular = await Movie.find({ isPopular: true }).sort({ rating: -1, releaseDate: -1 }).limit(20);

    const formatted = popular.map(movie => ({
      _id: movie._id.toString(),
      title: movie.title,
      originalTitle: movie.originalTitle || '',
      releaseDate: movie.releaseDate,
      posterUrl: movie.posterUrl,
      refId: movie._id.toString(),
      source: 'local',
      mediaType: movie.mediaType || 'movie',
      synopsis: movie.synopsis || '',
      genre: movie.genre || []
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Fetching popular movies failed', error: error.message });
  }
};

exports.refreshPopularCacheIfExpired = refreshPopularCacheIfExpired;
