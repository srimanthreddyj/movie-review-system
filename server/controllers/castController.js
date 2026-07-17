const Cast = require('../models/Cast');
const Movie = require('../models/Movie');
const TagAssignment = require('../models/TagAssignment');

// 1. Get Cast members (search + tags + pagination)
exports.getCasts = async (req, res) => {
  try {
    const { page = 1, limit = 10, q, tagId, gender, knownFor } = req.query;
    const query = {};

    // Filter by name search
    if (q) {
      query.name = { $regex: q, $options: 'i' };
    }

    // Filter by gender
    if (gender) {
      query.gender = gender;
    }

    // Filter by role/knownFor
    if (knownFor) {
      query.knownFor = knownFor;
    }

    // Filter by User-Scoped Tag Assignment
    if (tagId) {
      const assignments = await TagAssignment.find({
        userId: req.user.id,
        tagId,
        entityType: 'cast'
      });
      const castIds = assignments.map(a => a.entityId);
      query._id = { $in: castIds };
    } else if (req.user.role !== 'admin') {
      query.isPopular = true;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const casts = await Cast.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ name: 1 });

    const total = await Cast.countDocuments(query);

    // Asynchronously enrich cast member records lacking photos in the background
    casts.forEach(castMember => {
      const hasPlaceholder = castMember.photoUrl && castMember.photoUrl.includes('example.com');
      const isEmpty = !castMember.photoUrl;
      if (isEmpty || hasPlaceholder) {
        const movieApiService = require('../services/movieApiService');
        movieApiService.enrichCastProfile(castMember.name).then(async (enriched) => {
          if (enriched) {
            castMember.photoUrl = enriched.photoUrl || castMember.photoUrl;
            castMember.gender = enriched.gender !== 'Unspecified' ? enriched.gender : castMember.gender;
            if (enriched.bio) castMember.bio = enriched.bio;
            if (enriched.birthDate) castMember.birthDate = enriched.birthDate;
            if (enriched.nationality) castMember.nationality = enriched.nationality;
            if (enriched.tmdbId) castMember.tmdbId = enriched.tmdbId;
            if (enriched.imdbId) castMember.imdbId = enriched.imdbId;
            await castMember.save();
          }
        }).catch(err => console.warn(`Background enrichment failed for ${castMember.name}:`, err.message));
      }
    });

    res.json({
      casts,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalCasts: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Fetching cast members failed', error: error.message });
  }
};

// 2. Get Cast by ID (With Dynamic Filmography compilation)
exports.getCastById = async (req, res) => {
  try {
    let castMember = await Cast.findById(req.params.id);
    if (!castMember) {
      return res.status(404).json({ message: 'Cast member not found' });
    }

    // On-the-fly enrichment for placeholder or empty cast details
    const hasPlaceholder = castMember.photoUrl && castMember.photoUrl.includes('example.com');
    const isEmpty = !castMember.photoUrl;
    if (isEmpty || hasPlaceholder) {
      const movieApiService = require('../services/movieApiService');
      const enriched = await movieApiService.enrichCastProfile(castMember.name);
      if (enriched) {
        castMember.photoUrl = enriched.photoUrl || castMember.photoUrl;
        castMember.gender = enriched.gender !== 'Unspecified' ? enriched.gender : castMember.gender;
        if (enriched.bio) castMember.bio = enriched.bio;
        if (enriched.birthDate) castMember.birthDate = enriched.birthDate;
        if (enriched.nationality) castMember.nationality = enriched.nationality;
        if (enriched.tmdbId) castMember.tmdbId = enriched.tmdbId;
        if (enriched.imdbId) castMember.imdbId = enriched.imdbId;
        await castMember.save();
      }
    }

    let filmography = [];
    let fetchedFromTmdb = false;

    if (castMember.tmdbId) {
      try {
        const movieApiService = require('../services/movieApiService');
        const tmdbCredits = await movieApiService.getTmdbPersonMovieCredits(castMember.tmdbId, castMember.name);

        if (tmdbCredits && tmdbCredits.length > 0) {
          const tmdbIds = tmdbCredits.map(c => c.tmdbId);
          // Find all local movies with these tmdbIds
          const localMovies = await Movie.find({ tmdbId: { $in: tmdbIds } })
            .select('_id tmdbId title posterUrl releaseDate');

          const localMoviesMap = new Map();
          localMovies.forEach(m => {
            if (m.tmdbId) localMoviesMap.set(m.tmdbId.toString(), m);
          });

          filmography = tmdbCredits.map(credit => {
            const localMovie = localMoviesMap.get(credit.tmdbId);
            return {
              movieId: localMovie ? localMovie._id.toString() : `tmdb-${credit.tmdbId}`,
              title: localMovie ? localMovie.title : credit.title,
              releaseDate: localMovie ? localMovie.releaseDate : credit.releaseDate,
              posterUrl: localMovie ? localMovie.posterUrl : credit.posterUrl,
              characterName: credit.characterName,
              role: credit.role,
              source: localMovie ? 'local' : 'tmdb'
            };
          });
          fetchedFromTmdb = true;
        }
      } catch (err) {
        console.warn(`Failed to fetch TMDB movie credits for cast ${castMember.name}:`, err.message);
      }
    }

    if (!fetchedFromTmdb) {
      // Dynamic Filmography fallback: find all movies where this castId is linked locally
      const movies = await Movie.find({ 'cast.castId': castMember._id })
        .select('title releaseDate posterUrl cast')
        .sort({ releaseDate: -1 });

      filmography = movies.map(movie => {
        const castLink = movie.cast.find(c => c.castId.toString() === castMember._id.toString());
        return {
          movieId: movie._id.toString(),
          title: movie.title,
          releaseDate: movie.releaseDate,
          posterUrl: movie.posterUrl,
          characterName: castLink ? castLink.characterName : '',
          role: castLink ? castLink.role : 'Actor',
          source: 'local'
        };
      });
    }

    // Sort by release date descending
    filmography.sort((a, b) => {
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return new Date(b.releaseDate) - new Date(a.releaseDate);
    });

    res.json({
      castMember,
      filmography
    });
  } catch (error) {
    res.status(500).json({ message: 'Fetching cast details failed', error: error.message });
  }
};

// 3. Create Custom Cast Member (Admin only)
exports.createCast = async (req, res) => {
  try {
    const { name, photoUrl, bio, birthDate, nationality, knownFor, gender } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const newCast = new Cast({
      name,
      photoUrl: photoUrl || '',
      bio: bio || '',
      birthDate: birthDate ? new Date(birthDate) : null,
      nationality: nationality || '',
      knownFor: knownFor || 'Actor',
      gender: gender || 'Unspecified',
      dataSource: 'manual'
    });

    await newCast.save();
    res.status(201).json(newCast);
  } catch (error) {
    res.status(500).json({ message: 'Creating cast member failed', error: error.message });
  }
};

// 4. Update Cast Member (Admin only)
exports.updateCast = async (req, res) => {
  try {
    const updatedCast = await Cast.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedCast) {
      return res.status(404).json({ message: 'Cast member not found' });
    }
    res.json(updatedCast);
  } catch (error) {
    res.status(500).json({ message: 'Updating cast member failed', error: error.message });
  }
};

