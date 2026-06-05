import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { Heart, ChevronDown, Trash2 } from 'lucide-react';

const FavouriteButton = ({ entityType, entityId, favouritesList = [], onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if this entity is favourited
  const favouriteItem = favouritesList.find(
    (item) => item.entityId.toString() === entityId.toString()
  );

  const handleToggleAdd = async () => {
    setLoading(true);
    try {
      if (!favouriteItem) {
        // Add to favourites (defaults to Medium)
        await api.post(`/favourites/${entityType}/${entityId}`);
      } else {
        // Remove from favourites
        await api.delete(`/favourites/${entityType}/${entityId}`);
      }
      if (onUpdate) await onUpdate();
    } catch (error) {
      console.error('Failed to update favourite status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLevelChange = async (level) => {
    setLoading(true);
    setShowDropdown(false);
    try {
      await api.patch(`/favourites/${entityType}/${entityId}/level`, { level });
      if (onUpdate) await onUpdate();
    } catch (error) {
      console.error('Failed to update priority level:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    setShowDropdown(false);
    try {
      await api.delete(`/favourites/${entityType}/${entityId}`);
      if (onUpdate) await onUpdate();
    } catch (error) {
      console.error('Failed to remove favourite item:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLevelColorClass = (level) => {
    switch (level) {
      case 'High': return 'text-danger';
      case 'Medium': return 'text-warning';
      case 'Low': return 'text-secondary';
      default: return '';
    }
  };

  return (
    <div className="fav-button-wrapper" ref={dropdownRef}>
      {!favouriteItem ? (
        <button 
          onClick={handleToggleAdd} 
          disabled={loading} 
          className="btn fav-btn flex-center"
        >
          <Heart size={16} style={{ marginRight: '0.5rem' }} />
          <span>Add to Favourites</span>
        </button>
      ) : (
        <div className="fav-active-btn-group flex-center">
          <button 
            onClick={handleToggleAdd} 
            disabled={loading} 
            className="btn fav-btn fav-active flex-center"
            title="Remove from Favourites"
          >
            <Heart size={16} fill="var(--error-color)" stroke="var(--error-color)" />
            <span className={`fav-active-level ${getLevelColorClass(favouriteItem.level)}`}>
              {favouriteItem.level} Priority
            </span>
          </button>
          
          <button 
            onClick={() => setShowDropdown(!showDropdown)} 
            disabled={loading}
            className="btn fav-dropdown-toggle flex-center"
            aria-label="Change priority level"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      )}

      {/* Priority Level Selection Dropdown */}
      {showDropdown && favouriteItem && (
        <div className="fav-dropdown-menu">
          <div className="dropdown-header">Priority Level</div>
          <button 
            onClick={() => handleLevelChange('High')} 
            className={`dropdown-item flex-between ${favouriteItem.level === 'High' ? 'active' : ''}`}
          >
            <span className="dot dot-high" />
            <span style={{ flexGrow: 1, textAlign: 'left', marginLeft: '0.5rem' }}>High Priority</span>
          </button>
          <button 
            onClick={() => handleLevelChange('Medium')} 
            className={`dropdown-item flex-between ${favouriteItem.level === 'Medium' ? 'active' : ''}`}
          >
            <span className="dot dot-medium" />
            <span style={{ flexGrow: 1, textAlign: 'left', marginLeft: '0.5rem' }}>Medium Priority</span>
          </button>
          <button 
            onClick={() => handleLevelChange('Low')} 
            className={`dropdown-item flex-between ${favouriteItem.level === 'Low' ? 'active' : ''}`}
          >
            <span className="dot dot-low" />
            <span style={{ flexGrow: 1, textAlign: 'left', marginLeft: '0.5rem' }}>Low Priority</span>
          </button>
          
          <div className="dropdown-divider" />
          
          <button onClick={handleRemove} className="dropdown-item dropdown-item-remove flex-between">
            <Trash2 size={14} className="text-danger" />
            <span style={{ flexGrow: 1, textAlign: 'left', marginLeft: '0.5rem', color: 'var(--error-color)' }}>
              Remove Favourite
            </span>
          </button>
        </div>
      )}

      <style>{`
        .fav-button-wrapper {
          position: relative;
          display: inline-block;
        }
        .fav-btn {
          min-height: 44px;
        }
        .fav-active-btn-group {
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          background-color: var(--bg-secondary);
          overflow: hidden;
        }
        .fav-active-btn-group .btn {
          border: none;
          background: none;
          min-height: 44px;
        }
        .fav-active-btn-group .fav-btn {
          padding-right: 0.5rem;
          border-right: 1px solid var(--border-color);
          border-radius: 0;
        }
        .fav-dropdown-toggle {
          padding: 0 0.75rem;
          border-radius: 0;
          color: var(--text-secondary);
        }
        .fav-dropdown-toggle:hover {
          color: var(--text-primary);
        }
        .fav-active-level {
          font-size: 0.75rem;
          font-weight: 600;
          margin-left: 0.375rem;
        }
        
        /* Dropdown Menu */
        .fav-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 0.25rem;
          width: 200px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          box-shadow: var(--shadow-md);
          z-index: 50;
          padding: 0.375rem 0;
        }
        .dropdown-header {
          padding: 0.375rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .dropdown-item {
          width: 100%;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: background-color var(--transition-speed), color var(--transition-speed);
          display: flex;
          align-items: center;
        }
        .dropdown-item:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .dropdown-item.active {
          color: var(--text-primary);
          background-color: var(--accent-light);
          font-weight: 500;
        }
        .dropdown-divider {
          height: 1px;
          background-color: var(--border-color);
          margin: 0.375rem 0;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .dot-high { background-color: var(--error-color); }
        .dot-medium { background-color: #d97706; }
        .dot-low { background-color: #737373; }
        
        .text-danger { color: var(--error-color); }
        .text-warning { color: #d97706; }
        .text-secondary { color: var(--text-muted); }
      `}</style>
    </div>
  );
};

export default FavouriteButton;
