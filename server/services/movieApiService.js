const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
const { isExternalApiEnabled } = require('../controllers/settingsController');

// Helper: Fetch with timeout using AbortController
const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(id);
  }
};

// Helper: Query Gemini API iterating over available models
const queryGemini = async (prompt) => {
  if (!isExternalApiEnabled()) throw new Error('External APIs are disabled by Admin');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API Key missing');

  const models = ['gemini-2.5-flash', 'gemini-flash-latest'];
  let lastError;
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }, 40000);

      if (response.ok) {
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
      } else {
        const errText = await response.text();
        lastError = new Error(`Gemini model ${model} failed with status ${response.status}: ${errText}`);
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('All Gemini models failed');
};

// Helper: Format TMDB poster/backdrop paths
const getTmdbImageUrl = (path, size = 'w500') => {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : '';
};

// Helper: Fetch poster from OMDb using title and optional year/releaseDate
const fetchPosterFromOMDB = async (title, yearOrDate) => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey || !title) return '';

  const queryOMDB = async (url) => {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const data = await res.json();
        if (data.Response !== 'False' && data.Poster && data.Poster !== 'N/A') {
          return data.Poster;
        }
      }
    } catch (err) {
      console.warn(`OMDb fetch error:`, err.message);
    }
    return '';
  };

  try {
    let yearStr = '';
    if (yearOrDate) {
      if (yearOrDate instanceof Date) {
        yearStr = yearOrDate.getFullYear().toString();
      } else if (typeof yearOrDate === 'string') {
        yearStr = yearOrDate.split('-')[0];
      }
    }

    if (yearStr && /^\d{4}$/.test(yearStr)) {
      const urlWithYear = `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(title)}&y=${yearStr}`;
      const poster = await queryOMDB(urlWithYear);
      if (poster) return poster;
    }

    const urlWithoutYear = `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(title)}`;
    return await queryOMDB(urlWithoutYear);
  } catch (err) {
    console.warn(`OMDb poster fetch failed for ${title}:`, err.message);
  }
  return '';
};

// Helper to map TMDB gender codes to strings
const mapGender = (g) => {
  if (g === 1) return 'Female';
  if (g === 2) return 'Male';
  if (g === 3) return 'Non-binary';
  return 'Unspecified';
};

// Helper: Prioritise actresses and apply cap and deduplicate
const filterAndCapCast = (castArray) => {
  const maxLimit = parseInt(process.env.MAX_CAST_IMPORT_LIMIT || '8');
  
  // Deduplicate by tmdbId or name, keeping the first role (Actor prioritized)
  const uniqueMap = new Map();
  castArray.forEach(c => {
    const key = c.tmdbId || c.name;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { ...c });
    }
  });
  const uniqueCastArray = Array.from(uniqueMap.values());
  
  // Separate Actors and Crew
  const actors = uniqueCastArray.filter(c => c.role.includes('Actor') || c.role.includes('Actress'));
  const crew = uniqueCastArray.filter(c => !c.role.includes('Actor') && !c.role.includes('Actress'));

  // Prioritise Actresses (gender === 'Female' first)
  const femaleActors = actors.filter(a => a.gender === 'Female');
  const otherActors = actors.filter(a => a.gender !== 'Female');
  
  const sortedActors = [...femaleActors, ...otherActors];
  const cappedActors = sortedActors.slice(0, maxLimit);

  // Return capped actors + all key crew members (Director, Writer, etc.)
  return [...cappedActors, ...crew];
};

// 1. TMDB API Client
const searchTMDB = async (query) => {
  if (!isExternalApiEnabled()) throw new Error('External APIs are disabled by Admin');
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB API Key missing');

  // A. Search Movies
  const movieUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US`;
  // B. Search TV Series
  const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US`;

  const results = [];

  try {
    const movieRes = await fetchWithTimeout(movieUrl);
    if (movieRes.ok) {
      const data = await movieRes.json();
      (data.results || []).forEach(movie => {
        results.push({
          title: movie.title,
          originalTitle: movie.original_title || '',
          releaseDate: movie.release_date ? new Date(movie.release_date) : null,
          posterUrl: getTmdbImageUrl(movie.poster_path),
          refId: movie.id.toString(),
          source: 'tmdb',
          mediaType: 'movie',
          synopsis: movie.overview || ''
        });
      });
    }
  } catch (err) {
    console.warn('TMDB Movie Search failed in helper:', err.message);
  }

  try {
    const tvRes = await fetchWithTimeout(tvUrl);
    if (tvRes.ok) {
      const data = await tvRes.json();
      (data.results || []).forEach(show => {
        results.push({
          title: show.name, // TV show name is in show.name
          originalTitle: show.original_name || '',
          releaseDate: show.first_air_date ? new Date(show.first_air_date) : null,
          posterUrl: getTmdbImageUrl(show.poster_path),
          refId: show.id.toString(),
          source: 'tmdb',
          mediaType: 'series',
          synopsis: show.overview || ''
        });
      });
    }
  } catch (err) {
    console.warn('TMDB TV Search failed in helper:', err.message);
  }

  return results;
};

