import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import CastCard from '../components/CastCard';
import { Search, RotateCcw, Loader2 } from 'lucide-react';

const Cast = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [castList, setCastList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFavs, setUserFavs] = useState([]);
  const [importingCast, setImportingCast] = useState(false);
  const [importError, setImportError] = useState(null);

  // Search/Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    if (!searchQuery) {
      fetchCastData();
    }
    refreshUser();
  }, []);

  const fetchCastData = async () => {
    setLoading(true);
    try {
      const [castRes, favsRes] = await Promise.all([
        api.get('/cast'),
        api.get('/favourites')
      ]);
      setCastList(castRes.data.casts || []);
      setUserFavs(favsRes.data.cast || []);
    } catch (err) {
      console.error('Failed to load cast data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setGenderFilter('');
    setRoleFilter('');
    fetchCastData();
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      fetchCastData();
      return;
    }
    setLoading(true);
    setImportError(null);
    try {
      const response = await api.get('/cast/search-external', {
        params: { q: searchQuery }
      });
      setCastList(response.data || []);
    } catch (err) {
      console.error('External cast search failed:', err);
      setImportError('Failed to execute search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCastClick = async (member) => {
    const isLocal = !member.source || member.source === 'local';
    if (isLocal) {
      const localId = member._id || member.refId;
      if (localId && localId !== 'undefined') {
        navigate(`/cast/${localId}`);
      }
      return;
    }
    const targetId = member.refId || member.tmdbId;
    if (targetId && targetId !== 'undefined') {
      navigate(`/cast/tmdb-${targetId}?source=${member.source || 'tmdb'}`);
    }
  };

  // Perform cascading filters locally
  // Actresses (Female gender) are always pushed to the front in the sort order
  const filteredCast = castList
    .filter((member) => {
      const matchesSearch = searchQuery
        ? member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (member.nationality && member.nationality.toLowerCase().includes(searchQuery.toLowerCase()))
        : true;
      const matchesGender = genderFilter ? member.gender === genderFilter : true;
      const matchesRole = roleFilter ? member.knownFor === roleFilter : true;
      return matchesSearch && matchesGender && matchesRole;
    })
    .sort((a, b) => {
      // Priority sorting: Female actresses first, then by name
      const aFemale = a.gender === 'Female' ? 1 : 0;
      const bFemale = b.gender === 'Female' ? 1 : 0;
      if (aFemale !== bFemale) {
        return bFemale - aFemale; // Female first
      }
      return a.name.localeCompare(b.name);
    });

  // Extract unique roles/knownFor for filter list
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
        <form onSubmit={handleSearch} className="search-bar-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search TMDB & Catalog by name, nationality..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary search-submit-btn">
            Search
          </button>
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
          {filteredCast.map((member) => (
            <CastCard 
              key={member.refId || member._id} 
              cast={member} 
              userFavourites={userFavs}
              onClick={handleCastClick}
            />
          ))}
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
      `}</style>
    </div>
  );
};

export default Cast;
