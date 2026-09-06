import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Play, Trash2, Edit, FolderPlus, Maximize, AlertCircle, RotateCcw, Film, User as UserIcon } from 'lucide-react';
import AddToCollectionModal from './AddToCollectionModal';
import FavouriteButton from './FavouriteButton';
import api, { getProxiedImageUrl, getBaseURL } from '../services/api';

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
  const [thumbError, setThumbError] = useState(false);

  const videoRef = useRef(null);
  const hasRetriedRef = useRef(false);

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

  const handleVideoError = async () => {
    if (!hasRetriedRef.current) {
      hasRetriedRef.current = true;
      console.log(`ClipCard: Video onError fired for "${title}". Attempting auto presigned URL refresh...`);
      setIsRefreshingUrl(true);
      try {
        const res = await api.get(`/clips/${_id}`);
        if (res.data && res.data.url) {
          setActiveUrl(res.data.url);
          setVideoError(false);
          setIsRefreshingUrl(false);
          return;
        }
      } catch (err) {
        console.error('Failed to auto-refresh clip URL:', err.message);
      } finally {
        setIsRefreshingUrl(false);
      }
    }
    setVideoError(true);
  };

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
    if (videoUrl.startsWith('b2://')) return false;
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
      el.webkitEnterFullscreen();
    } else if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  };

  const addedById = addedBy?._id?.toString() || addedBy?.toString();
  const canManage = addedById === currentUserId?.toString() || isAdmin;

  const handleOpenPlayModal = () => {
    setVideoError(false);
    hasRetriedRef.current = false;
    setIsPlaying(true);
  };

  const getStreamUrl = () => {
    if (clip.isB2 && _id) {
      const apiBase = (api.defaults && api.defaults.baseURL) ? api.defaults.baseURL : getBaseURL();
      return `${apiBase}/clips/${_id}/stream`;
    }
    return activeUrl;
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
        
        {/* Source Badges */}
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
          <div className="clip-movie-title">
            <span>Movie:</span>{' '}
            <Link to={`/movies/${displayMovie._id}`} style={{ color: 'var(--accent-color)', fontWeight: 500 }}>
              {displayMovie.title}
            </Link>
          </div>
        )}

        <p className="clip-description">{description || 'No description provided.'}</p>
        
        {/* Cast Involved */}
        {displayCast.length > 0 && (
          <div className="clip-cast-list">
            {displayCast.slice(0, 4).map((cast) => (
              <Link key={cast._id} to={`/cast/${cast._id}`} className="clip-cast-pill flex-center">
                <UserIcon size={10} style={{ marginRight: '0.2rem' }} />
                <span>{cast.name}</span>
              </Link>
            ))}
            {displayCast.length > 4 && (
              <span className="clip-cast-pill">+{displayCast.length - 4}</span>
            )}
          </div>
        )}

        {/* Clip Controls & Collection Save */}
        <div className="clip-actions flex-between">
          <div className="flex-center" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setIsCollectionModalOpen(true)} 
              className="btn btn-sm flex-center" 
              title="Save to Collection"
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

          <div className="flex-center" style={{ gap: '0.35rem' }}>
            {canManage && onEdit && (
              <button onClick={() => onEdit(clip)} className="btn btn-sm btn-icon" title="Edit Clip">
                <Edit size={14} />
              </button>
            )}
            {canManage && onDelete && (
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="btn btn-danger btn-sm btn-icon" 
                title="Delete Clip"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video Player Modal Popup (Portaled to body) */}
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
                !videoError ? (
                  <video
                    ref={videoRef}
                    src={getStreamUrl()}
                    controls
                    autoPlay
                    playsInline
                    webkit-playsinline="true"
                    preload="auto"
                    onError={handleVideoError}
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
                          Open Direct Link
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
                style={{ flex: 1, minHeight: '38px' }}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                style={{ flex: 1, minHeight: '38px' }}
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
        }
        .clip-card .card-content {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          padding: 1rem;
        }
        .clip-thumbnail-container {
          cursor: pointer;
          position: relative;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          background-color: var(--bg-tertiary);
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
        .clip-card .card-title {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
          margin-bottom: 0.75rem;
        }
        .clip-cast-pill {
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-secondary);
          text-decoration: none;
        }
        .clip-actions {
          margin-top: 1rem;
          gap: 0.5rem;
          justify-content: space-between;
          padding-top: 0.5rem;
          border-top: 1px dashed var(--border-color);
          align-items: center;
        }
        .clip-card .card-content > .clip-actions:last-child {
          margin-top: auto;
        }

        /* Source indicator badges */
        .clip-source-badge {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #ffffff;
          z-index: 3;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        .gdrive-source-badge { background: #137333; }
        .b2-source-badge { background: #2563eb; }
        .youtube-source-badge { background: #dc2626; }
        .instagram-source-badge { background: #cc2366; }

        /* Video Player Modal overlay */
        .video-player-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100dvh;
          background-color: rgba(0,0,0,0.85);
          z-index: 10000;
          padding: 1rem;
        }
        .video-player-modal {
          width: 100%;
          max-width: 840px;
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
        .video-close-btn, .video-header-btn {
          background: none;
          border: none;
          color: #ffffff;
          font-size: 1.5rem;
          cursor: pointer;
          width: 36px;
          height: 36px;
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

        /* Instagram & Mobile Responsiveness */
        .instagram-modal {
          max-width: 440px !important;
        }
        .instagram-modal .video-iframe-wrapper {
          padding-top: 125% !important;
        }

        @media (max-width: 640px) {
          .video-player-backdrop {
            padding: 0.5rem;
          }
          .video-player-modal {
            max-width: 100% !important;
          }
          .clip-card .card-content {
            padding: 0.6rem;
          }
          .clip-description {
            font-size: 0.75rem;
            margin-bottom: 0.5rem;
            -webkit-line-clamp: 2;
          }
          .play-icon-circle {
            width: 38px;
            height: 38px;
          }
          .play-icon-circle svg {
            width: 16px;
            height: 16px;
          }
          .clip-source-badge {
            top: 0.35rem;
            right: 0.35rem;
            font-size: 0.55rem;
            padding: 0.1rem 0.35rem;
          }
          .clip-type-badge {
            bottom: 0.35rem;
            left: 0.35rem;
            font-size: 0.65rem;
            padding: 0.15rem 0.35rem;
          }
          .clip-actions {
            margin-top: 0.5rem;
            padding-top: 0.35rem;
            gap: 0.25rem;
          }
          .clip-actions .btn {
            min-height: 30px;
            font-size: 0.7rem;
            padding: 0.2rem 0.4rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ClipCard;