// 5. Search External Persons (TMDB & Local Merging)
exports.searchExternalCast = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ message: 'Query parameter q is required' });
    }

    // 1. Search TMDB external profiles
    const movieApiService = require('../services/movieApiService');
    let externalResults = [];
    try {
      externalResults = await movieApiService.searchExternalPersons(query);
    } catch (err) {
      console.warn('External cast search failed:', err.message);
    }

    // 2. Fetch local equivalents to substitute
    const tmdbIds = externalResults.filter(c => c.tmdbId).map(c => c.tmdbId);
    const localCast = await Cast.find({ tmdbId: { $in: tmdbIds } });

    // 3. Merge and deduplicate
    const combined = externalResults.map(item => {
      let existingLocal = null;
      if (item.tmdbId) {
        existingLocal = localCast.find(c => c.tmdbId === item.tmdbId);
      }

      if (existingLocal) {
        return {
          name: existingLocal.name,
          tmdbId: existingLocal.tmdbId,
          photoUrl: existingLocal.photoUrl,
          gender: existingLocal.gender,
          knownForDepartment: existingLocal.knownFor || 'Acting',
          knownFor: '',
          source: 'local',
          refId: existingLocal._id.toString()
        };
      }
      
      return {
        name: item.name,
        tmdbId: item.tmdbId,
        photoUrl: item.photoUrl,
        gender: item.gender,
        knownForDepartment: item.knownForDepartment || 'Acting',
        knownFor: item.knownFor || '',
        source: item.source || 'tmdb',
        refId: item.tmdbId
      };
    });
    res.json(combined);
  } catch (error) {
    res.status(500).json({ message: 'External cast search failed', error: error.message });
  }
};