const getTMDBDetails = async (tmdbId, mediaType = 'movie') => {
  if (!isExternalApiEnabled()) throw new Error('External APIs are disabled by Admin');
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB API Key missing');

  const pathType = mediaType === 'series' ? 'tv' : 'movie';
  const url = `https://api.themoviedb.org/3/${pathType}/${tmdbId}?api_key=${apiKey}&append_to_response=credits&language=en-US`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`TMDB Details failed: ${res.statusText}`);
  
  const movie = await res.json();
  
  const castList = [];
  
  // Extract actors
  if (movie.credits && movie.credits.cast) {
    movie.credits.cast.forEach(actor => {
      castList.push({
        name: actor.name,
        characterName: actor.character || '',
        role: actor.gender === 1 ? 'Actress' : 'Actor',
        gender: mapGender(actor.gender),
        tmdbId: actor.id.toString(),
        photoUrl: getTmdbImageUrl(actor.profile_path),
        knownFor: 'Actor'
      });
    });
  }

  // Extract key crew (Director, Producer, Writer, Composer)
  if (movie.credits && movie.credits.crew) {
    movie.credits.crew.forEach(member => {
      const isKeyCrew = mediaType === 'series' 
        ? ['Executive Producer', 'Director', 'Writer', 'Composer'].includes(member.job)
        : ['Director', 'Producer', 'Composer', 'Writer'].includes(member.job);
        
      if (isKeyCrew) {
        castList.push({
          name: member.name,
          characterName: '',
          role: member.job === 'Executive Producer' ? 'Producer' : member.job,
          gender: mapGender(member.gender),
          tmdbId: member.id.toString(),
          photoUrl: getTmdbImageUrl(member.profile_path),
          knownFor: member.job
        });
      }
    });
  }

  // Fallback for TV Series creators if no direct director/writer crew listed
  if (mediaType === 'series' && movie.created_by && Array.isArray(movie.created_by)) {
    movie.created_by.forEach(creator => {
      castList.push({
        name: creator.name,
        characterName: '',
        role: 'Writer',
        gender: mapGender(creator.gender),
        tmdbId: creator.id.toString(),
        photoUrl: getTmdbImageUrl(creator.profile_path),
        knownFor: 'Writer'
      });
    });
  }

  // Prioritise Actresses and Cap
  const finalCast = filterAndCapCast(castList);

  return {
    title: movie.title || movie.name,
    originalTitle: movie.original_title || movie.original_name || '',
    language: movie.original_language || 'en',
    languages: (movie.spoken_languages || []).map(l => l.english_name || l.name),
    genre: (movie.genres || []).map(g => g.name),
    releaseDate: movie.release_date || movie.first_air_date ? new Date(movie.release_date || movie.first_air_date) : null,
    status: movie.status && movie.status.toLowerCase() === 'upcoming' ? 'upcoming' : 'released',
    mediaType,
    posterUrl: getTmdbImageUrl(movie.poster_path),
    bannerUrl: getTmdbImageUrl(movie.backdrop_path, 'original'),
    synopsis: movie.overview || '',
    rating: movie.vote_average || 0,
    tmdbId: movie.id.toString(),
    imdbId: movie.imdb_id || '',
    dataSource: 'tmdb',
    cast: finalCast
  };
};

// 2. OMDb API Client
const searchOMDB = async (query) => {
  if (!isExternalApiEnabled()) throw new Error('External APIs are disabled by Admin');
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) throw new Error('OMDb API Key missing');

  const url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`OMDb Search failed: ${res.statusText}`);
  
  const data = await res.json();
  if (data.Response === 'False') return [];

  return (data.Search || []).map(item => ({
    title: item.Title,
    originalTitle: '',
    releaseDate: item.Year ? new Date(`${item.Year.split('–')[0]}-01-01`) : null, // handle '2019–' series year strings
    posterUrl: item.Poster && item.Poster !== 'N/A' ? item.Poster : '',
    refId: item.imdbID,
    source: 'omdb',
    mediaType: item.Type === 'series' ? 'series' : 'movie',
    synopsis: ''
  }));
};

const getOMDBDetails = async (imdbId) => {
  if (!isExternalApiEnabled()) throw new Error('External APIs are disabled by Admin');
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) throw new Error('OMDb API Key missing');

  const url = `https://www.omdbapi.com/?apikey=${apiKey}&i=${imdbId}&plot=full`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`OMDb Details failed: ${res.statusText}`);
  
  const movie = await res.json();
  if (movie.Response === 'False') throw new Error(movie.Error || 'OMDb error');

  const castList = [];

  const parsePeopleList = (listStr, role) => {
    if (!listStr || listStr === 'N/A') return;
    listStr.split(',').map(s => s.trim()).forEach(name => {
      castList.push({
        name,
        characterName: role === 'Actor' ? 'Cast Member' : '',
        role,
        gender: 'Unspecified', // OMDb doesn't return gender details
        photoUrl: '',
        knownFor: role
      });
    });
  };

  parsePeopleList(movie.Actors, 'Actor');
  parsePeopleList(movie.Director, 'Director');
  parsePeopleList(movie.Writer, 'Writer');

  const finalCast = filterAndCapCast(castList);

  let rating = 0;
  if (movie.imdbRating && movie.imdbRating !== 'N/A') {
    rating = parseFloat(movie.imdbRating);
  }

  let releaseDate = null;
  if (movie.Released && movie.Released !== 'N/A') {
    releaseDate = new Date(movie.Released);
  } else if (movie.Year && movie.Year !== 'N/A') {
    releaseDate = new Date(`${movie.Year.split('–')[0]}-01-01`);
  }

  return {
    title: movie.Title,
    originalTitle: '',
    language: movie.Language ? movie.Language.split(',')[0].trim() : 'English',
    languages: movie.Language ? movie.Language.split(',').map(s => s.trim()) : ['English'],
    genre: movie.Genre ? movie.Genre.split(',').map(s => s.trim()) : [],
    releaseDate,
    status: 'released',
    mediaType: movie.Type === 'series' ? 'series' : 'movie',
    posterUrl: movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : '',
    bannerUrl: '',
    synopsis: movie.Plot && movie.Plot !== 'N/A' ? movie.Plot : '',
    rating,
    imdbId: movie.imdbID,
    tmdbId: '',
    dataSource: 'omdb',
    cast: finalCast
  };
};

