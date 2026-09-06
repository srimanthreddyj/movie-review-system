import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { getProxiedImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CastCard from '../components/CastCard';
import { Search, RotateCcw, Loader2, User } from 'lucide-react';
import { useRestorePageState } from '../context/NavigationHistoryContext';

const Cast = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, refreshUser } = useAuth();
  const [castList, setCastList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFavs, setUserFavs] = useState([]);
  const [importingCast, setImportingCast] = useState(false);
  const [importError, setImportError] = useState(null);

  // Navigation History State Restoration
  const [pageState, setPageState] = useRestorePageState('cast', {
    currentPage: 1,
    searchQuery: '',
    genderFilter: '',
    roleFilter: '',
    selectedCardId: null
  }, loading);

  const { currentPage, searchQuery, genderFilter, roleFilter, selectedCardId } = pageState;

  const setCurrentPage = (val) => setPageState(prev => ({ ...prev, currentPage: typeof val === 'function' ? val(prev.currentPage) : val }));
  const setSearchQuery = (val) => setPageState(prev => ({ ...prev, searchQuery: typeof val === 'function' ? val(prev.searchQuery) : val }));
  const setGenderFilter = (val) => setPageState(prev => ({ ...prev, genderFilter: typeof val === 'function' ? val(prev.genderFilter) : val }));
  const setRoleFilter = (val) => setPageState(prev => ({ ...prev, roleFilter: typeof val === 'function' ? val(prev.roleFilter) : val }));
  const setSelectedCardId = (val) => setPageState(prev => ({ ...prev, selectedCardId: typeof val === 'function' ? val(prev.selectedCardId) : val }));

  const [totalPages, setTotalPages] = useState(1);
  const [totalCasts, setTotalCasts] = useState(0);

  // Autocomplete suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    refreshUser();
  }, []);

  const fetchCastData = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 12
      };
      if (genderFilter) params.gender = genderFilter;
      if (roleFilter) params.knownFor = roleFilter;

      const [castRes, favsRes] = await Promise.all([
        api.get('/cast', { params }),
        api.get('/favourites')
      ]);
      setCastList(castRes.data.casts || []);
      setTotalPages(castRes.data.totalPages || 1);
      setTotalCasts(castRes.data.totalCasts || 0);
      setUserFavs(favsRes.data.cast || []);
    } catch (err) {
      console.error('Failed to load cast data:', err);
    } finally {
      setLoading(false);
    }
  };

  const isInitialMountRef = useRef(true);

  // Trigger loading when currentPage changes
  useEffect(() => {
    if (isInitialMountRef.current) return;
    if (!searchQuery) {
      fetchCastData(currentPage);
    }
  }, [currentPage]);

  // When filters or search queries change, reset page to 1
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (!searchQuery) {
        fetchCastData(currentPage);
      } else {
        handleSearch();
      }
      return;
    }

    if (currentPage === 1) {
      if (!searchQuery) {
        fetchCastData(1);
      }
    } else {
      setCurrentPage(1);
    }
  }, [searchQuery, genderFilter, roleFilter]);

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
        const response = await api.get('/cast/search-external', {
          params: { q: searchQuery }
        });
        setSuggestions(Array.isArray(response.data) ? response.data : []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Cast page Autocomplete fetch failed:', err);
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
    handleCastClick(item);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setGenderFilter('');
    setRoleFilter('');
    setSuggestions([]);
    setShowDropdown(false);
    setCurrentPage(1);
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      fetchCastData(1);
      return;
    }
    setLoading(true);
    setImportError(null);
    setShowDropdown(false);
    try {
      const response = await api.get('/cast/search-external', {
        params: { q: searchQuery }
      });
      setCastList(response.data || []);
      setTotalPages(1);
      setCurrentPage(1);
    } catch (err) {
      console.error('External cast search failed:', err);
      setImportError('Failed to execute search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCastClick = (member) => {
    setSelectedCardId(member._id || member.refId);
  };

  // When in live TMDB mode with search query, we filter TMDB results locally.
  const filteredCast = searchQuery
    ? castList.filter((member) => {
        const matchesGender = genderFilter ? member.gender === genderFilter : true;
        const matchesRole = roleFilter ? (member.knownFor === roleFilter || member.knownForDepartment === roleFilter) : true;
        return matchesGender && matchesRole;
      })
    : castList;

  const sortedCast = [...filteredCast].sort((a, b) => {
    const aFemale = a.gender === 'Female' ? 1 : 0;
    const bFemale = b.gender === 'Female' ? 1 : 0;
    if (aFemale !== bFemale) {
      return bFemale - aFemale;
    }
    return a.name.localeCompare(b.name);
  });

  const roles = [...new Set(castList.map(c => c.knownFor || c.knownForDepartment).filter(Boolean))];

  return (
    <div className="container cast-directory-container">
      {/* Import Loading Overlay */}
      {importingCast && (
        <div className="import-loading-overlay flex-center flex-column">
          <Loader2 size={48} className="spinner icon-spinner" />
          <p>Importing & caching cast profile from TMDB...</p>
        </div>
      )}

      <header className="catalogue-header flex-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1>Cast Profiles</h1>
          <p style={{ margin: 0 }}>Discover actors and actresses. Search live from TMDB and cache profiles instantly.</p>
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

      {/* Filters Bar */}
      <section className="filters-section">

        <form onSubmit={handleSearch} className="search-bar-container" style={{ position: 'relative' }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search TMDB & Catalog by name, nationality..."
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
                    {item.photoUrl || item.posterUrl ? (
                      <img src={getProxiedImageUrl(item.photoUrl || item.posterUrl)} alt={item.name || item.title || ''} className="suggestion-item-img" style={{ borderRadius: '50%', aspectRatio: '1/1', objectFit: 'cover' }} />
                    ) : (
                      <div className="suggestion-item-img-fallback flex-center" style={{ borderRadius: '50%' }}>
                        <User size={16} />
                      </div>
                    )}
                    <div className="suggestion-item-meta">
                      <span className="suggestion-item-title">{item.name || item.title || 'Unknown'}</span>
                      {(item.knownForDepartment || item.knownFor) && (
                        <span className="suggestion-item-year">
                          {item.knownForDepartment || item.knownFor}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="suggestion-item-tags">
                    <span className="badge-outline-sm type-person">
                      person
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

        <div className="filters-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {/* Gender Filter */}
          <div className="filter-group">
            <label className="form-label">Gender</label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="form-input select-filter"
            >
              <option value="">All Genders</option>
              <option value="Female">Female (Actresses)</option>
              <option value="Male">Male (Actors)</option>
              <option value="Non-binary">Non-binary</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="filter-group">
            <label className="form-label">Primary Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="form-input select-filter"
            >
              <option value="">All Roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Grid of Cast Profiles */}
      {loading ? (
        <div className="catalogue-loading flex-center">
          <Loader2 size={32} className="spinner" style={{ marginRight: '0.5rem' }} />
          <span>Searching profiles...</span>
        </div>
      ) : filteredCast.length === 0 ? (
        <div className="catalogue-empty">
          <h3>No profiles found</h3>
          <p>Try resetting the search criteria or type in the search box to fetch from TMDB.</p>
          <button onClick={handleResetFilters} className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {sortedCast.map((member) => (
            <CastCard 
              key={member.refId || member._id} 
              cast={member} 
              userFavourites={userFavs}
              onClick={handleCastClick}
              highlighted={(member._id || member.refId) === selectedCardId}
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
        .cast-directory-container {
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
          gap: 1rem;
        }
        @media (max-width: 768px) {
          .filters-grid {
            grid-template-columns: 1fr !important;
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
          width: 44px;
          height: 44px;
          object-fit: cover;
          border-radius: 50%;
          border: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .suggestion-item-img-fallback {
          width: 44px;
          height: 44px;
          background-color: var(--bg-tertiary);
          border-radius: 50%;
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
        .badge-outline-sm.type-person {
          border: 1px solid rgba(236, 72, 153, 0.3);
          color: #ec4899;
          background-color: rgba(236, 72, 153, 0.05);
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

export default Cast;