// 6. Import External Cast Profile (TMDB)
exports.importExternalCast = async (req, res) => {
  try {
    const tmdbId = req.body.tmdbId || req.query.tmdbId;
    if (!tmdbId) {
      return res.status(400).json({ message: 'Parameter tmdbId is required' });
    }

    // Check if cast member already exists locally
    let castMember = await Cast.findOne({ tmdbId: tmdbId.toString() });
    if (castMember) {
      return res.json(castMember);
    }

    const movieApiService = require('../services/movieApiService');
    // Fetch full details from TMDB
    const details = await movieApiService.getTmdbPersonDetails(tmdbId);

    // Check by name if we don't find it by tmdbId, to prevent duplicates
    castMember = await Cast.findOne({ name: details.name });
    if (castMember) {
      // Update existing cast member with TMDB details
      castMember.tmdbId = details.tmdbId;
      if (details.photoUrl && !castMember.photoUrl) castMember.photoUrl = details.photoUrl;
      if (details.bio && !castMember.bio) castMember.bio = details.bio;
      if (details.birthDate && !castMember.birthDate) castMember.birthDate = details.birthDate;
      if (details.nationality && !castMember.nationality) castMember.nationality = details.nationality;
      if (details.gender && castMember.gender === 'Unspecified') castMember.gender = details.gender;
      await castMember.save();
      return res.json(castMember);
    }

    // Create new cast member
    castMember = new Cast({
      name: details.name,
      photoUrl: details.photoUrl || '',
      bio: details.bio || '',
      birthDate: details.birthDate,
      nationality: details.nationality || '',
      knownFor: 'Actor',
      gender: details.gender || 'Unspecified',
      tmdbId: details.tmdbId,
      imdbId: details.imdbId || '',
      dataSource: 'tmdb'
    });

    await castMember.save();
    res.status(201).json(castMember);
  } catch (error) {
    res.status(500).json({ message: 'Importing external cast failed', error: error.message });
  }
};

// 7. Preview external cast details before importing
exports.previewExternalCast = async (req, res) => {
  try {
    const tmdbId = req.query.tmdbId;
    const name = req.query.name;
    if (!tmdbId && !name) {
      return res.status(400).json({ message: 'Parameters tmdbId or name are required' });
    }

    const movieApiService = require('../services/movieApiService');
    let details;
    if (tmdbId) {
      try {
        details = await movieApiService.getTmdbPersonDetails(tmdbId);
      } catch (err) {
        console.warn('TMDB Person Details failed in preview, falling back to name enrich...', err.message);
        if (name) {
          details = await movieApiService.enrichCastProfile(name);
        }
      }
    } else if (name) {
      details = await movieApiService.enrichCastProfile(name);
    }

    if (!details) {
      return res.status(404).json({ message: 'External cast details not found' });
    }

    let filmography = [];
    if (details.tmdbId) {
      try {
        const tmdbCredits = await movieApiService.getTmdbPersonMovieCredits(details.tmdbId, details.name);
        if (tmdbCredits && tmdbCredits.length > 0) {
          const tmdbIds = tmdbCredits.map(c => c.tmdbId);
          const localMovies = await Movie.find({ tmdbId: { $in: tmdbIds } })
            .select('_id tmdbId title posterUrl releaseDate');

          const localMoviesMap = new Map();
          localMovies.forEach(m => {
            if (m.tmdbId) localMoviesMap.set(m.tmdbId.toString(), m);
          });

          filmography = tmdbCredits.map(credit => {
            const localMovie = localMoviesMap.get(credit.tmdbId);
            return {
              movieId: localMovie ? localMovie._id.toString() : `tmdb-${credit.tmdbId}`,
              title: localMovie ? localMovie.title : credit.title,
              releaseDate: localMovie ? localMovie.releaseDate : credit.releaseDate,
              posterUrl: localMovie ? localMovie.posterUrl : credit.posterUrl,
              characterName: credit.characterName,
              role: credit.role,
              source: localMovie ? 'local' : 'tmdb'
            };
          });

          // Sort by release date descending
          filmography.sort((a, b) => {
            if (!a.releaseDate) return 1;
            if (!b.releaseDate) return -1;
            return new Date(b.releaseDate) - new Date(a.releaseDate);
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch TMDB movie credits for external preview cast ${details.name}:`, err.message);
      }
    }

    res.json({
      ...details,
      filmography
    });
  } catch (error) {
    res.status(500).json({ message: 'Previewing external cast failed', error: error.message });
  }
};

// Controller: Get popular cast members (cached weekly)
exports.getPopularCast = async (req, res) => {
  try {
    const popular = await Cast.find({ isPopular: true }).sort({ name: 1 }).limit(20);
    const formatted = popular.map(c => ({
      _id: c._id.toString(),
      name: c.name,
      tmdbId: c.tmdbId,
      photoUrl: c.photoUrl,
      gender: c.gender,
      knownForDepartment: c.knownFor || 'Acting',
      knownFor: '',
      source: 'local',
      refId: c._id.toString()
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Fetching popular cast members failed', error: error.message });
  }
};