// 3. Wikidata Client
const searchWikidata = async (query) => {
  if (!isExternalApiEnabled()) throw new Error('External APIs are disabled by Admin');
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&type=item`;
  const res = await fetchWithTimeout(searchUrl);
  if (!res.ok) throw new Error(`Wikidata Search failed: ${res.statusText}`);
  const data = await res.json();

  return (data.search || []).map(item => ({
    title: item.label,
    originalTitle: '',
    releaseDate: null,
    posterUrl: '',
    refId: item.id,
    source: 'wikidata',
    mediaType: 'movie', // default to movie for wikidata
    synopsis: item.description || ''
  }));
};

const getWikidataDetails = async (wikidataId) => {
  if (!isExternalApiEnabled()) throw new Error('External APIs are disabled by Admin');
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Wikidata Details failed: ${res.statusText}`);
  const data = await res.json();
  const entity = data.entities[wikidataId];
  if (!entity) throw new Error('Wikidata entity not found');

  const title = entity.labels && entity.labels.en ? entity.labels.en.value : 'Unknown';
  const synopsis = entity.descriptions && entity.descriptions.en ? entity.descriptions.en.value : '';

  const getClaimValue = (prop) => {
    const claims = entity.claims[prop];
    if (claims && claims[0] && claims[0].mainsnak && claims[0].mainsnak.datavalue) {
      return claims[0].mainsnak.datavalue.value;
    }
    return null;
  };

  const imdbId = getClaimValue('P345') || '';
  
  return {
    title,
    originalTitle: '',
    language: 'English',
    languages: ['English'],
    genre: ['Film'],
    releaseDate: null,
    status: 'released',
    mediaType: 'movie',
    posterUrl: '',
    bannerUrl: '',
    synopsis,
    rating: 0,
    imdbId,
    tmdbId: '',
    dataSource: 'wikidata',
    cast: []
  };
};

// 4. Gemini AI Fallback Client
const searchGemini = async (query) => {
  const prompt = `
    The user is searching for a movie or TV show series with the title or query: "${query}".
    Find up to 3 movies or TV series matching this query.
    Return the response ONLY as a valid JSON array of objects. Do not wrap in markdown or backticks.
    Format:
    [
      {
        "title": "Movie or Series Title",
        "originalTitle": "Original Title if different",
        "language": "Original Language name (e.g. Hindi, English)",
        "languages": ["Languages in the film/show"],
        "genre": ["Genres"],
        "releaseDate": "YYYY-MM-DD (approximate if unknown)",
        "synopsis": "A brief synopsis of the plot",
        "rating": 0-10 number,
        "refId": "gemini-generated-slug",
        "source": "gemini",
        "mediaType": "movie | series"
      }
    ]
    If no match is found, return an empty array [].
  `;

  try {
    const text = await queryGemini(prompt);
    const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const results = JSON.parse(cleanJson);
    return await Promise.all(results.map(async (item) => {
      if (!item.posterUrl) {
        item.posterUrl = await fetchPosterFromOMDB(item.title, item.releaseDate);
      }
      return item;
    }));
  } catch (e) {
    console.error('Failed to parse Gemini JSON search response:', e);
    return [];
  }
};

