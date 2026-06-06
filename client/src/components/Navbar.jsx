import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, LogOut, Menu, X, Film, Users, Heart, Video, FolderOpen, Shield, Search, User, Loader2 } from 'lucide-react';
import api, { getProxiedImageUrl } from '../services/api';
import ExternalPreviewModal from './ExternalPreviewModal';

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isOpen, setIsOpen] = useState(false);

  // Movie search states
  const [movieQuery, setMovieQuery] = useState('');
  const [movieSuggestions, setMovieSuggestions] = useState([]);
  const [isMovieLoading, setIsMovieLoading] = useState(false);
  const [showMovieDropdown, setShowMovieDropdown] = useState(false);

  // Cast search states
  const [castQuery, setCastQuery] = useState('');
  const [castSuggestions, setCastSuggestions] = useState([]);
  const [isCastLoading, setIsCastLoading] = useState(false);
  const [showCastDropdown, setShowCastDropdown] = useState(false);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.movie-search-wrapper')) {
        setShowMovieDropdown(false);
      }
      if (!e.target.closest('.cast-search-wrapper')) {
        setShowCastDropdown(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Debounced search logic for Movie autocomplete
  useEffect(() => {
    if (movieQuery.trim().length < 2) {
      setMovieSuggestions([]);
      setShowMovieDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsMovieLoading(true);
      try {
        const response = await api.get('/movies/search', {
          params: { q: movieQuery }
        });
        setMovieSuggestions(response.data || []);
        setShowMovieDropdown(true);
      } catch (err) {
        console.error('Movie Autocomplete fetch failed:', err);
      } finally {
        setIsMovieLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [movieQuery]);

  // Debounced search logic for Cast autocomplete
  useEffect(() => {
    if (castQuery.trim().length < 2) {
      setCastSuggestions([]);
      setShowCastDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCastLoading(true);
      try {
        const response = await api.get('/cast/search-external', {
          params: { q: castQuery }
        });
        setCastSuggestions(response.data || []);
        setShowCastDropdown(true);
      } catch (err) {
        console.error('Cast Autocomplete fetch failed:', err);
      } finally {
        setIsCastLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [castQuery]);

  const handleMovieSuggestionClick = (item) => {
    setMovieQuery('');
    setMovieSuggestions([]);
    setShowMovieDropdown(false);

    if (item.source === 'local') {
      if (item.refId && item.refId !== 'undefined') {
        navigate(`/movies/${item.refId}`);
      }
    } else {
      const targetId = item.refId || item.tmdbId;
      if (targetId && targetId !== 'undefined') {
        navigate(`/movies/tmdb-${targetId}?source=${item.source || 'tmdb'}&mediaType=${item.mediaType || 'movie'}`);
      }
    }
  };

  const handleCastSuggestionClick = (item) => {
    setCastQuery('');
    setCastSuggestions([]);
    setShowCastDropdown(false);

    if (item.source === 'local') {
      if (item.refId && item.refId !== 'undefined') {
        navigate(`/cast/${item.refId}`);
      }
    } else {
      const targetId = item.refId || item.tmdbId;
      if (targetId && targetId !== 'undefined') {
        navigate(`/cast/tmdb-${targetId}?source=${item.source || 'tmdb'}`);
      }
    }
  };

  // Set the data-theme attribute on the <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  // Render navigation links
  const renderLinks = (isMobile = false) => {
    const linkClass = (path) => `nav-link ${isActive(path) ? 'active' : ''} ${isMobile ? 'mobile-link' : ''}`;
    
    return (
      <>
        <Link to="/movies" className={linkClass('/movies')} onClick={() => setIsOpen(false)}>
          <Film size={18} className="link-icon" />
          <span>Movies & Shows</span>
        </Link>
        <Link to="/cast" className={linkClass('/cast')} onClick={() => setIsOpen(false)}>
          <Users size={18} className="link-icon" />
          <span>Cast Profiles</span>
        </Link>
        <Link to="/favourites" className={linkClass('/favourites')} onClick={() => setIsOpen(false)}>
          <Heart size={18} className="link-icon" />
          <span>Favourites</span>
        </Link>
        <Link to="/clips" className={linkClass('/clips')} onClick={() => setIsOpen(false)}>
          <Video size={18} className="link-icon" />
          <span>Clip Room</span>
        </Link>
        <Link to="/collections" className={linkClass('/collections')} onClick={() => setIsOpen(false)}>
          <FolderOpen size={18} className="link-icon" />
          <span>Collections</span>
        </Link>
        <Link to="/admin" className={linkClass('/admin')} onClick={() => setIsOpen(false)}>
          <Shield size={18} className="link-icon" />
          <span>Import Hub</span>
        </Link>
      </>
    );
  };

  if (!user) return null; // Hide Navbar if user is not logged in

  return (
    <nav className="navbar">
      <div className="navbar-container flex-between">
        {/* Brand Logo */}
        <Link to="/" className="navbar-brand">
          <Film size={24} className="brand-logo-icon" />
          <span className="brand-text">CineTrack</span>
        </Link>

        {/* Dual Search Input Boxes */}
        <div className="navbar-search-container">
          {/* Movies & Shows Search */}
          <div className="navbar-search-wrapper movie-search-wrapper">
            <div className="navbar-search-field">
              <Search size={16} className="search-field-icon" />
              <input
                type="text"
                placeholder="Search movies & shows..."
                value={movieQuery}
                onChange={(e) => setMovieQuery(e.target.value)}
                onFocus={() => { if (movieSuggestions.length > 0) setShowMovieDropdown(true); }}
              />
              {isMovieLoading && <Loader2 size={14} className="search-field-spinner spinner" />}
            </div>

            {showMovieDropdown && movieSuggestions.length > 0 && (
              <div className="navbar-suggestions-dropdown">
                {movieSuggestions.map((item, index) => (
                  <div
                     key={index}
                     className="navbar-suggestion-item"
                     onClick={() => handleMovieSuggestionClick(item)}
                  >
                    <div className="suggestion-item-main">
                      {item.posterUrl ? (
                        <img src={getProxiedImageUrl(item.posterUrl)} alt={item.title} className="suggestion-item-img" />
                      ) : (
                        <div className="suggestion-item-img-fallback flex-center">
                          <Film size={14} />
                        </div>
                      )}
                      <div className="suggestion-item-meta">
                        <span className="suggestion-item-title">{item.title}</span>
                        {item.releaseDate && (
                          <span className="suggestion-item-year">
                            {new Date(item.releaseDate).getFullYear()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="suggestion-item-tags">
                      <span className={`badge-outline-sm type-${item.mediaType === 'series' ? 'series' : 'movie'}`}>
                        {item.mediaType === 'series' ? 'show' : 'movie'}
                      </span>
                      {item.source === 'local' ? (
                        <span className="badge-success-sm">Saved</span>
                      ) : (
                        <span className="badge-secondary-sm">TMDB</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cast Members Search */}
          <div className="navbar-search-wrapper cast-search-wrapper">
            <div className="navbar-search-field">
              <Search size={16} className="search-field-icon" />
              <input
                type="text"
                placeholder="Search cast members..."
                value={castQuery}
                onChange={(e) => setCastQuery(e.target.value)}
                onFocus={() => { if (castSuggestions.length > 0) setShowCastDropdown(true); }}
              />
              {isCastLoading && <Loader2 size={14} className="search-field-spinner spinner" />}
            </div>

            {showCastDropdown && castSuggestions.length > 0 && (
              <div className="navbar-suggestions-dropdown">
                {castSuggestions.map((item, index) => (
                  <div
                     key={index}
                     className="navbar-suggestion-item"
                     onClick={() => handleCastSuggestionClick(item)}
                  >
                    <div className="suggestion-item-main">
                      {item.photoUrl ? (
                        <img src={getProxiedImageUrl(item.photoUrl)} alt={item.name} className="suggestion-item-img" />
                      ) : (
                        <div className="suggestion-item-img-fallback flex-center">
                          <User size={14} />
                        </div>
                      )}
                      <div className="suggestion-item-meta">
                        <span className="suggestion-item-title">{item.name}</span>
                        {item.knownFor && (
                          <span className="suggestion-item-year" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                            {item.knownFor}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="suggestion-item-tags">
                      <span className="badge-outline-sm type-person">
                        person
                      </span>
                      {item.source === 'local' ? (
                        <span className="badge-success-sm">Saved</span>
                      ) : (
                        <span className="badge-secondary-sm">TMDB</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <div className="navbar-links-desktop">
          {renderLinks()}
        </div>

        {/* Action Controls (Theme, User Profile, Mobile Menu) */}
        <div className="navbar-actions flex-center">
          <button 
            onClick={toggleTheme} 
            className="navbar-action-btn flex-center"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <div className="user-profile-widget flex-center">
            <span className="user-profile-name">{user.name}</span>
            <button 
              onClick={handleLogout} 
              className="navbar-action-btn logout-btn flex-center"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="navbar-mobile-toggle flex-center"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar/Drawer Menu */}
      {isOpen && (
        <div className="navbar-drawer-backdrop" onClick={() => setIsOpen(false)}>
          <div className="navbar-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header flex-between">
              <span className="drawer-title">Navigation</span>
              <button onClick={() => setIsOpen(false)} className="drawer-close-btn flex-center">
                <X size={20} />
              </button>
            </div>
            <div className="drawer-links">
              {renderLinks(true)}
            </div>
            <div className="drawer-footer flex-between">
              <span className="drawer-username">{user.name} ({user.role})</span>
              <button onClick={handleLogout} className="btn btn-danger flex-center" style={{ gap: '0.5rem', width: '100%', minHeight: '44px' }}>
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .navbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          width: 100%;
          min-height: 64px;
          display: flex;
          align-items: center;
        }
        .navbar-container {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }
        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 1.25rem;
          color: var(--text-primary);
        }
        .brand-logo-icon {
          color: var(--accent-color);
        }
        .navbar-links-desktop {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        @media (max-width: 1024px) {
          .navbar-links-desktop {
            display: none;
          }
        }
        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          border-radius: var(--border-radius);
          transition: background-color var(--transition-speed), color var(--transition-speed);
        }
        .nav-link:hover {
          color: var(--text-primary);
          background-color: var(--bg-tertiary);
        }
        .nav-link.active {
          color: var(--text-primary);
          background-color: var(--accent-light);
        }
        .link-icon {
          opacity: 0.7;
        }
        .nav-link.active .link-icon {
          color: var(--accent-color);
          opacity: 1;
        }
        .navbar-actions {
          gap: 0.75rem;
        }
        .navbar-action-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: background-color var(--transition-speed), color var(--transition-speed);
        }
        .navbar-action-btn:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .user-profile-widget {
          gap: 0.5rem;
        }
        .user-profile-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
        }
        @media (max-width: 640px) {
          .user-profile-name {
            display: none;
          }
        }
        .navbar-mobile-toggle {
          display: none;
          width: 40px;
          height: 40px;
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          cursor: pointer;
        }
        @media (max-width: 1024px) {
          .navbar-mobile-toggle {
            display: flex;
          }
        }

        /* Mobile Drawer Styles */
        .navbar-drawer-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0,0,0,0.4);
          display: flex;
          justify-content: flex-end;
          z-index: 1000;
        }
        .navbar-drawer {
          width: 280px;
          max-width: 80%;
          height: 100%;
          background-color: var(--bg-primary);
          border-left: 1px solid var(--border-color);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-md);
        }
        .drawer-header {
          margin-bottom: 1.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
        }
        .drawer-title {
          font-weight: 600;
          font-size: 1rem;
        }
        .drawer-close-btn {
          width: 32px;
          height: 32px;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .drawer-links {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex-grow: 1;
        }
        .mobile-link {
          width: 100%;
          padding: 0.75rem 1rem;
          font-size: 1rem;
        }
        .drawer-footer {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
          flex-direction: column;
          gap: 1rem;
          align-items: flex-start;
        }
        .drawer-username {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        /* Autocomplete Search Styles */
        .navbar-search-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .navbar-search-wrapper {
          position: relative;
          width: 180px;
          margin: 0;
        }
        @media (min-width: 1200px) {
          .navbar-search-wrapper {
            width: 220px;
          }
        }
        @media (max-width: 1024px) {
          .navbar-search-container {
            display: none;
          }
        }
        .navbar-search-field {
          position: relative;
          display: flex;
          align-items: center;
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 9999px;
          padding: 0.375rem 0.75rem;
          width: 100%;
          transition: border-color var(--transition-speed), box-shadow var(--transition-speed);
        }
        .navbar-search-field:focus-within {
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px var(--accent-light);
        }
        .search-field-icon {
          color: var(--text-secondary);
          margin-right: 0.5rem;
          flex-shrink: 0;
        }
        .navbar-search-field input {
          background: none;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 0.875rem;
          width: 100%;
        }
        .search-field-spinner {
          color: var(--accent-color);
          margin-left: 0.5rem;
          flex-shrink: 0;
        }
        .navbar-suggestions-dropdown {
          position: absolute;
          top: calc(100% + 0.5rem);
          left: 0;
          width: 360px;
          max-height: 400px;
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
        .navbar-suggestion-item {
          padding: 0.5rem 1rem;
          cursor: pointer;
          transition: background-color var(--transition-speed);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .navbar-suggestion-item:hover {
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
          width: 32px;
          height: 44px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .suggestion-item-img-fallback {
          width: 32px;
          height: 44px;
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
    </nav>
  );
};

export default Navbar;
