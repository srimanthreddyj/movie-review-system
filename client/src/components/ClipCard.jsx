import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Play, Trash2, Edit, FolderPlus, Maximize, AlertCircle, RotateCcw, Film, User as UserIcon } from 'lucide-react';
import AddToCollectionModal from './AddToCollectionModal';
import FavouriteButton from './FavouriteButton';
import api, { getProxiedImageUrl } from '../services/api';

const ClipCard = ({ clip, onDelete, onEdit, userFavourites = [], onFavouriteUpdate, currentUserId, isAdmin }) => {
  const { _id, title, url, description, clipType, thumbnailUrl, addedBy, movieId, castInvolved = [], movieInfo, castInvolvedDetails } = clip;
  
  const displayMovie = movieInfo || (movieId && typeof movieId === 'object' ? movieId : null);
  const displayCast = castInvolvedDetails || castInvolved || [];
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [activeUrl, setActiveUrl] = useState(url);
  const [isRefreshingUrl, setIsRefreshingUrl] = useState(false);

  useEffect(() => {
    setActiveUrl(url);
    setVideoError(false);
  }, [url]);

  const handleRefreshVideoUrl = async () => {
    setIsRefreshingUrl(true);
    try {
      const res = await api.get(`/clips/${_id}`);
      if (res.data && res.data.url) {
        setActiveUrl(res.data.url);
        setVideoError(false);
      }
    } catch (err) {
      console.error('Failed to refresh clip video URL:', err);
    } finally {
      setIsRefreshingUrl(false);
    }
  };

  const videoRef = useRef(null);

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

  // Query-agnostic check if URL points to an MP4 / direct video file
  const isMp4OrDirectVideoUrl = (videoUrl) => {
    if (!videoUrl) return false;
    if (videoUrl.startsWith('b2://')) return false; // Presigned URL has not been generated yet
    try {
      const cleanUrl = videoUrl.split('?')[0].split('#')[0].toLowerCase();
      const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.ogv', '.m3u8'];
      if (videoExtensions.some(ext => cleanUrl.endsWith(ext))) return true;
      if (cleanUrl.includes('/clips/') || cleanUrl.includes('video')) return true;
    } catch (e) {
      // fallback
    }
    return false;
  };

  const [thumbError, setThumbError] = useState(false);

  const videoId = getYouTubeId(activeUrl);
  const instagramShortcode = getInstagramShortcode(activeUrl);
  const googleDriveId = getGoogleDriveId(activeUrl);
  const isDirectVideo = clip.isB2 || isMp4OrDirectVideoUrl(activeUrl);

  let isInstagram = Boolean(instagramShortcode);
  let isGoogleDrive = Boolean(googleDriveId);

  // Determine primary thumbnail candidates
  let primaryThumb = null;
  if (thumbnailUrl && thumbnailUrl.trim()) {
    primaryThumb = thumbnailUrl.trim();
  } else if (videoId) {
    primaryThumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  } else if (googleDriveId) {
    primaryThumb = `https://drive.google.com/thumbnail?id=${googleDriveId}&sz=w800`;
  }

  // Fallback thumbnails from attached movie or cast metadata
  const movieBackdrop = displayMovie?.bannerUrl || displayMovie?.posterUrl;
  const castPhoto = displayCast && displayCast[0]?.photoUrl;
  const cinemaFallback = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';

  const rawThumb = (!thumbError && primaryThumb) 
    ? primaryThumb 
    : (movieBackdrop || castPhoto || cinemaFallback);

  const finalThumbnail = getProxiedImageUrl(rawThumb);

  // Handle Fullscreen request cross-platform (specifically iOS Safari webkitEnterFullscreen for iPhone)
  const handleFullscreen = () => {
    if (!videoRef.current) return;
    const el = videoRef.current;
    if (el.webkitEnterFullscreen) {
      // iOS / iPhone Safari native fullscreen
      el.webkitEnterFullscreen();
    } else if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  };

  // addedBy can be a populated object { _id, name } or a plain ID string
  const addedById = addedBy?._id?.toString() || addedBy?.toString();
  const canManage = addedById === currentUserId?.toString() || isAdmin;

  const handleOpenPlayModal = () => {
    setVideoError(false);
    setIsPlaying(true);
  };

  return (
    <div className="card clip-card">
      <div className="clip-thumbnail-container" onClick={handleOpenPlayModal}>
        <img 
          src={finalThumbnail} 
          alt={title} 
          className="clip-thumbnail" 
          onError={() => setThumbError(true)} 
        />
        
        {/* Subtle source indicator badges */}
        {isInstagram && <span className="clip-source-badge instagram-source-badge">Instagram</span>}
        {isGoogleDrive && <span className="clip-source-badge gdrive-source-badge">Google Drive</span>}
        {clip.isB2 && <span className="clip-source-badge b2-source-badge">Hosted</span>}
        {videoId && <span className="clip-source-badge youtube-source-badge">YouTube</span>}

        <div className="clip-play-overlay flex-center">
          <div className="play-icon-circle flex-center">
            <Play size={22} fill="#ffffff" stroke="none" style={{ marginLeft: '2px' }} />
          </div>
        </div>
        
        {clipType && (
          <span className="clip-type-badge">{clipType}</span>
        )}
      </div>

      <div className="card-content">
        <h3 className="card-title" title={title}>{title}</h3>
        
        {displayMovie && (
          <div className="clip-movie-badge-wrapper">
            <Link to={`/movies/${displayMovie._id}`} className="clip-movie-pill flex-center">
              <Film size={12} style={{ marginRight: '0.35rem', flexShrink: 0 }} />
              <span className="clip-movie-pill-title">{displayMovie.title}</span>
            </Link>
          </div>
        )}

        <p className="clip-description">{description || 'No description provided.'}</p>
        
        {/* Cast Involved */}
        {displayCast.length > 0 && (
          <div className="clip-cast-list">
            {displayCast.slice(0, 3).map((cast) => (
              <Link key={cast._id} to={`/cast/${cast._id}`} className="clip-cast-pill flex-center">
                <UserIcon size={10} style={{ marginRight: '0.25rem' }} />
                <span>{cast.name}</span>
              </Link>
            ))}
            {displayCast.length > 3 && (
              <span className="clip-cast-more">+{displayCast.length - 3}</span>
            )}
          </div>
        )}

        {/* Clip Controls & Collection Save */}
        <div className="clip-actions flex-between">
          <div className="flex-center" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setIsCollectionModalOpen(true)} 
              className="btn btn-sm clip-btn-action flex-center" 
              title="Save to Collection"
            >
              <FolderPlus size={15} style={{ marginRight: '0.35rem' }} />
              <span>Save</span>
            </button>

            <FavouriteButton 
              entityType="clips" 
              entityId={_id} 
              favouritesList={userFavourites} 
              onUpdate={onFavouriteUpdate} 
            />
          </div>

          <div className="flex-center" style={{ gap: '0.375rem' }}>
            {canManage && onEdit && (
              <button onClick={() => onEdit(clip)} className="btn btn-sm clip-btn-icon" title="Edit Clip">
                <Edit size={15} />
              </button>
            )}
            {canManage && onDelete && (
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="btn btn-danger btn-sm clip-btn-icon" 
                title="Delete Clip"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal Player Overlay */}
      {isPlaying && createPortal(
        <div className="video-player-backdrop flex-center" onClick={() => setIsPlaying(false)}>
          <div className={`video-player-modal ${instagramShortcode ? 'instagram-modal' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="video-modal-header flex-between">
              <span className="video-modal-title">{title}</span>
              <div className="flex-center" style={{ gap: '0.5rem' }}>
                {isDirectVideo && !videoError && (
                  <button 
                    type="button"
                    onClick={handleFullscreen} 
                    className="video-header-btn flex-center"
                    title="Toggle Fullscreen"
                  >
                    <Maximize size={18} />
                  </button>
                )}
                <button onClick={() => setIsPlaying(false)} className="video-close-btn flex-center">
                  &times;
                </button>
              </div>
            </div>
            <div className="video-iframe-wrapper">
              {isDirectVideo ? (
                activeUrl && !activeUrl.startsWith('b2://') && !videoError ? (
                  <video
                    ref={videoRef}
                    src={activeUrl}
                    controls
                    autoPlay
                    playsInline
                    webkit-playsinline="true"
                    preload="auto"
                    onError={() => setVideoError(true)}
                    className="video-iframe"
                    style={{ backgroundColor: '#000' }}
                  />
                ) : (
                  <div className="unsupported-video flex-center" style={{ flexDirection: 'column', gap: '0.75rem', textAlign: 'center' }}>
                    <AlertCircle size={32} style={{ color: 'var(--error-color, #ef4444)' }} />
                    <span>Video link has expired or failed to load.</span>
                    <div className="flex-center" style={{ gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      <button 
                        onClick={handleRefreshVideoUrl} 
                        disabled={isRefreshingUrl} 
                        className="btn btn-sm btn-secondary flex-center"
                        style={{ gap: '0.25rem' }}
                      >
                        <RotateCcw size={14} className={isRefreshingUrl ? 'spin' : ''} />
                        <span>{isRefreshingUrl ? 'Refreshing...' : 'Refresh Link'}</span>
                      </button>
                      {activeUrl && !activeUrl.startsWith('b2://') && (
                        <a href={activeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                          Open Direct Video Link
                        </a>
                      )}
                    </div>
                  </div>
                )
              ) : videoId ? (
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
                <div className="unsupported-video flex-center" style={{ flexDirection: 'column', gap: '0.75rem', textAlign: 'center' }}>
                  <span>Cannot play video inline. Open link directly:</span>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                    {url}
                  </a>
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
      {showDeleteConfirm && createPortal(
        <div className="dialog-backdrop flex-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="dialog-box text-center animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-icon-wrapper flex-center" style={{ backgroundColor: 'rgba(220, 38, 38, 0.12)' }}>
              <Trash2 size={30} style={{ color: 'var(--error-color)' }} />
            </div>
            <h3 className="dialog-title">Delete Video Clip?</h3>
            <p className="dialog-message">
              Are you sure you want to delete this clip? This action cannot be undone.
            </p>
            <div className="flex-center" style={{ gap: '0.75rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, minHeight: '40px' }}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                style={{ flex: 1, minHeight: '40px' }}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete(_id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <style>{`
        .clip-card {
          height: 100%;
          display: flex;
          flex-direction: column;
          border-radius: var(--border-radius, 12px);
          overflow: hidden;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s;
        }
        .clip-card:hover {
          transform: translateY(-4px);
          border-color: var(--accent-color);
          box-shadow: 0 12px 28px -6px rgba(0, 0, 0, 0.4);
        }
        .clip-thumbnail-container {
          cursor: pointer;
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          background-color: #0d0d11;
        }
        .clip-thumbnail {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }
        .clip-thumbnail-container:hover .clip-thumbnail {
          transform: scale(1.06);
        }
        .clip-play-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%);
          transition: background-color 0.2s ease;
          z-index: 2;
        }
        .clip-thumbnail-container:hover .clip-play-overlay {
          background: radial-gradient(circle at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.75) 100%);
        }
        .play-icon-circle {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.92) 0%, rgba(147, 51, 234, 0.92) 100%);
          color: #ffffff;
          box-shadow: 0 4px 20px rgba(79, 70, 229, 0.5);
          transform: scale(0.92);
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
          backdrop-filter: blur(4px);
        }
        .clip-thumbnail-container:hover .play-icon-circle {
          transform: scale(1.08);
          box-shadow: 0 6px 24px rgba(147, 51, 234, 0.7);
        }
        .clip-type-badge {
          position: absolute;
          bottom: 0.6rem;
          left: 0.6rem;
          padding: 0.2rem 0.55rem;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          z-index: 3;
        }
        .clip-card .card-content {
          padding: 1.1rem;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }
        .clip-card .card-title {
          font-size: 1.05rem;
          font-weight: 600;
          line-height: 1.35;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .clip-movie-badge-wrapper {
          margin-bottom: 0.6rem;
        }
        .clip-movie-pill {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.6rem;
          background: var(--accent-light, rgba(99, 102, 241, 0.12));
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 6px;
          color: var(--accent-color);
          font-size: 0.78rem;
          font-weight: 600;
          text-decoration: none;
          max-width: 100%;
        }
        .clip-movie-pill:hover {
          background: var(--accent-color);
          color: #ffffff;
        }
        .clip-movie-pill-title {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .clip-description {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.45;
          margin-bottom: 0.75rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .clip-cast-list {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.35rem;
          margin-top: auto;
          margin-bottom: 0.75rem;
        }
        .clip-cast-pill {
          font-size: 0.72rem;
          padding: 0.2rem 0.5rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-secondary);
          text-decoration: none;
          transition: background-color 0.2s, color 0.2s;
        }
        .clip-cast-pill:hover {
          background: var(--border-color);
          color: var(--text-primary);
        }
        .clip-cast-more {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          padding: 0.1rem 0.3rem;
        }
        .clip-actions {
          margin-top: auto;
          padding-top: 0.75rem;
          border-top: 1px dashed var(--border-color);
          gap: 0.5rem;
          align-items: center;
        }
        .clip-btn-action {
          min-height: 36px;
          padding: 0.35rem 0.65rem;
          font-size: 0.8rem;
          font-weight: 500;
          border-radius: 6px;
        }
        .clip-btn-icon {
          min-height: 36px;
          width: 36px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }

        /* Source indicator badges */
        .clip-source-badge {
          position: absolute;
          top: 0.6rem;
          right: 0.6rem;
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #ffffff;
          z-index: 3;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          backdrop-filter: blur(6px);
        }
        .gdrive-source-badge {
          background: linear-gradient(135deg, #137333 0%, #1a73e8 100%);
        }
        .b2-source-badge {
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
        }
        .youtube-source-badge {
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
        }
        .instagram-source-badge {
          background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
        }

        /* Responsive Mobile First Adjustments */
        @media (max-width: 640px) {
          .clip-card .card-content {
            padding: 0.9rem;
          }
          .clip-card .card-title {
            font-size: 0.95rem;
          }
          .clip-btn-action {
            min-height: 40px;
            padding: 0.4rem 0.75rem;
            font-size: 0.82rem;
          }
          .clip-btn-icon {
            min-height: 40px;
            width: 40px;
          }
          .play-icon-circle {
            width: 46px;
            height: 46px;
          }
          .video-player-backdrop {
            padding: 0.5rem;
          }
          .video-player-modal {
            max-width: 100%;
            border-radius: 8px;
          }
          .video-header-btn, .video-close-btn {
            width: 40px;
            height: 40px;
          }
        }
      `}</style>
    </div>
  );
};

export default ClipCard;