const getGeminiDetails = async (refId, titleQuery, mediaType = 'movie') => {
  const prompt = `
    Find detailed metadata and cast list for the ${mediaType === 'series' ? 'TV Show Series' : 'Movie'} named "${titleQuery || refId}".
    Prioritise listing Actresses (Female cast members) at the top of the cast array list.
    Return the response ONLY as a valid JSON object. Do not wrap in markdown or backticks.
    Format:
    {
      "title": "Title",
      "originalTitle": "Original Title if different",
      "language": "Original Language (e.g., Hindi, English, Telugu)",
      "languages": ["Languages spoken"],
      "genre": ["Genres"],
      "releaseDate": "YYYY-MM-DD",
      "status": "released",
      "posterUrl": "",
      "bannerUrl": "",
      "synopsis": "A comprehensive plot summary",
      "rating": 7.5,
      "imdbId": "",
      "tmdbId": "",
      "dataSource": "gemini",
      "cast": [
        {
          "name": "Actor/Crew Name",
          "characterName": "Character Name in the film/show (or empty for crew)",
          "role": "Actor | Actress | Director | Producer | Composer",
          "gender": "Male | Female | Non-binary | Other | Unspecified",
          "knownFor": "Actor"
        }
      ]
    }
  `;

  try {
    const text = await queryGemini(prompt);
    const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const movieDetails = JSON.parse(cleanJson);
    
    // Sort and Cap cast dynamically
    movieDetails.cast = filterAndCapCast(movieDetails.cast);
    movieDetails.mediaType = mediaType;

    // Fetch poster from OMDb if missing
    if (!movieDetails.posterUrl) {
      movieDetails.posterUrl = await fetchPosterFromOMDB(movieDetails.title || titleQuery, movieDetails.releaseDate);
    }

    return movieDetails;
  } catch (e) {
    throw new Error(`Failed to parse Gemini details JSON: ${e.message}`);
  }
};

// 5. Unified Fallback Pipeline
exports.searchMovies = async (query) => {
  // A. TMDB Search
  try {
    console.log('API Service: Trying TMDB search (Movies & TV)...');
    const tmdbResults = await searchTMDB(query);
    if (tmdbResults && tmdbResults.length > 0) {
      return tmdbResults;
    }
    console.log('API Service: TMDB search returned 0 results. Falling back to OMDb...');
  } catch (err) {
    console.warn('API Service: TMDB search failed or blocked. falling back to OMDb. Error:', err.message);
  }

  // B. OMDb Search
  try {
    console.log('API Service: Trying OMDb search...');
    const omdbResults = await searchOMDB(query);
    if (omdbResults && omdbResults.length > 0) {
      return omdbResults;
    }
    console.log('API Service: OMDb search returned 0 results. Falling back to Wikidata...');
  } catch (err) {
    console.warn('API Service: OMDb search failed. falling back to Wikidata. Error:', err.message);
  }

  // C. Wikidata Search
  try {
    console.log('API Service: Trying Wikidata search...');
    const wikidataResults = await searchWikidata(query);
    if (wikidataResults && wikidataResults.length > 0) {
      return wikidataResults;
    }
    console.log('API Service: Wikidata search returned 0 results. Falling back to Gemini...');
  } catch (err) {
    console.warn('API Service: Wikidata search failed. falling back to Gemini. Error:', err.message);
  }

  // D. Gemini AI Search
  try {
    console.log('API Service: Trying Gemini AI search...');
    return await searchGemini(query);
  } catch (err) {
    console.error('API Service: Gemini search failed. All lookup sources exhausted.', err.message);
    return [];
  }
};

exports.getMovieDetails = async (refId, source, titleQuery, mediaType = 'movie') => {
  switch (source) {
    case 'tmdb':
      try {
        return await getTMDBDetails(refId, mediaType);
      } catch (err) {
        console.warn('API Service: TMDB detail lookup failed, attempting OMDb fallback...', err.message);
        if (titleQuery) {
          const omdbResults = await searchOMDB(titleQuery);
          if (omdbResults[0]) return await getOMDBDetails(omdbResults[0].refId);
        }
        throw err;
      }
    case 'omdb':
      return await getOMDBDetails(refId);
    case 'wikidata':
      try {
        const details = await getWikidataDetails(refId);
        if (details.imdbId) {
          return await getOMDBDetails(details.imdbId);
        }
        if (process.env.GEMINI_API_KEY) {
          return await getGeminiDetails(refId, details.title, mediaType);
        }
        return details;
      } catch (err) {
        if (process.env.GEMINI_API_KEY) {
          return await getGeminiDetails(refId, titleQuery, mediaType);
        }
        throw err;
      }
    case 'gemini':
      return await getGeminiDetails(refId, titleQuery, mediaType);
    default:
      throw new Error(`Unsupported data source: ${source}`);
  }
};

// Fetch person details from TMDB to enrich cast profiles on-the-fly
exports.enrichCastFromTMDB = async (name) => {
  if (!isExternalApiEnabled()) throw new Error('External APIs are disabled by Admin');
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    // 1. Search for the person
    const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(name)}&language=en-US`;
    const searchRes = await fetchWithTimeout(searchUrl);
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const person = (searchData.results || [])[0];
    if (!person) return null;

    // 2. Fetch full person details
    const detailsUrl = `https://api.themoviedb.org/3/person/${person.id}?api_key=${apiKey}&language=en-US`;
    const detailsRes = await fetchWithTimeout(detailsUrl);
    if (!detailsRes.ok) {
      // Return basic search details if full lookup fails
      return {
        photoUrl: person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : '',
        gender: mapGender(person.gender),
        tmdbId: person.id.toString(),
        dataSource: 'tmdb'
      };
    }

    const details = await detailsRes.json();
    
    // Parse nationality from place of birth (e.g. "Los Angeles, California, USA" -> "USA")
    let nationality = '';
    if (details.place_of_birth) {
      const parts = details.place_of_birth.split(',');
      nationality = parts[parts.length - 1].trim();
    }

    return {
      photoUrl: details.profile_path ? `https://image.tmdb.org/t/p/w500${details.profile_path}` : '',
      gender: mapGender(details.gender),
      bio: details.biography || '',
      birthDate: details.birthday ? new Date(details.birthday) : null,
      nationality: nationality,
      tmdbId: details.id.toString(),
      imdbId: details.imdb_id || '',
      dataSource: 'tmdb'
    };
  } catch (err) {
    console.warn('Enriching cast from TMDB failed:', err.message);
    return null;
  }
};

