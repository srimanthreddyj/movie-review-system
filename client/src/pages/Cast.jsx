import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import CastCard from '../components/CastCard';
import { Search, UserPlus, RotateCcw } from 'lucide-react';

const Cast = () => {
  const { user, refreshUser } = useAuth();
  const [castList, setCastList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFavs, setUserFavs] = useState([]);

  // Search/Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    fetchCastData();
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
  };

  // Perform cascading filters locally
  // Actresses (Female gender) are always pushed to the front in the sort order
  const filteredCast = castList
    .filter((member) => {
      const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.nationality && member.nationality.toLowerCase().includes(searchQuery.toLowerCase()));
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
  const roles = [...new Set(castList.map(c => c.knownFor).filter(Boolean))];

  return (
    <div className="container cast-directory-container">
      <header className="catalogue-header flex-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1>Cast Profiles</h1>
          <p style={{ margin: 0 }}>Discover actors and actresses. Actresses are highlighted and prioritized first.</p>
        </div>
        <button onClick={handleResetFilters} className="btn flex-center" style={{ gap: '0.375rem' }}>
          <RotateCcw size={14} />
          <span>Reset Filters</span>
        </button>
      </header>

      {/* Filters Bar */}
      <section className="filters-section">
        <div className="search-bar-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by name, nationality..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
        <div className="catalogue-loading flex-center">Loading profiles...</div>
      ) : filteredCast.length === 0 ? (
        <div className="catalogue-empty">
          <h3>No profiles found</h3>
          <p>Try resetting the search criteria or add new profiles in the Admin Hub.</p>
          <button onClick={handleResetFilters} className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {filteredCast.map((member) => (
            <CastCard 
              key={member._id} 
              cast={member} 
              userFavourites={userFavs}
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
        }
        .search-input {
          padding-left: 2.75rem !important;
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
      `}</style>
    </div>
  );
};

export default Cast;
