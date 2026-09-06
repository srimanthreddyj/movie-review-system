import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api, { getProxiedImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import { Search, SlidersHorizontal, Tag, RotateCcw, Loader2, Film } from 'lucide-react';
import { useRestorePageState } from '../context/NavigationHistoryContext';

const Movies = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, refreshUser } = useAuth();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importingMovie, setImportingMovie] = useState(false);
  const [importError, setImportError] = useState(null);

  // Navigation History State Restoration
  const [pageState, setPageState] = useRestorePageState('movies', {
    currentPage: 1,
    searchQuery: '',
    mediaTypeFilter: '',
    statusFilter: '',
    languageFilter: '',
    tagFilter: '',
    selectedCardId: null
  }, loading);

  const { currentPage, searchQuery, mediaTypeFilter, statusFilter, languageFilter, tagFilter, selectedCardId } = pageState;

  const setCurrentPage = (val) => setPageState(prev => ({ ...prev, currentPage: typeof val === 'function' ? val(prev.currentPage) : val }));
  const setSearchQuery = (val) => setPageState(prev => ({ ...prev, searchQuery: typeof val === 'function' ? val(prev.searchQuery) : val }));
  const setMediaTypeFilter = (val) => setPageState(prev => ({ ...prev, mediaTypeFilter: typeof val === 'function' ? val(prev.mediaTypeFilter) : val }));
  const setStatusFilter = (val) => setPageState(prev => ({ ...prev, statusFilter: typeof val === 'function' ? val(prev.statusFilter) : val }));
  const setLanguageFilter = (val) => setPageState(prev => ({ ...prev, languageFilter: typeof val === 'function' ? val(prev.languageFilter) : val }));
  const setTagFilter = (val) => setPageState(prev => ({ ...prev, tagFilter: typeof val === 'function' ? val(prev.tagFilter) : val }));
  const setSelectedCardId = (val) => setPageState(prev => ({ ...prev, selectedCardId: typeof val === 'function' ? val(prev.selectedCardId) : val }));

  const [totalPages, setTotalPages] = useState(1);
  const [totalMovies, setTotalMovies] = useState(0);

  // Dropdown list data
  const [languages, setLanguages] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [userFavs, setUserFavs] = useState([]);

  // Autocomplete suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchCatalogData = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 12
      };
      if (tagFilter) params.tagId = tagFilter;
      if (mediaTypeFilter) params.mediaType = mediaTypeFilter;
      if (statusFilter) params.status = statusFilter;
      if (languageFilter) params.language = languageFilter;

      const response = await api.get('/movies', { params });
      setMovies(response.data.movies || []);
      setTotalPages(response.data.totalPages || 1);
      setTotalMovies(response.data.totalMovies || 0);

      // Extract unique languages present in movies for filtering
      const uniqueLangs = [...new Set((response.data.movies || []).map(m => m.language).filter(Boolean))];
      setLanguages(prev => [...new Set([...prev, ...uniqueLangs])]);

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

  const isInitialMountRef = useRef(true);

  // Trigger loading when currentPage changes
  useEffect(() => {
    if (isInitialMountRef.current) return;
    if (!searchQuery) {
      fetchCatalogData(currentPage);
    }
  }, [currentPage]);

  // When filters or search queries change, reset page to 1
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (!searchQuery) {
        fetchCatalogData(currentPage);
      } else {
        handleSearch();
      }
      return;
    }

    if (currentPage === 1) {
      if (!searchQuery) {
        fetchCatalogData(1);
      }
    } else {
      setCurrentPage(1);
    }
  }, [searchQuery, tagFilter, mediaTypeFilter, statusFilter, languageFilter]);

  // Trigger refresh on mount to load fresh user data
  useEffect(() => {
    refreshUser();
  }, []);

  // Debounced search logic for autocomplete suggestions
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const response = await api.get('/movies/search', {
          params: { q: searchQuery }
        });
        setSuggestions(Array.isArray(response.data) ? response.data : []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Movies page Autocomplete fetch failed:', err);
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.search-bar-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleSuggestionClick = (item) => {
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    handleMovieClick(item);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setMediaTypeFilter('');
    setStatusFilter('');
    setLanguageFilter('');
    setTagFilter('');
    setSuggestions([]);
    setShowDropdown(false);
    setCurrentPage(1);
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      fetchCatalogData(1);
      return;
    }
    setLoading(true);
    setImportError(null);
    setShowDropdown(false);
    try {
      const response = await api.get('/movies/search', {
        params: { q: searchQuery }
      });
      setMovies(response.data || []);
      setTotalPages(1);
      setCurrentPage(1);
    } catch (error) {
      console.error('Failed to search externally:', error);
      setImportError('Failed to execute search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMovieClick = (movie) => {
    setSelectedCardId(movie._id || movie.refId);
  };

  // When in live TMDB mode with search query, we filter TMDB results locally.
  const filteredMovies = searchQuery
    ? movies.filter((movie) => {
        const matchesMedia = mediaTypeFilter ? movie.mediaType === mediaTypeFilter : true;
        const matchesStatus = statusFilter ? movie.status === statusFilter : true;
        const matchesLang = languageFilter ? movie.language === languageFilter : true;
        return matchesMedia && matchesStatus && matchesLang;
      })
    : movies;

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

        <form onSubmit={handleSearch} className="search-bar-container" style={{ position: 'relative' }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search TMDB & Catalog by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          />
          {isSearchingSuggestions && (
            <div style={{ position: 'absolute', right: '110px', top: '50%', transform: 'translateY(-50%)', zIndex: 5 }}>
              <Loader2 size={16} className="spinner" style={{ color: 'var(--accent-color)' }} />
            </div>
          )}
          <button type="submit" className="btn btn-primary search-submit-btn">
            Search
          </button>

          {showDropdown && suggestions.length > 0 && (
            <div className="search-suggestions-dropdown">
              {suggestions.map((item, index) => item && (
                <div
                  key={index}
                  className="search-suggestion-item"
                  onClick={() => handleSuggestionClick(item)}
                >
                  <div className="suggestion-item-main">
                    {item.posterUrl ? (
                      <img src={getProxiedImageUrl(item.posterUrl)} alt={item.title || ''} className="suggestion-item-img" />
                    ) : (
                      <div className="suggestion-item-img-fallback flex-center">
                        <Film size={16} />
                      </div>
                    )}
                    <div className="suggestion-item-meta">
                      <span className="suggestion-item-title">{item.title || 'Untitled'}</span>
                      {item.releaseDate && (
                        <span className="suggestion-item-year">
                          {(() => {
                            try {
                              const d = new Date(item.releaseDate);
                              return isNaN(d.getTime()) ? '' : d.getFullYear();
                            } catch (e) {
                              return '';
                            }
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="suggestion-item-tags">
                    <span className={`badge-outline-sm type-${item.mediaType === 'series' ? 'series' : 'movie'}`}>
                      {item.mediaType === 'series' ? 'show' : 'movie'}
                    </span>
                    {userFavs.some(f => f.entityId === (item._id || item.refId) || f.entityId?._id === (item._id || item.refId)) ? (
                      <span className="badge-success-sm">Saved</span>
                    ) : (
                      <span className="badge-secondary-sm">TMDB</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
              highlighted={(movie._id || movie.refId) === selectedCardId}
            />
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && totalPages > 1 && (
        <div className="pagination-container">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
            title="Previous Page"
          >
            Prev
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const isNearStart = currentPage <= 4;
            const isNearEnd = currentPage >= totalPages - 3;
            const showPage = p === 1 || p === totalPages || Math.abs(currentPage - p) <= 1;

            if (!showPage) {
              if ((p === 2 && !isNearStart) || (p === totalPages - 1 && !isNearEnd)) {
                return <span key={p} className="pagination-info">...</span>;
              }
              return null;
            }

            return (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`pagination-btn ${currentPage === p ? 'active' : ''}`}
              >
                {p}
              </button>
            );
          })}

          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="pagination-btn"
            title="Next Page"
          >
            Next
          </button>
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

        /* Suggestions Dropdown Styles */
        .search-suggestions-dropdown {
          position: absolute;
          top: calc(100% + 0.25rem);
          left: 0;
          width: 100%;
          max-height: 350px;
          overflow-y: auto;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          box-shadow: var(--shadow-lg);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          padding: 0.5rem 0;
        }
        .search-suggestion-item {
          padding: 0.75rem 1rem;
          cursor: pointer;
          transition: background-color var(--transition-speed);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .search-suggestion-item:hover {
          background-color: var(--bg-tertiary);
        }
        .suggestion-item-main {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          overflow: hidden;
          flex-grow: 1;
        }
        .suggestion-item-img {
          width: 36px;
          height: 50px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .suggestion-item-img-fallback {
          width: 36px;
          height: 50px;
          background-color: var(--bg-tertiary);
          border-radius: 4px;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          flex-shrink: 0;
        }
        .suggestion-item-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          overflow: hidden;
        }
        .suggestion-item-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          text-align: left;
        }
        .suggestion-item-year {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .suggestion-item-tags {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          flex-shrink: 0;
        }
        .badge-outline-sm {
          font-size: 0.625rem;
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .badge-outline-sm.type-movie {
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
          background-color: rgba(16, 185, 129, 0.05);
        }
        .badge-outline-sm.type-series {
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #6366f1;
          background-color: rgba(99, 102, 241, 0.05);
        }
        .badge-success-sm {
          font-size: 0.625rem;
          background-color: rgba(16, 185, 129, 0.15);
          color: #10b981;
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          font-weight: 600;
        }
        .badge-secondary-sm {
          font-size: 0.625rem;
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default Movies;