// Fetch person details from Gemini AI if TMDB is blocked/fails
const enrichCastFromGemini = async (name) => {
  const prompt = `
    Find detailed biographical information for the actor/actress named "${name}".
    Return the response ONLY as a valid JSON object. Do not wrap in markdown or backticks.
    Format:
    {
      "bio": "A detailed biography of the person...",
      "birthDate": "YYYY-MM-DD (or null if completely unknown)",
      "nationality": "Country of birth/nationality",
      "gender": "Male | Female | Non-binary | Unspecified"
    }
  `;

  try {
    const text = await queryGemini(prompt);
    const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const result = JSON.parse(cleanJson);

    return {
      photoUrl: '', // Gemini cannot give live, reliable image URLs
      gender: result.gender || 'Unspecified',
      bio: result.bio || '',
      birthDate: result.birthDate ? new Date(result.birthDate) : null,
      nationality: result.nationality || '',
      tmdbId: '',
      imdbId: '',
      dataSource: 'gemini'
    };
  } catch (err) {
    console.warn(`Gemini Cast Lookup failed for "${name}":`, err.message);
    return null;
  }
};

// Unified Cast Profile Enrichment (TMDB -> Gemini AI fallback)
exports.enrichCastProfile = async (name) => {
  // 1. Try TMDB first
  const tmdbResult = await exports.enrichCastFromTMDB(name);
  if (tmdbResult) return tmdbResult;

  // 2. Fall back to Gemini AI
  console.log(`API Service: TMDB cast enrichment failed or timed out for "${name}". Falling back to Gemini AI...`);
  return await enrichCastFromGemini(name);
};

// Search external persons using TMDB API (with Gemini fallback)
exports.searchExternalPersons = async (query) => {
  if (!isExternalApiEnabled()) throw new Error('External APIs are disabled by Admin');
  const apiKey = process.env.TMDB_API_KEY;
  if (apiKey) {
    try {
      const url = `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US`;
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const data = await res.json();
        return (data.results || []).map(person => ({
          name: person.name,
          tmdbId: person.id.toString(),
          photoUrl: getTmdbImageUrl(person.profile_path),
          gender: mapGender(person.gender),
          knownForDepartment: person.known_for_department || '',
          knownFor: (person.known_for || []).map(item => item.title || item.name || '').filter(Boolean).join(', '),
          source: 'tmdb'
        }));
      }
    } catch (err) {
      console.warn('TMDB Person Search failed, trying Gemini fallback...', err.message);
    }
  }

  // Fallback to Gemini
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return [];

  const prompt = `
    The user is searching for an actor, actress, or person in the film industry with the query: "${query}".
    Find up to 3 actors or actresses matching this query.
    Return the response ONLY as a valid JSON array of objects. Do not wrap in markdown or backticks.
    Format:
    [
      {
        "name": "Person Name",
        "tmdbId": "",
        "photoUrl": "",
        "gender": "Male | Female | Non-binary | Unspecified",
        "knownForDepartment": "Acting | Writing | Directing",
        "knownFor": "Known for works/movies",
        "source": "gemini"
      }
    ]
    If no match is found, return an empty array [].
  `;

  try {
    const response = await fetchWithTimeout(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }, 40000);

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text.trim();
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      return JSON.parse(cleanJson);
    }
  } catch (err) {
    console.error('Gemini Person Search fallback failed:', err.message);
  }

  return [];
};

// Fetch full details of a person using TMDB API
exports.getTmdbPersonDetails = async (tmdbId) => {
  if (!isExternalApiEnabled()) throw new Error('External APIs are disabled by Admin');
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB API Key missing');

  try {
    const url = `https://api.themoviedb.org/3/person/${tmdbId}?api_key=${apiKey}&language=en-US`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`TMDB Person Details failed: ${res.statusText}`);
    const details = await res.json();

    let nationality = '';
    if (details.place_of_birth) {
      const parts = details.place_of_birth.split(',');
      nationality = parts[parts.length - 1].trim();
    }

    return {
      name: details.name,
      photoUrl: details.profile_path ? `https://image.tmdb.org/t/p/w500${details.profile_path}` : '',
      gender: mapGender(details.gender),
      bio: details.biography || '',
      birthDate: details.birthday ? new Date(details.birthday) : null,
      birthPlace: details.place_of_birth || '',
      nationality: nationality,
      tmdbId: details.id.toString(),
      imdbId: details.imdb_id || '',
      dataSource: 'tmdb'
    };
  } catch (err) {
    console.error('TMDB Person Details fetch failed:', err.message);
    throw err;
  }
};

