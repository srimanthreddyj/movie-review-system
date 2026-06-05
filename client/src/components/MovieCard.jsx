import React from 'react';
import { Link } from 'react-router-dom';
import { Film, Tv, Calendar } from 'lucide-react';
import { getProxiedImageUrl } from '../services/api';

const MovieCard = ({ movie, userTags = [], userFavourites = [], onClick }) => {
  const { _id, source, title, mediaType, releaseDate, posterUrl, genre = [] } = movie;
  
  const isExternal = source && source !== 'local';
  
  // Format release year
  const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
  
  // Check if this item is in the user's favourites list safely
  const favouriteItem = (_id && userFavourites) ? userFavourites.find(
    (fav) => fav.entityId && fav.entityId.toString() === _id.toString()
  ) : null;
  
  // Map assigned tags safely
  const assignedTags = (_id && userTags) ? userTags.filter(
    (tag) => tag.entityId && tag.entityId.toString() === _id.toString()
  ) : [];

  const CardContent = () => (
    <>
      <div className="card-img-container">
        {posterUrl ? (
          <img src={getProxiedImageUrl(posterUrl)} alt={title} className="card-img" loading="lazy" />
        ) : (
          <div className="card-img-fallback flex-center">
            {mediaType === 'series' ? <Tv size={40} /> : <Film size={40} />}
            <span className="fallback-text">{title}</span>
          </div>
        )}
        
        {/* Media Type Badge Overlay */}
        <span className="media-type-badge flex-center">
          {mediaType === 'series' ? <Tv size={12} /> : <Film size={12} />}
          <span style={{ textTransform: 'capitalize', marginLeft: '0.25rem' }}>{mediaType}</span>
        </span>

        {/* Source/Import Status Badge Overlay */}
        <span className={`source-badge flex-center ${isExternal ? 'source-external' : 'source-local'}`}>
          {isExternal ? `TMDB` : 'In Catalog'}
        </span>

        {/* Priority Level Overlay if Favourited */}
        {favouriteItem && (
          <span className={`priority-badge priority-${favouriteItem.level.toLowerCase()}`}>
            {favouriteItem.level}
          </span>
        )}
      </div>
      
      <div className="card-content">
        <h3 className="card-title" title={title}>{title}</h3>
        
        <div className="movie-card-meta flex-center">
          <Calendar size={13} />
          <span className="meta-text">{releaseYear}</span>
        </div>

        {/* Genres */}
        {genre.length > 0 && (
          <div className="movie-card-genres">
            {genre.slice(0, 2).map((g, index) => (
              <span key={index} className="genre-pill">{g}</span>
            ))}
          </div>
        )}

        {/* User Tag Indicators */}
        {assignedTags.length > 0 && (
          <div className="movie-card-tags">
            {assignedTags.slice(0, 3).map((assignment) => (
              <span 
                key={assignment._id} 
                className="tag-dot" 
                style={{ backgroundColor: assignment.color || '#808080' }} 
                title={assignment.name}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="card movie-card">
      {isExternal ? (
        <div 
          onClick={() => onClick && onClick(movie)} 
          className="movie-card-link"
          style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <CardContent />
        </div>
      ) : (
        <Link to={`/movies/${_id}`} className="movie-card-link">
          <CardContent />
        </Link>
      )}

      <style>{`
        .movie-card {
          height: 100%;
        }
        .movie-card-link {
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
        .media-type-badge {
          position: absolute;
          top: 0.5rem;
          left: 0.5rem;
          padding: 0.25rem 0.5rem;
          background-color: rgba(0, 0, 0, 0.75);
          color: #ffffff;
          border-radius: var(--border-radius);
          font-size: 0.75rem;
          font-weight: 500;
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
        .movie-card-meta {
          justify-content: flex-start;
          gap: 0.25rem;
          font-size: 0.813rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }
        .meta-text {
          line-height: 1;
        }
        .movie-card-genres {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          margin-top: auto;
          margin-bottom: 0.5rem;
        }
        .genre-pill {
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-secondary);
        }
        .movie-card-tags {
          display: flex;
          gap: 0.25rem;
          margin-top: 0.25rem;
          padding-top: 0.25rem;
          border-top: 1px dashed var(--border-color);
        }
        .tag-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
};

export default MovieCard;

