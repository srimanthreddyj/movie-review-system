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

  // Autocomplete search states
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Preview Modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewEntity, setPreviewEntity] = useState(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.navbar-search-wrapper')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Debounced search logic for autocomplete (searching cast profiles)
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/cast/search-external', {
          params: { q: searchQuery }
        });
        setSuggestions(response.data || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Autocomplete fetch failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSuggestionClick = (item) => {
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);

    const isLocal = item.source === 'local';
    if (isLocal) {
      navigate(`/cast/${item.refId}`);
    } else {
      setPreviewEntity({
        refId: item.refId || item.tmdbId,
        source: item.source || 'tmdb',
        type: 'person',
        title: item.name || item.title
      });
      setPreviewOpen(true);
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

  // Render navigation links (Removing Movies catalogue)
  const renderLinks = (isMobile = false) => {
    const linkClass = (path) => `nav-link ${isActive(path) ? 'active' : ''} ${isMobile ? 'mobile-link' : ''}`;
    
    return (
      <>
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

        {/* Global Autocomplete Search Input */}
        <div className="navbar-search-wrapper">
          <div className="navbar-search-field">
            <Search size={16} className="search-field-icon" />
            <input
              type="text"
              placeholder="Search movies, shows, persons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            />
            {isLoading && <Loader2 size={14} className="search-field-spinner spinner" />}
          </div>

          {showDropdown && suggestions.length > 0 && (
            <div className="navbar-suggestions-dropdown">
              {suggestions.map((item, index) => (
                <div
                   key={index}
                   className="navbar-suggestion-item"
                   onClick={() => handleSuggestionClick(item)}
                >
                  <div className="suggestion-item-main">
                    {item.posterUrl || item.photoUrl ? (
                      <img src={getProxiedImageUrl(item.posterUrl || item.photoUrl)} alt={item.title || item.name} className="suggestion-item-img" />
                    ) : (
                      <div className="suggestion-item-img-fallback flex-center">
                        <User size={14} />
                      </div>
                    )}
                    <div className="suggestion-item-meta">
                      <span className="suggestion-item-title">{item.title || item.name}</span>
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

      {/* External Preview Modal */}
      {previewEntity && (
        <ExternalPreviewModal
          isOpen={previewOpen}
          onClose={() => { setPreviewOpen(false); setPreviewEntity(null); }}
          entityRefId={previewEntity.refId}
          entitySource={previewEntity.source}
          entityType={previewEntity.type}
          entityTitle={previewEntity.title}
        />
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
        .navbar-search-wrapper {
          position: relative;
          width: 320px;
          margin: 0 1rem;
        }
        @media (max-width: 1024px) {
          .navbar-search-wrapper {
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