// Fetch movie credits for a person from TMDB (with Gemini fallback)
exports.getTmdbPersonMovieCredits = async (tmdbId, name) => {
  const apiKey = process.env.TMDB_API_KEY;
  let useFallback = !apiKey;

  if (apiKey) {
    try {
      const url = `https://api.themoviedb.org/3/person/${tmdbId}/movie_credits?api_key=${apiKey}&language=en-US`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`TMDB Person Credits failed: ${res.statusText}`);
      const data = await res.json();

      const uniqueCredits = new Map();

      // Helper to add or update credit with priority
      const addCredit = (item) => {
        const existing = uniqueCredits.get(item.tmdbId);
        if (!existing) {
          uniqueCredits.set(item.tmdbId, item);
        } else {
          const rolePriority = { 'Actor': 4, 'Director': 3, 'Writer': 2, 'Producer': 1, 'Composer': 1, 'Crew': 0 };
          const oldPriority = rolePriority[existing.role] || 0;
          const newPriority = rolePriority[item.role] || 0;
          if (newPriority > oldPriority) {
            uniqueCredits.set(item.tmdbId, item);
          } else if (newPriority === oldPriority && item.characterName && !existing.characterName) {
            uniqueCredits.set(item.tmdbId, item);
          }
        }
      };

      // Map cast credits
      if (data.cast && Array.isArray(data.cast)) {
        data.cast.forEach(movie => {
          addCredit({
            tmdbId: movie.id.toString(),
            title: movie.title || movie.original_title || 'Untitled',
            releaseDate: movie.release_date ? new Date(movie.release_date) : null,
            posterUrl: getTmdbImageUrl(movie.poster_path),
            characterName: movie.character || '',
            role: 'Actor'
          });
        });
      }

      // Map crew credits
      if (data.crew && Array.isArray(data.crew)) {
        data.crew.forEach(movie => {
          const role = ['Director', 'Writer', 'Producer', 'Composer'].includes(movie.job) ? movie.job : 'Crew';
          addCredit({
            tmdbId: movie.id.toString(),
            title: movie.title || movie.original_title || 'Untitled',
            releaseDate: movie.release_date ? new Date(movie.release_date) : null,
            posterUrl: getTmdbImageUrl(movie.poster_path),
            characterName: '',
            role: role
          });
        });
      }

      return Array.from(uniqueCredits.values());
    } catch (err) {
      console.warn('TMDB Person Credits fetch failed, attempting Gemini fallback...', err.message);
      useFallback = true;
    }
  }

  if (useFallback && name && process.env.GEMINI_API_KEY) {
    try {
      console.log(`API Service: Fetching filmography from Gemini for "${name}"...`);
      const prompt = `
        Find a list of key movies that the actor/actress/filmmaker "${name}" acted in or worked on.
        Provide up to 20 well-known movies.
        For each movie, provide its official or approximate numeric TMDB ID (if known, otherwise a unique 6-digit mock number).
        Return the response ONLY as a valid JSON array of objects. Do not wrap in markdown or backticks.
        Format:
        [
          {
            "tmdbId": "numeric_id_as_string",
            "title": "Movie Title",
            "releaseDate": "YYYY-MM-DD",
            "characterName": "Character Name in the film (or empty if director/crew)",
            "role": "Actor | Actress | Director | Writer | Producer | Composer"
          }
        ]
      `;
      const text = await queryGemini(prompt);
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const results = JSON.parse(cleanJson);
      return await Promise.all(results.map(async (movie) => {
        const poster = await fetchPosterFromOMDB(movie.title, movie.releaseDate);
        return {
          tmdbId: movie.tmdbId || Math.floor(Math.random() * 899999 + 100000).toString(),
          title: movie.title,
          releaseDate: movie.releaseDate ? new Date(movie.releaseDate) : null,
          posterUrl: poster,
          characterName: movie.characterName || '',
          role: movie.role || 'Actor'
        };
      }));
    } catch (err) {
      console.error(`Gemini Person Credits Lookup failed for "${name}":`, err.message);
    }
  }

  return [];
};

