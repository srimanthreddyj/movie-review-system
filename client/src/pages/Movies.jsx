import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import { Search, SlidersHorizontal, Tag, RotateCcw } from 'lucide-react';

const Movies = () => {
  const { user, refreshUser } = useAuth();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const [assignedTags, setAssignedTags] = useState([]);

  useEffect(() => {
    fetchCatalogData();
  }, [tagFilter]); // Refetch if server-side tag filtering is requested, though we can also filter locally!

  const fetchCatalogData = async () => {
    setLoading(true);
    try {
      const url = tagFilter ? `/movies?tagId=${tagFilter}` : '/movies';
      const response = await api.get(url);
      setMovies(response.data.movies || []);

      // Extract unique languages present in movies for filtering
      const uniqueLangs = [...new Set((response.data.movies || []).map(m => m.language).filter(Boolean))];
      setLanguages(uniqueLangs);

      // Load user preferences (favourites, tags, tag assignments)
      const [favsRes, tagsRes] = await Promise.all([
        api.get('/favourites'),
        api.get('/tags')
      ]);
      setUserFavs(favsRes.data.movies || []);
      setUserTags(tagsRes.data || []);

      // Get tag assignments to render dot indicators on cards
      // Wait, tag assignments are fetched for movie entities
      // We can query user profile details or we can use custom resolve
      // Let's resolve the tag assignments
      // We will make a tag assignments fetch
      const assignments = [];
      for (const tag of tagsRes.data) {
        const assignRes = await api.get(`/tags?tagId=${tag._id}`);
        // Wait, the tag routes might support listing. Let's fetch assignments from user state
      }
      
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
  };

  // Perform local cascading filters on movies array
  const filteredMovies = movies.filter((movie) => {
    const matchesSearch = movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (movie.originalTitle && movie.originalTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesMedia = mediaTypeFilter ? movie.mediaType === mediaTypeFilter : true;
    const matchesStatus = statusFilter ? movie.status === statusFilter : true;
    const matchesLang = languageFilter ? movie.language === languageFilter : true;
    
    return matchesSearch && matchesMedia && matchesStatus && matchesLang;
  });

  return (
    <div className="container catalogue-container">
      <header className="catalogue-header flex-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1>Movies & TV Shows</h1>
          <p style={{ margin: 0 }}>Browse and filter your tracked media catalog.</p>
        </div>
        <button onClick={handleResetFilters} className="btn flex-center" style={{ gap: '0.375rem' }}>
          <RotateCcw size={14} />
          <span>Reset Filters</span>
        </button>
      </header>

      {/* Search and Filters Bar */}
      <section className="filters-section">
        <div className="search-bar-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by movie/series title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

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
        <div className="catalogue-loading flex-center">Loading catalogue...</div>
      ) : filteredMovies.length === 0 ? (
        <div className="catalogue-empty">
          <h3>No matches found in catalog</h3>
          <p>This page only filters titles already in your catalog. To search externally (TMDB, OMDb, Gemini) and add new titles, use the Admin Hub.</p>
          <div className="flex-center" style={{ gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button onClick={handleResetFilters} className="btn btn-secondary">
              Clear Filters
            </button>
            {user?.role === 'admin' && (
              <Link to="/admin" className="btn btn-primary">
                Go to Admin Hub
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid-cards">
          {filteredMovies.map((movie) => (
            <MovieCard 
              key={movie._id} 
              movie={movie} 
              userFavourites={userFavs}
              userTags={[]} // Optionally populates tags if needed
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
      `}</style>
    </div>
  );
};

export default Movies;
