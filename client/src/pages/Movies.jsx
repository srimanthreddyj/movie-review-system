import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import { Search, SlidersHorizontal, Tag, RotateCcw, Loader2 } from 'lucide-react';

const Movies = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importingMovie, setImportingMovie] = useState(false);
  const [importError, setImportError] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  // Dropdown list data
  const [languages, setLanguages] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [userFavs, setUserFavs] = useState([]);

  useEffect(() => {
    if (!searchQuery) {
      fetchCatalogData();
    }
  }, [tagFilter]);

  const fetchCatalogData = async () => {
    setLoading(true);
    try {
      const url = tagFilter ? `/movies?tagId=${tagFilter}` : '/movies';
      const response = await api.get(url);
      setMovies(response.data.movies || []);

      // Extract unique languages present in movies for filtering
      const uniqueLangs = [...new Set((response.data.movies || []).map(m => m.language).filter(Boolean))];
      setLanguages(uniqueLangs);

      // Load user preferences (favourites, tags)
      const [favsRes, tagsRes] = await Promise.all([
        api.get('/favourites'),
        api.get('/tags')
      ]);
      setUserFavs(favsRes.data.movies || []);
      setUserTags(tagsRes.data || []);
    } catch (error) {
      console.error('Failed to load catalogue data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Trigger refresh on mount to load fresh user data
  useEffect(() => {
    refreshUser();
  }, []);

  const handleResetFilters = () => {
    setSearchQuery('');
    setMediaTypeFilter('');
    setStatusFilter('');
    setLanguageFilter('');
    setTagFilter('');
    fetchCatalogData();
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      fetchCatalogData();
      return;
    }
    setLoading(true);
    setImportError(null);
    try {
      const response = await api.get('/movies/search', {
        params: { q: searchQuery }
      });
      setMovies(response.data || []);
    } catch (error) {
      console.error('Failed to search externally:', error);
      setImportError('Failed to execute search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMovieClick = async (movie) => {
    if (movie.source === 'local') {
      navigate(`/movies/${movie.refId}`);
      return;
    }

    setImportingMovie(true);
    setImportError(null);
    try {
      const response = await api.get('/movies/external-details', {
        params: {
          refId: movie.refId,
          source: movie.source,
          mediaType: movie.mediaType || 'movie',
          title: movie.title,
          onlyActresses: 'false'
        }
      });
      navigate(`/movies/${response.data._id}`);
    } catch (err) {
      console.error('Auto import failed:', err);
      setImportError(err.response?.data?.message || 'Failed to import movie details on-the-fly.');
    } finally {
      setImportingMovie(false);
    }
  };

  // Perform local cascading filters on movies array
  const filteredMovies = movies.filter((movie) => {
    const matchesSearch = searchQuery
      ? movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (movie.originalTitle && movie.originalTitle.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    const matchesMedia = mediaTypeFilter ? movie.mediaType === mediaTypeFilter : true;
    const matchesStatus = statusFilter ? movie.status === statusFilter : true;
    const matchesLang = languageFilter ? movie.language === languageFilter : true;
    
    return matchesSearch && matchesMedia && matchesStatus && matchesLang;
  });

  return (
    <div className="container catalogue-container">
      {/* Import overlay */}
      {importingMovie && (
        <div className="import-loading-overlay flex-center flex-column">
          <Loader2 size={48} className="spinner icon-spinner" />
          <p>Importing & caching movie details from TMDB...</p>
        </div>
      )}

      <header className="catalogue-header flex-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1>Movies & TV Shows</h1>
          <p style={{ margin: 0 }}>Search the TMDB database and explore details instantly.</p>
        </div>
        <button onClick={handleResetFilters} className="btn flex-center" style={{ gap: '0.375rem' }}>
          <RotateCcw size={14} />
          <span>Reset Filters</span>
        </button>
      </header>

      {/* Import Error Banner */}
      {importError && (
        <div className="import-error-banner flex-between">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="btn-close">&times;</button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <section className="filters-section">
        <form onSubmit={handleSearch} className="search-bar-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search TMDB & Catalog by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary search-submit-btn">
            Search
          </button>
        </form>

        <div className="filters-grid">
          {/* Media Type Filter */}
          <div className="filter-group">
            <label className="form-label">Media Type</label>
            <select 
              value={mediaTypeFilter} 
              onChange={(e) => setMediaTypeFilter(e.target.value)}
              className="form-input select-filter"
            >
              <option value="">All Types</option>
              <option value="movie">Movies</option>
              <option value="series">TV Series</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-group">
            <label className="form-label">Status</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input select-filter"
            >
              <option value="">All Statuses</option>
              <option value="released">Released</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>

          {/* Language Filter */}
          <div className="filter-group">
            <label className="form-label">Language</label>
            <select 
              value={languageFilter} 
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="form-input select-filter"
            >
              <option value="">All Languages</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          {/* Tag Filter (Server-side query) */}
          <div className="filter-group">
            <label className="form-label">User Tag</label>
            <select 
              value={tagFilter} 
              onChange={(e) => setTagFilter(e.target.value)}
              className="form-input select-filter"
            >
              <option value="">All Tags</option>
              {user?.tags?.map((tag) => (
                <option key={tag._id} value={tag._id}>{tag.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Grid of Movie Cards */}
      {loading ? (
        <div className="catalogue-loading flex-center">
          <Loader2 size={32} className="spinner" style={{ marginRight: '0.5rem' }} />
          <span>Searching movies...</span>
        </div>
      ) : filteredMovies.length === 0 ? (
        <div className="catalogue-empty">
          <h3>No matches found</h3>
          <p>We couldn't find any titles. Try searching something else or reset your filters.</p>
          <div className="flex-center" style={{ gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button onClick={handleResetFilters} className="btn btn-secondary">
              Reset Filters
            </button>
            {user?.role === 'admin' && (
              <Link to="/admin" className="btn btn-primary">
                Go to Import Hub
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid-cards">
          {filteredMovies.map((movie) => (
            <MovieCard 
              key={movie.refId || movie._id} 
              movie={movie} 
              userFavourites={userFavs}
              userTags={userTags}
              onClick={handleMovieClick}
            />
          ))}
        </div>
      )}

      <style>{`
        .catalogue-container {
          padding-top: 2rem;
          padding-bottom: 4rem;
          text-align: left;
        }
        .catalogue-header h1 {
          margin-bottom: 0.25rem;
          border: none;
          padding: 0;
        }
        
        /* Filters Bar */
        .filters-section {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 1.5rem;
          margin-bottom: 2rem;
        }
        .search-bar-container {
          display: flex;
          gap: 0.75rem;
          position: relative;
          width: 100%;
          margin-bottom: 1.25rem;
        }
        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
          z-index: 2;
        }
        .search-input {
          padding-left: 2.75rem !important;
          flex-grow: 1;
        }
        .search-submit-btn {
          white-space: nowrap;
          padding: 0 1.5rem;
          height: 42px;
        }
        .filters-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }
        @media (max-width: 1024px) {
          .filters-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .filters-grid {
            grid-template-columns: 1fr;
          }
        }
        .filter-group {
          margin-bottom: 0;
        }
        .select-filter {
          cursor: pointer;
        }
        
        .catalogue-loading {
          padding: 6rem 0;
          color: var(--text-muted);
          font-size: 1rem;
        }
        .catalogue-empty {
          text-align: center;
          padding: 5rem 1rem;
          background-color: var(--bg-secondary);
          border: 1px dashed var(--border-color);
          border-radius: var(--border-radius);
          color: var(--text-secondary);
        }
        .catalogue-empty h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .catalogue-empty p {
          font-size: 0.875rem;
          margin-bottom: 0;
        }

        /* Import overlay */
        .import-loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 2000;
          color: white;
          gap: 1.5rem;
        }
        .icon-spinner {
          color: var(--accent-color, #3b82f6);
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Error banner */
        .import-error-banner {
          display: flex;
          background-color: rgba(220, 38, 38, 0.15);
          border: 1px solid rgba(220, 38, 38, 0.3);
          color: #ef4444;
          padding: 0.75rem 1.25rem;
          border-radius: var(--border-radius);
          margin-bottom: 1.5rem;
          font-weight: 500;
          align-items: center;
        }
        .btn-close {
          background: none;
          border: none;
          color: inherit;
          font-size: 1.5rem;
          cursor: pointer;
          line-height: 1;
          padding: 0 0.5rem;
        }
      `}</style>
    </div>
  );
};

export default Movies;