// Search multiple entities (movies, series, persons) at once using TMDB multi-search (with Gemini fallback)
exports.searchExternalMulti = async (query) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (apiKey) {
    try {
      const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US`;
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const data = await res.json();
        return (data.results || []).map(item => {
          if (item.media_type === 'movie') {
            return {
              title: item.title,
              originalTitle: item.original_title || '',
              releaseDate: item.release_date ? new Date(item.release_date) : null,
              posterUrl: getTmdbImageUrl(item.poster_path),
              refId: item.id.toString(),
              source: 'tmdb',
              mediaType: 'movie',
              synopsis: item.overview || ''
            };
          } else if (item.media_type === 'tv') {
            return {
              title: item.name,
              originalTitle: item.original_name || '',
              releaseDate: item.first_air_date ? new Date(item.first_air_date) : null,
              posterUrl: getTmdbImageUrl(item.poster_path),
              refId: item.id.toString(),
              source: 'tmdb',
              mediaType: 'series',
              synopsis: item.overview || ''
            };
          } else if (item.media_type === 'person') {
            return {
              title: item.name,
              originalTitle: '',
              releaseDate: null,
              posterUrl: getTmdbImageUrl(item.profile_path),
              refId: item.id.toString(),
              source: 'tmdb',
              mediaType: 'person',
              synopsis: (item.known_for || []).map(k => k.title || k.name || '').filter(Boolean).join(', ')
            };
          }
          return null;
        }).filter(Boolean);
      }
    } catch (err) {
      console.warn('TMDB Multi Search failed, trying Gemini autocomplete fallback...', err.message);
    }
  }

  // Fallback to Gemini multi search
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return [];

  const prompt = `
    The user is looking for search suggestions matching the query: "${query}".
    Find up to 5 matches which can be Movies, TV Series, or Actors/Actresses.
    Return the response ONLY as a valid JSON array of objects. Do not wrap in markdown or backticks.
    Format:
    [
      {
        "title": "Movie Title or Person Name",
        "originalTitle": "",
        "releaseDate": "YYYY-MM-DD (or null for persons)",
        "posterUrl": "",
        "refId": "gemini-slug",
        "source": "gemini",
        "mediaType": "movie | series | person",
        "synopsis": "Plot summary or works known for"
      }
    ]
    If no matches, return [].
  `;

  try {
    const response = await fetchWithTimeout(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }, 40000);

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text.trim();
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const results = JSON.parse(cleanJson);
      return await Promise.all(results.map(async (item) => {
        if (item.mediaType !== 'person' && !item.posterUrl) {
          item.posterUrl = await fetchPosterFromOMDB(item.title, item.releaseDate);
        }
        return item;
      }));
    }
  } catch (err) {
    console.error('Gemini Multi Search fallback failed:', err.message);
  }

  return [];
};

const getPopularMoviesFromGemini = async () => {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error('Gemini API Key missing for fallback');

  console.log('API Service: TMDB popular movies failed. Fetching popular movies from Gemini...');

  const prompt = `
    Provide a list of 20 highly popular and critically acclaimed movies.
    Return the response ONLY as a valid JSON array of objects. Do not wrap in markdown or backticks.
    Format:
    [
      {
        "title": "Movie Title",
        "originalTitle": "",
        "releaseDate": "YYYY-MM-DD",
        "posterUrl": "",
        "refId": "gemini-popular-slug",
        "source": "gemini",
        "mediaType": "movie",
        "synopsis": "A brief synopsis",
        "genre": ["Action", "Drama"]
      }
    ]
  `;

  try {
    const text = await queryGemini(prompt);
    const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const results = JSON.parse(cleanJson);
    return await Promise.all(results.map(async (movie, idx) => {
      const poster = await fetchPosterFromOMDB(movie.title, movie.releaseDate);
      return {
        title: movie.title,
        originalTitle: movie.originalTitle || '',
        releaseDate: movie.releaseDate ? new Date(movie.releaseDate) : null,
        posterUrl: poster || movie.posterUrl || '',
        refId: movie.refId || `gemini-popular-${idx}`,
        source: 'gemini',
        mediaType: 'movie',
        synopsis: movie.synopsis || '',
        genre: movie.genre || []
      };
    }));
  } catch (err) {
    console.error('Gemini popular movies fallback failed:', err.message);
    throw err;
  }
};

const getPopularCastFromGemini = async () => {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error('Gemini API Key missing for fallback');

  console.log('API Service: TMDB popular cast failed. Fetching popular cast from Gemini...');

  const prompt = `
    Provide a list of 20 highly popular actors and actresses in the film industry.
    Return the response ONLY as a valid JSON array of objects. Do not wrap in markdown or backticks.
    Format:
    [
      {
        "name": "Person Name",
        "tmdbId": "",
        "photoUrl": "",
        "gender": "Male | Female | Non-binary",
        "knownForDepartment": "Acting",
        "knownFor": "Known movies list",
        "source": "gemini"
      }
    ]
  `;

  try {
    const text = await queryGemini(prompt);
    const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const results = JSON.parse(cleanJson);
    return results.map((person, idx) => ({
      name: person.name,
      tmdbId: person.tmdbId || `gemini-cast-${idx}`,
      photoUrl: person.photoUrl || '',
      gender: person.gender || 'Unspecified',
      knownForDepartment: person.knownForDepartment || 'Acting',
      knownFor: person.knownFor || '',
      source: 'gemini'
    }));
  } catch (err) {
    console.error('Gemini popular cast fallback failed:', err.message);
    throw err;
  }
};

let popularMoviesCache = { data: null, timestamp: 0 };
let popularCastCache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

// Fetch top 100 popular movies (5 pages) from TMDB
exports.getPopularMovies = async () => {
  const now = Date.now();
  if (popularMoviesCache.data && (now - popularMoviesCache.timestamp < CACHE_TTL_MS)) {
    return popularMoviesCache.data;
  }

  const apiKey = process.env.TMDB_API_KEY;

  // 1. Try native TMDB popular movies endpoint (fetching top 5 pages = 100 movies)
  if (apiKey) {
    try {
      const pagesToFetch = [1, 2, 3, 4, 5];
      const pageResponses = await Promise.all(
        pagesToFetch.map(p => fetchWithTimeout(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=${p}`))
      );

      const genreMap = {
        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
        99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
        27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
        10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
      };

      const allMovies = [];
      for (const res of pageResponses) {
        if (res.ok) {
          const data = await res.json();
          (data.results || []).forEach(movie => {
            allMovies.push({
              title: movie.title,
              originalTitle: movie.original_title || '',
              releaseDate: movie.release_date ? new Date(movie.release_date) : null,
              posterUrl: getTmdbImageUrl(movie.poster_path),
              refId: movie.id.toString(),
              source: 'tmdb',
              mediaType: 'movie',
              synopsis: movie.overview || '',
              genre: (movie.genre_ids || []).map(id => genreMap[id]).filter(Boolean)
            });
          });
        }
      }

      if (allMovies.length > 0) {
        popularMoviesCache = { data: allMovies, timestamp: Date.now() };
        return allMovies;
      }
    } catch (err) {
      console.warn('TMDB popular movies fetch failed. Falling back to Gemini...', err.message);
    }
  }

  // 2. Gemini AI fallback if TMDB fails or is missing key
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      console.log('API Service: Asking Gemini for trending movies...');
      const prompt = `
        Provide a list of 20 highly popular and trending movies (especially recent releases).
        For each movie, you must provide its valid, official numeric TMDB (The Movie Database) ID.
        Return the response ONLY as a valid JSON array of objects. Do not wrap in markdown or backticks.
        Format:
        [
          {
            "title": "Movie Title",
            "tmdbId": "numeric_tmdb_id_as_string",
            "releaseDate": "YYYY-MM-DD",
            "synopsis": "A brief plot summary",
            "genre": ["Action", "Drama"],
            "rating": 7.8
          }
        ]
      `;
      const text = await queryGemini(prompt);
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const geminiMovies = JSON.parse(cleanJson);

      const moviesList = await Promise.all(geminiMovies.map(async (item) => {
        if (!item.tmdbId) return null;
        try {
          const url = `https://api.themoviedb.org/3/movie/${item.tmdbId}?api_key=${apiKey}&language=en-US`;
          const res = await fetchWithTimeout(url);
          if (!res.ok) throw new Error(`TMDB details lookup failed: ${res.statusText}`);
          const tmdbData = await res.json();

          return {
            title: tmdbData.title || item.title,
            originalTitle: tmdbData.original_title || '',
            releaseDate: tmdbData.release_date ? new Date(tmdbData.release_date) : (item.releaseDate ? new Date(item.releaseDate) : null),
            posterUrl: getTmdbImageUrl(tmdbData.poster_path),
            refId: item.tmdbId,
            source: 'tmdb',
            mediaType: 'movie',
            synopsis: tmdbData.overview || item.synopsis || '',
            genre: tmdbData.genres ? tmdbData.genres.map(g => g.name) : (item.genre || [])
          };
        } catch (err) {
          const poster = await fetchPosterFromOMDB(item.title, item.releaseDate);
          return {
            title: item.title,
            originalTitle: '',
            releaseDate: item.releaseDate ? new Date(item.releaseDate) : null,
            posterUrl: poster,
            refId: item.tmdbId,
            source: 'gemini',
            mediaType: 'movie',
            synopsis: item.synopsis || '',
            genre: item.genre || []
          };
        }
      }));

      const filteredMoviesList = moviesList.filter(Boolean);
      if (filteredMoviesList.length > 0) {
        popularMoviesCache = { data: filteredMoviesList, timestamp: Date.now() };
        return filteredMoviesList;
      }
    } catch (err) {
      console.error('Gemini popular movies fallback failed:', err.message);
    }
  }

  const fallbackMovies = await getPopularMoviesFromGemini();
  popularMoviesCache = { data: fallbackMovies, timestamp: Date.now() };
  return fallbackMovies;
};

