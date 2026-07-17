import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import CastCard from '../components/CastCard';
import ClipCard from '../components/ClipCard';
import { Heart, Film, Users, Video, AlertTriangle } from 'lucide-react';
import { useRestorePageState } from '../context/NavigationHistoryContext';

const Favourites = () => {
  const { refreshUser } = useAuth();
  const location = useLocation();

  const [favourites, setFavourites] = useState({ movies: [], cast: [], clips: [] });
  const [loading, setLoading] = useState(true);

  // Navigation History State Restoration
  const [pageState, setPageState] = useRestorePageState('favourites', {
    activeTab: 'movies',
    priorityFilter: '',
    currentPage: 1,
    selectedCardId: null
  }, loading);

  const { activeTab, priorityFilter, currentPage, selectedCardId } = pageState;

  const setActiveTab = (val) => setPageState(prev => ({ ...prev, activeTab: typeof val === 'function' ? val(prev.activeTab) : val }));
  const setPriorityFilter = (val) => setPageState(prev => ({ ...prev, priorityFilter: typeof val === 'function' ? val(prev.priorityFilter) : val }));
  const setCurrentPage = (val) => setPageState(prev => ({ ...prev, currentPage: typeof val === 'function' ? val(prev.currentPage) : val }));
  const setSelectedCardId = (val) => setPageState(prev => ({ ...prev, selectedCardId: typeof val === 'function' ? val(prev.selectedCardId) : val }));

  const isInitialMountRef = useRef(true);

  // Reset page when tab or priority changes
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    setCurrentPage(1);
  }, [activeTab, priorityFilter]);

  useEffect(() => {
    fetchFavourites();
    refreshUser();
  }, []);

  const fetchFavourites = async () => {
    setLoading(true);
    try {
      const response = await api.get('/favourites');
      setFavourites(response.data);
    } catch (err) {
      console.error('Failed to load favourites list:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredItems = (items) => {
    if (!items) return [];
    
    let filtered = [...items];
    if (priorityFilter) {
      filtered = filtered.filter(item => item.level === priorityFilter);
    }

    // Sort priority: High -> Medium -> Low
    const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
    return filtered.sort((a, b) => priorityOrder[a.level] - priorityOrder[b.level]);
  };

  const renderActiveTabContent = () => {
    const items = favourites[activeTab] || [];
    const filteredItems = getFilteredItems(items);

    if (filteredItems.length === 0) {
      return (
        <div className="fav-empty-state flex-center">
          <Heart size={48} className="empty-fav-icon" />
          <h3>No Favourites Found</h3>
          <p>
            {priorityFilter 
              ? `You do not have any ${priorityFilter} priority items in this category.`
              : `You haven't added any items to this category yet.`}
          </p>
          {!priorityFilter && (
            <span style={{ fontSize: '0.813rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Explore the database pages and click "Add to Favourites" to populate this list.
            </span>
          )}
        </div>
      );
    }

    const totalPages = Math.ceil(filteredItems.length / 12);
    const paginatedItems = filteredItems.slice((currentPage - 1) * 12, currentPage * 12);

    // Grouping by priority for visual clean dividers
    const highPriority = paginatedItems.filter(i => i.level === 'High');
    const mediumPriority = paginatedItems.filter(i => i.level === 'Medium');
    const lowPriority = paginatedItems.filter(i => i.level === 'Low');

    const renderGrid = (list) => (
      <div className="grid-cards" style={{ marginBottom: '2.5rem' }}>
        {list.map((item) => {
          if (activeTab === 'movies' && item.details) {
            return (
              <MovieCard 
                key={item._id} 
                movie={item.details} 
                userFavourites={favourites.movies}
                onClick={(movie) => setSelectedCardId(movie._id || movie.refId)}
                highlighted={(item.details._id || item.details.refId) === selectedCardId}
              />
            );
          }
          if (activeTab === 'cast' && item.details) {
            return (
              <CastCard 
                key={item._id} 
                cast={item.details} 
                userFavourites={favourites.cast}
                onClick={(cast) => setSelectedCardId(cast._id || cast.refId)}
                highlighted={(item.details._id || item.details.refId) === selectedCardId}
              />
            );
          }
          if (activeTab === 'clips' && item.details) {
            return (
              <ClipCard 
                key={item._id} 
                clip={item.details} 
                onDelete={null} // View mode only on favourites tab
                userFavourites={favourites.clips}
                onFavouriteUpdate={fetchFavourites}
              />
            );
          }
          return null;
        })}
      </div>
    );

    return (
      <div className="fav-tab-content">
        {/* If All Priorities Filter is active, show grouped dividers */}
        {!priorityFilter ? (
          <>
            {highPriority.length > 0 && (
              <div>
                <h3 className="priority-group-header flex-center" style={{ color: 'var(--error-color)' }}>
                  <span className="dot dot-high" />
                  <span>High Priority</span>
                </h3>
                {renderGrid(highPriority)}
              </div>
            )}
            {mediumPriority.length > 0 && (
              <div>
                <h3 className="priority-group-header flex-center" style={{ color: '#d97706' }}>
                  <span className="dot dot-medium" />
                  <span>Medium Priority</span>
                </h3>
                {renderGrid(mediumPriority)}
              </div>
            )}
            {lowPriority.length > 0 && (
              <div>
                <h3 className="priority-group-header flex-center" style={{ color: 'var(--text-secondary)' }}>
                  <span className="dot dot-low" />
                  <span>Low Priority</span>
                </h3>
                {renderGrid(lowPriority)}
              </div>
            )}
          </>
        ) : (
          renderGrid(paginatedItems)
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="pagination-container" style={{ marginTop: '1rem' }}>
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
      </div>
    );
  };

  return (
    <div className="container favourites-container">
      <header className="catalogue-header flex-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1>My Favourites</h1>
          <p style={{ margin: 0 }}>Organized lists of your tracked movies, cast profiles, and clips.</p>
        </div>

        {/* Priority Filter Buttons */}
        <div className="priority-filter-bar flex-center" style={{ gap: '0.25rem' }}>
          <button 
            onClick={() => setPriorityFilter('')} 
            className={`btn btn-sm ${priorityFilter === '' ? 'btn-primary' : ''}`}
            style={{ minHeight: '32px' }}
          >
            All Priorities
          </button>
          <button 
            onClick={() => setPriorityFilter('High')} 
            className={`btn btn-sm ${priorityFilter === 'High' ? 'btn-primary' : ''}`}
            style={{ minHeight: '32px' }}
          >
            High
          </button>
          <button 
            onClick={() => setPriorityFilter('Medium')} 
            className={`btn btn-sm ${priorityFilter === 'Medium' ? 'btn-primary' : ''}`}
            style={{ minHeight: '32px' }}
          >
            Medium
          </button>
          <button 
            onClick={() => setPriorityFilter('Low')} 
            className={`btn btn-sm ${priorityFilter === 'Low' ? 'btn-primary' : ''}`}
            style={{ minHeight: '32px' }}
          >
            Low
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs-container">
        <button 
          onClick={() => setActiveTab('movies')} 
          className={`tab-btn flex-center ${activeTab === 'movies' ? 'active' : ''}`}
          style={{ gap: '0.375rem' }}
        >
          <Film size={16} />
          <span>Movies & TV Shows ({favourites.movies?.length || 0})</span>
        </button>
        <button 
          onClick={() => setActiveTab('cast')} 
          className={`tab-btn flex-center ${activeTab === 'cast' ? 'active' : ''}`}
          style={{ gap: '0.375rem' }}
        >
          <Users size={16} />
          <span>Cast Profiles ({favourites.cast?.length || 0})</span>
        </button>
        <button 
          onClick={() => setActiveTab('clips')} 
          className={`tab-btn flex-center ${activeTab === 'clips' ? 'active' : ''}`}
          style={{ gap: '0.375rem' }}
        >
          <Video size={16} />
          <span>Video Clips ({favourites.clips?.length || 0})</span>
        </button>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="catalogue-loading flex-center">Loading your favourites...</div>
      ) : (
        renderActiveTabContent()
      )}

      <style>{`
        .favourites-container {
          padding-top: 2rem;
          padding-bottom: 4rem;
          text-align: left;
        }
        .catalogue-header h1 {
          margin-bottom: 0.25rem;
          border: none;
          padding: 0;
        }
        .priority-group-header {
          font-size: 0.875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1rem;
          justify-content: flex-start;
          gap: 0.5rem;
          padding-bottom: 0.25rem;
          border-bottom: 1px dashed var(--border-color);
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .dot-high { background-color: var(--error-color); }
        .dot-medium { background-color: #d97706; }
        .dot-low { background-color: #737373; }
        
        .fav-empty-state {
          flex-direction: column;
          padding: 5rem 1rem;
          background-color: var(--bg-secondary);
          border: 1px dashed var(--border-color);
          border-radius: var(--border-radius);
          text-align: center;
        }
        .empty-fav-icon {
          color: var(--text-muted);
          opacity: 0.5;
          margin-bottom: 1rem;
        }
        .fav-empty-state h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .fav-empty-state p {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 0;
          max-width: 350px;
        }
        .catalogue-loading {
          padding: 6rem 0;
          color: var(--text-muted);
          font-size: 1rem;
        }
      `}</style>
    </div>
  );
};

export default Favourites;
