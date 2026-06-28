import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Play, Calendar, Tag, Trash2, Edit, FolderPlus } from 'lucide-react';
import AddToCollectionModal from './AddToCollectionModal';
import FavouriteButton from './FavouriteButton';

const ClipCard = ({ clip, onDelete, onEdit, userFavourites = [], onFavouriteUpdate, currentUserId, isAdmin }) => {
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

  // Extract Instagram shortcode from URL if applicable
  const getInstagramShortcode = (videoUrl) => {
    if (!videoUrl) return null;
    const regExp = /instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/;
    const match = videoUrl.match(regExp);
    return match ? match[1] : null;
  };

  // Extract Google Drive file ID from URL if applicable
  const getGoogleDriveId = (videoUrl) => {
    if (!videoUrl) return null;
    const regExp1 = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const regExp2 = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
    
    const match1 = videoUrl.match(regExp1);
    if (match1) return match1[1];
    
    const match2 = videoUrl.match(regExp2);
    return match2 ? match2[1] : null;
  };

  const videoId = getYouTubeId(url);
  const instagramShortcode = getInstagramShortcode(url);
  const googleDriveId = getGoogleDriveId(url);

  let thumbnailUrl = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
  let isInstagram = false;
  let isGoogleDrive = false;

  if (videoId) {
    thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  } else if (instagramShortcode) {
    isInstagram = true;
  } else if (googleDriveId) {
    isGoogleDrive = true;
  }

  // addedBy can be a populated object { _id, name } or a plain ID string
  const addedById = addedBy?._id?.toString() || addedBy?.toString();
  const canManage = addedById === currentUserId?.toString() || isAdmin;

  return (
    <div className="card clip-card">
      <div className="card-img-container clip-thumbnail-container" onClick={() => setIsPlaying(true)}>
        {isInstagram ? (
          <div className="card-img clip-thumbnail instagram-thumbnail flex-center" style={{
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)',
            color: '#ffffff',
            flexDirection: 'column',
            gap: '0.5rem',
            position: 'absolute',
            top: 0,
            left: 0
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            <span style={{ fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Instagram Video</span>
          </div>
        ) : isGoogleDrive ? (
          <div className="card-img clip-thumbnail gdrive-thumbnail flex-center" style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #137333 0%, #1a73e8 50%, #f9ab00 100%)',
            color: '#ffffff',
            flexDirection: 'column',
            gap: '0.5rem',
            position: 'absolute',
            top: 0,
            left: 0
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.89-1.74-3.5-4-3.5-3.04 0-5.5 2-5.5 5 0 .28.02.56.06.83A3.5 3.5 0 0 0 3 16.5c0 1.93 1.57 3.5 3.5 3.5Z"/></svg>
            <span style={{ fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Google Drive Video</span>
          </div>
        ) : (
          <img src={thumbnailUrl} alt={title} className="card-img clip-thumbnail" />
        )}
        <div className="clip-play-overlay flex-center">
          <div className="play-icon-circle flex-center">
            <Play size={20} fill="#ffffff" stroke="none" />
          </div>
        </div>
        
        {clipType && (
          <span className="clip-type-badge text-capitalize" style={{ zIndex: 3 }}>{clipType}</span>
        )}
      </div>

      <div className="card-content">
        <h3 className="card-title" title={title}>{title}</h3>
        {displayMovie && (
          <p className="clip-movie-title">
            From: <Link to={`/movies/${displayMovie._id}`} style={{ textDecoration: 'underline', color: 'var(--accent-color)', fontWeight: '500' }}>{displayMovie.title}</Link>
          </p>
        )}

        <p className="clip-description">{description || 'No description provided.'}</p>
        
        {/* Cast Involved */}
        {displayCast.length > 0 && (
          <div className="clip-cast-list">
            {displayCast.map((cast) => (
              <Link key={cast._id} to={`/cast/${cast._id}`} className="clip-cast-pill" style={{ display: 'inline-block', textDecoration: 'none' }}>
                {cast.name}
              </Link>
            ))}
          </div>
        )}

        {/* Clip Controls & Collection Save */}
        <div className="clip-actions flex-between" style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)', gap: '0.5rem', alignItems: 'center' }}>
          <div className="flex-center" style={{ gap: '0.5rem', justifyContent: 'flex-start' }}>
            <button 
              onClick={() => setIsCollectionModalOpen(true)} 
              className="btn btn-sm flex-center" 
              title="Save to Collection"
              style={{ padding: '0.25rem 0.5rem', minHeight: '32px' }}
            >
              <FolderPlus size={14} style={{ marginRight: '0.25rem' }} />
              <span>Save</span>
            </button>

            <FavouriteButton 
              entityType="clips" 
              entityId={_id} 
              favouritesList={userFavourites} 
              onUpdate={onFavouriteUpdate} 
            />
          </div>

          <div className="flex-center" style={{ gap: '0.5rem' }}>
            {canManage && onEdit && (
              <button onClick={() => onEdit(clip)} className="btn btn-sm" title="Edit Clip">
                <Edit size={14} />
              </button>
            )}
            {canManage && onDelete && (
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this video clip?')) {
                    onDelete(_id);
                  }
                }} 
                className="btn btn-danger btn-sm" 
                title="Delete Clip"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal Player Overlay (Portaled to body to prevent card transform/overflow clipping glitches) */}
      {isPlaying && createPortal(
        <div className="video-player-backdrop flex-center" onClick={() => setIsPlaying(false)}>
          <div className={`video-player-modal ${instagramShortcode ? 'instagram-modal' : ''}`} onClick={(e) => e.stopPropagation()}>
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
              ) : instagramShortcode ? (
                <iframe
                  src={`https://www.instagram.com/p/${instagramShortcode}/embed`}
                  title={title}
                  frameBorder="0"
                  allowFullScreen
                  className="video-iframe"
                  style={{ border: 'none', overflow: 'hidden' }}
                />
              ) : googleDriveId ? (
                <iframe
                  src={`https://drive.google.com/file/d/${googleDriveId}/preview`}
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

      {isCollectionModalOpen && createPortal(
        <AddToCollectionModal 
          isOpen={isCollectionModalOpen}
          onClose={() => setIsCollectionModalOpen(false)}
          entityType="clip"
          entityId={_id}
        />,
        document.body
      )}

      <style>{`
        .clip-card {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .clip-card .card-content {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }
        .clip-thumbnail-container {
          cursor: pointer;
          position: relative;
          aspect-ratio: 16/9;
          overflow: hidden;
        }
        .clip-thumbnail {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform var(--transition-speed);
        }
        .clip-thumbnail-container:hover .clip-thumbnail {
          transform: scale(1.03);
        }
        .clip-play-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.3);
          transition: background-color var(--transition-speed);
          z-index: 2;
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
          z-index: 3;
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
          -webkit-line-clamp: 3;
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
          justify-content: flex-between;
          padding-top: 0.5rem;
          border-top: 1px dashed var(--border-color);
          align-items: center;
        }
        .clip-card .card-content > .clip-actions:last-child {
          margin-top: auto;
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

        .clip-card .fav-btn {
          min-height: 32px !important;
          height: 32px !important;
          font-size: 0.75rem !important;
          padding: 0.25rem 0.5rem !important;
        }
        .clip-card .fav-active-btn-group {
          border-radius: var(--border-radius);
          overflow: hidden;
        }
        .clip-card .fav-active-btn-group .btn {
          min-height: 32px !important;
          height: 32px !important;
          font-size: 0.75rem !important;
        }
        .clip-card .fav-dropdown-menu {
          bottom: 100%;
          top: auto;
          margin-top: 0;
          margin-bottom: 0.25rem;
        }
        
        /* Instagram Specific Styles */
        .instagram-thumbnail {
          display: flex !important;
          align-items: center;
          justify-content: center;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .instagram-modal {
          max-width: 440px !important;
        }
        .instagram-modal .video-iframe-wrapper {
          padding-top: 125% !important;
        }
        /* Google Drive Specific Styles */
        .gdrive-thumbnail {
          display: flex !important;
          align-items: center;
          justify-content: center;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
};

export default ClipCard;
