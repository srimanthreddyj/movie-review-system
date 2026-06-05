import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Calendar, Tag, Trash2, Edit, FolderPlus } from 'lucide-react';
import AddToCollectionModal from './AddToCollectionModal';

const ClipCard = ({ clip, onDelete, onEdit, currentUserId, isAdmin }) => {
  const { _id, title, url, description, clipType, addedBy, movieId, castInvolved = [], movieInfo, castInvolvedDetails } = clip;
  
  const displayMovie = movieInfo || (movieId && typeof movieId === 'object' ? movieId : null);
  const displayCast = castInvolvedDetails || castInvolved || [];
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);

  // Extract YouTube ID from URL if applicable
  const getYouTubeId = (videoUrl) => {
    if (!videoUrl) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = videoUrl.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getYouTubeId(url);
  const thumbnailUrl = videoId 
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` 
    : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';

  const canManage = addedBy === currentUserId || isAdmin;

  return (
    <div className="card clip-card">
      <div className="card-img-container clip-thumbnail-container" onClick={() => setIsPlaying(true)}>
        <img src={thumbnailUrl} alt={title} className="card-img clip-thumbnail" />
        <div className="clip-play-overlay flex-center">
          <div className="play-icon-circle flex-center">
            <Play size={20} fill="#ffffff" stroke="none" />
          </div>
        </div>
        
        {clipType && (
          <span className="clip-type-badge text-capitalize">{clipType}</span>
        )}
      </div>

      <div className="card-content">
        <h3 className="card-title" title={title}>{title}</h3>
        {displayMovie && (
          <p className="clip-movie-title">
            From: <span>{displayMovie.title}</span>
          </p>
        )}

        <p className="clip-description">{description || 'No description provided.'}</p>
        
        {/* Cast Involved */}
        {displayCast.length > 0 && (
          <div className="clip-cast-list">
            {displayCast.map((cast) => (
              <span key={cast._id} className="clip-cast-pill">
                {cast.name}
              </span>
            ))}
          </div>
        )}

        {/* Clip Controls & Collection Save */}
        <div className="clip-actions flex-between" style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)', gap: '0.5rem' }}>
          <button 
            onClick={() => setIsCollectionModalOpen(true)} 
            className="btn btn-sm flex-center" 
            title="Save to Collection"
            style={{ padding: '0.25rem 0.5rem', minHeight: '32px' }}
          >
            <FolderPlus size={14} style={{ marginRight: '0.25rem' }} />
            <span>Save</span>
          </button>

          <div className="flex-center" style={{ gap: '0.5rem' }}>
            {canManage && onEdit && (
              <button onClick={() => onEdit(clip)} className="btn btn-sm" title="Edit Clip">
                <Edit size={14} />
              </button>
            )}
            {canManage && onDelete && (
              <button onClick={() => onDelete(_id)} className="btn btn-danger btn-sm" title="Delete Clip">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal Player Overlay (Portaled to body to prevent card transform/overflow clipping glitches) */}
      {isPlaying && createPortal(
        <div className="video-player-backdrop flex-center" onClick={() => setIsPlaying(false)}>
          <div className="video-player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="video-modal-header flex-between">
              <span className="video-modal-title">{title}</span>
              <button onClick={() => setIsPlaying(false)} className="video-close-btn flex-center">
                &times;
              </button>
            </div>
            <div className="video-iframe-wrapper">
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                  title={title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="video-iframe"
                />
              ) : (
                <div className="unsupported-video flex-center">
                  <span>
                    Cannot play video inline. Open link directly:{' '}
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {url}
                    </a>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <AddToCollectionModal 
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        entityType="clip"
        entityId={_id}
      />

      <style>{`
        .clip-card {
          height: 100%;
        }
        .clip-thumbnail-container {
          cursor: pointer;
          position: relative;
        }
        .clip-play-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.3);
          transition: background-color var(--transition-speed);
        }
        .clip-thumbnail-container:hover .clip-play-overlay {
          background-color: rgba(0, 0, 0, 0.5);
        }
        .play-icon-circle {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background-color: var(--accent-color);
          color: #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          transform: scale(0.9);
          transition: transform var(--transition-speed);
        }
        .clip-thumbnail-container:hover .play-icon-circle {
          transform: scale(1);
        }
        .clip-type-badge {
          position: absolute;
          bottom: 0.5rem;
          left: 0.5rem;
          padding: 0.2rem 0.5rem;
          background-color: rgba(0, 0, 0, 0.85);
          color: #ffffff;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }
        .clip-movie-title {
          font-size: 0.813rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }
        .clip-movie-title span {
          color: var(--text-primary);
          font-weight: 500;
        }
        .clip-description {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .clip-cast-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          margin-top: auto;
        }
        .clip-cast-pill {
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-secondary);
        }
        .clip-actions {
          margin-top: 1rem;
          gap: 0.5rem;
          justify-content: flex-end;
          padding-top: 0.5rem;
          border-top: 1px dashed var(--border-color);
        }
        .btn-sm {
          min-height: 32px;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }

        /* Video Player Modal overlay */
        .video-player-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0,0,0,0.85);
          z-index: 1000;
          padding: 1.5rem;
        }
        .video-player-modal {
          width: 100%;
          max-width: 800px;
          background-color: #000000;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          overflow: hidden;
          box-shadow: var(--shadow-md);
        }
        .video-modal-header {
          padding: 0.75rem 1.25rem;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          color: #ffffff;
        }
        .video-modal-title {
          font-weight: 600;
          font-size: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .video-close-btn {
          background: none;
          border: none;
          color: #ffffff;
          font-size: 1.5rem;
          cursor: pointer;
          width: 32px;
          height: 32px;
        }
        .video-iframe-wrapper {
          position: relative;
          width: 100%;
          padding-top: 56.25%; /* 16:9 Aspect Ratio */
        }
        .video-iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .unsupported-video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          padding: 1rem;
        }
      `}</style>
    </div>
  );
};

export default ClipCard;