// Fetch top 100 popular cast members (5 pages) from TMDB
exports.getPopularCast = async () => {
  const now = Date.now();
  if (popularCastCache.data && (now - popularCastCache.timestamp < CACHE_TTL_MS)) {
    return popularCastCache.data;
  }

  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error('TMDB API Key missing');

    const pagesToFetch = [1, 2, 3, 4, 5];
    const pageResponses = await Promise.all(
      pagesToFetch.map(p => fetchWithTimeout(`https://api.themoviedb.org/3/person/popular?api_key=${apiKey}&language=en-US&page=${p}`))
    );

    const allPersons = [];
    for (const res of pageResponses) {
      if (res.ok) {
        const data = await res.json();
        (data.results || []).forEach(person => {
          allPersons.push({
            name: person.name,
            tmdbId: person.id.toString(),
            photoUrl: getTmdbImageUrl(person.profile_path),
            gender: mapGender(person.gender),
            knownForDepartment: person.known_for_department || 'Acting',
            knownFor: (person.known_for || []).map(item => item.title || item.name || '').filter(Boolean).join(', '),
            source: 'tmdb'
          });
        });
      }
    }

    if (allPersons.length > 0) {
      popularCastCache = { data: allPersons, timestamp: Date.now() };
      return allPersons;
    }
  } catch (err) {
    console.warn('TMDB popular cast fetch failed. Calling Gemini fallback...', err.message);
    const fallbackCast = await getPopularCastFromGemini();
    popularCastCache = { data: fallbackCast, timestamp: Date.now() };
    return fallbackCast;
  }
};


