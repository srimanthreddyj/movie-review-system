import React from 'react';
import { Link } from 'react-router-dom';
import { User, Globe } from 'lucide-react';
import { getProxiedImageUrl } from '../services/api';

const CastCard = ({ cast, userFavourites = [], characterName, onClick }) => {
  const { _id, name, photoUrl, knownFor, gender, nationality, source } = cast;

  const isFemale = gender === 'Female';
  const isExternal = source && source !== 'local';
  
  // Check if this cast member is in the user's favourites list safely
  const favouriteItem = (_id && userFavourites) ? userFavourites.find(
    (fav) => fav.entityId && fav.entityId.toString() === _id.toString()
  ) : null;

  const CardContent = () => (
    <>
      <div className="card-img-container">
        {photoUrl ? (
          <img src={getProxiedImageUrl(photoUrl)} alt={name} className="card-img" loading="lazy" />
        ) : (
          <div className="card-img-fallback flex-center">
            <User size={40} />
            <span className="fallback-text">{name}</span>
          </div>
        )}

        {/* Female Priority / Actress Accent Badge */}
        {isFemale && (
          <span className="actress-badge badge badge-female">
            Actress
          </span>
        )}

        {/* Source/Import Status Badge Overlay */}
        <span className={`source-badge flex-center ${isExternal ? 'source-external' : 'source-local'}`}>
          {isExternal ? `TMDB` : 'In Catalog'}
        </span>

        {/* Favourites Priority Badge */}
        {favouriteItem && (
          <span className={`priority-badge priority-${favouriteItem.level.toLowerCase()}`}>
            {favouriteItem.level}
          </span>
        )}
      </div>

      <div className="card-content">
        <h3 className="card-title" title={name}>{name}</h3>
        
        {/* Character Name display (if passed from movie view context) */}
        {characterName && (
          <p className="cast-character-name" title={characterName}>
            as <span>{characterName}</span>
          </p>
        )}

        <div className="cast-meta-info flex-between">
          <span className="cast-known-for">{knownFor || 'Actor'}</span>
          {nationality && (
            <span className="cast-nationality flex-center" title={`Nationality: ${nationality}`}>
              <Globe size={11} style={{ marginRight: '0.25rem', opacity: 0.7 }} />
              {nationality}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className={`card cast-card ${isFemale ? 'actress-card' : ''}`}>
      {isExternal ? (
        <div 
          onClick={() => onClick && onClick(cast)} 
          className="cast-card-link"
          style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <CardContent />
        </div>
      ) : (
        <Link to={`/cast/${_id}`} className="cast-card-link">
          <CardContent />
        </Link>
      )}

      <style>{`
        .cast-card {
          height: 100%;
        }
        .actress-card {
          border-color: rgba(236, 72, 153, 0.2);
        }
        .actress-card:hover {
          border-color: #ec4899;
          box-shadow: 0 10px 15px -3px rgba(236, 72, 153, 0.1), 0 4px 6px -2px rgba(236, 72, 153, 0.05);
        }
        .cast-card-link {
          color: inherit;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .card-img-fallback {
          flex-direction: column;
          gap: 0.5rem;
          height: 100%;
          background: var(--bg-tertiary);
          color: var(--text-muted);
          padding: 1rem;
          text-align: center;
        }
        .fallback-text {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
        }
        .actress-badge {
          position: absolute;
          top: 0.5rem;
          left: 0.5rem;
          font-weight: 600;
          border-radius: var(--border-radius);
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          z-index: 2;
        }
        .source-badge {
          position: absolute;
          bottom: 0.5rem;
          left: 0.5rem;
          padding: 0.25rem 0.5rem;
          color: #ffffff;
          border-radius: var(--border-radius);
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 2;
        }
        .source-external {
          background-color: rgba(59, 130, 246, 0.95); /* Blue */
        }
        .source-local {
          background-color: rgba(16, 185, 129, 0.95); /* Green */
        }
        .priority-badge {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          padding: 0.25rem 0.5rem;
          border-radius: var(--border-radius);
          font-size: 0.75rem;
          font-weight: 600;
          color: #ffffff;
          z-index: 2;
        }
        .priority-high {
          background-color: #dc2626;
        }
        .priority-medium {
          background-color: #d97706;
        }
        .priority-low {
          background-color: #4b5563;
        }
        .cast-character-name {
          font-size: 0.813rem;
          margin-bottom: 0.5rem;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: left;
        }
        .cast-character-name span {
          color: var(--text-primary);
          font-weight: 500;
        }
        .cast-meta-info {
          margin-top: auto;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .cast-known-for {
          font-weight: 500;
          background-color: var(--bg-tertiary);
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          border: 1px solid var(--border-color);
        }
        .cast-nationality {
          gap: 0.125rem;
        }
      `}</style>
    </div>
  );
};

export default CastCard;

