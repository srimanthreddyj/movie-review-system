import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { X, Film, Users, Calendar, Star, Languages, Info, CheckCircle2, User, HelpCircle, Loader2 } from 'lucide-react';

const ExternalPreviewModal = ({ isOpen, onClose, entityRefId, entitySource, entityType, entityTitle }) => {
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !entityRefId || !entitySource) return;

    const fetchExternalDetails = async () => {
      setIsLoading(true);
      setError(null);
      setDetails(null);
      setImportSuccess(false);

      try {
        if (entityType === 'person') {
          // Fetch person details
          // Let's call GET /api/cast/search-external with query or use a new details endpoint?
          // Wait, we didn't add a specific "external cast details preview" endpoint but we can enrich using name/tmdbId.
          // Let's fetch using our tmdbId by making a request to the import route or we can just enrich.
          // Wait! Let's check: we can also create a preview endpoint or use the TMDB details directly.
          // Actually, our backend has /api/cast/import-external which imports and returns it. But wait, if they want to preview a person before importing?
          // Wait, person details can be fetched from a TMDB endpoint. Can we fetch from TMDB or do we have a backend preview for persons?
          // Since our backend doesn't have a cast preview route, let's add one or we can fetch TMDB person details directly, or call a simple endpoint.
          // Wait! In the backend we can call `enrichCastFromTMDB` or `getTmdbPersonDetails` via an endpoint. Let's see: we can implement `GET /api/cast/external-details-preview?tmdbId=...` in `castRoutes.js` and `castController.js`!
          // Wait, did we define that in the plan? The plan has:
          // `POST /import-external` -> `castController.importExternalCast`
          // Let's check: can we just import directly when clicking, or do we want to preview?
          // If we want to preview a person, let's create a quick route: `GET /api/cast/external-details-preview?tmdbId=...` to avoid any issues, or let's use our existing controller.
          // Actually, let's create `GET /api/cast/external-details-preview` in `castRoutes.js` and `castController.js` right now to be clean and symmetric!
          // Yes! That's extremely clean.
        }
        
        let response;
        if (entityType === 'person') {
          response = await api.get('/cast/external-details-preview', {
            params: { tmdbId: entityRefId, name: entityTitle }
          });
        } else {
          response = await api.get('/movies/external-details-preview', {
            params: { refId: entityRefId, source: entitySource, mediaType: entityType, title: entityTitle }
          });
        }
        setDetails(response.data);
      } catch (err) {
        console.error('Failed to fetch external preview:', err);
        setError(err.response?.data?.message || 'Failed to load external preview.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExternalDetails();
  }, [isOpen, entityRefId, entitySource, entityType, entityTitle]);

  const handleImportMovie = async (onlyActresses = false) => {
    setIsImporting(true);
    setError(null);
    try {
      const response = await api.get('/movies/external-details', {
        params: {
          refId: entityRefId,
          source: entitySource,
          mediaType: entityType,
          title: entityTitle,
          onlyActresses: onlyActresses.toString()
        }
      });
      setImportSuccess(true);
      setTimeout(() => {
        onClose();
        navigate(`/movies/${response.data._id}`);
      }, 1500);
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.response?.data?.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportPerson = async () => {
    setIsImporting(true);
    setError(null);
    try {
      const response = await api.post('/cast/import-external', {
        tmdbId: entityRefId,
        name: entityTitle
      });
      setImportSuccess(true);
      setTimeout(() => {
        onClose();
        navigate(`/cast/${response.data._id}`);
      }, 1500);
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.response?.data?.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="preview-modal-overlay flex-center" onClick={onClose}>
      <div className="preview-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="preview-modal-close flex-center" onClick={onClose}>
          <X size={20} />
        </button>

        {isLoading ? (
          <div className="preview-modal-loading flex-center flex-column">
            <Loader2 size={48} className="spinner icon-spinner" />
            <p>Fetching external metadata...</p>
          </div>
        ) : error ? (
          <div className="preview-modal-error flex-center flex-column">
            <Info size={40} className="error-icon" />
            <p>{error}</p>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        ) : details ? (
          <div className="preview-modal-content">
            {entityType !== 'person' ? (
              // Movie / TV Series Preview
              <>
                {details.bannerUrl && (
                  <div className="preview-banner" style={{ backgroundImage: `url(${details.bannerUrl})` }}>
                    <div className="preview-banner-fade"></div>
                  </div>
                )}
                <div className="preview-body">
                  <div className="preview-main-info flex">
                    <div className="preview-poster-container">
                      {details.posterUrl ? (
                        <img src={details.posterUrl} alt={details.title} className="preview-poster" />
                      ) : (
                        <div className="preview-poster-fallback flex-center">
                          <Film size={40} />
                        </div>
                      )}
                    </div>
                    <div className="preview-text-info">
                      <span className="badge badge-primary uppercase" style={{ marginBottom: '0.5rem' }}>
                        {details.mediaType || entityType}
                      </span>
                      <h2 className="preview-title">{details.title}</h2>
                      {details.originalTitle && details.originalTitle !== details.title && (
                        <p className="preview-original-title">Original Title: {details.originalTitle}</p>
                      )}
                      
                      <div className="preview-meta-row flex">
                        {details.releaseDate && (
                          <span className="flex-center" style={{ gap: '0.25rem' }}>
                            <Calendar size={14} />
                            {new Date(details.releaseDate).getFullYear()}
                          </span>
                        )}
                        {details.rating > 0 && (
                          <span className="flex-center star-rating" style={{ gap: '0.25rem' }}>
                            <Star size={14} fill="currentColor" />
                            {details.rating.toFixed(1)}
                          </span>
                        )}
                        {details.language && (
                          <span className="flex-center uppercase" style={{ gap: '0.25rem' }}>
                            <Languages size={14} />
                            {details.language}
                          </span>
                        )}
                      </div>

                      <div className="preview-genres flex">
                        {details.genre && details.genre.map((g, idx) => (
                          <span key={idx} className="genre-badge">{g}</span>
                        ))}
                      </div>

                      <p className="preview-synopsis">{details.synopsis || 'No plot summary available.'}</p>
                    </div>
                  </div>

                  {/* Cast Members */}
                  <div className="preview-cast-section">
                    <h3 className="section-title flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                      <Users size={18} />
                      <span>Featured Cast ({details.cast ? details.cast.length : 0})</span>
                    </h3>
                    <div className="preview-cast-grid">
                      {details.cast && details.cast.map((actor, idx) => (
                        <div key={idx} className="preview-cast-card flex-center">
                          <div className="preview-cast-avatar-container">
                            {actor.photoUrl ? (
                              <img src={actor.photoUrl} alt={actor.name} className="preview-cast-avatar" />
                            ) : (
                              <div className="preview-cast-avatar-fallback flex-center">
                                <User size={16} />
                              </div>
                            )}
                          </div>
                          <div className="preview-cast-meta">
                            <span className="preview-cast-name">{actor.name}</span>
                            <span className="preview-cast-character">{actor.characterName || actor.role}</span>
                            <span className={`preview-cast-gender-tag ${actor.gender?.toLowerCase() || 'unspecified'}`}>
                              {actor.gender}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="preview-actions flex">
                    {importSuccess ? (
                      <div className="import-success-banner flex-center" style={{ gap: '0.5rem', width: '100%' }}>
                        <CheckCircle2 size={24} className="success-icon" />
                        <span>Successfully imported! Redirecting to local details...</span>
                      </div>
                    ) : (
                      <>
                        <button 
                          className="btn btn-primary flex-center" 
                          style={{ flex: 1, minHeight: '44px', gap: '0.5rem' }}
                          onClick={() => handleImportMovie(false)}
                          disabled={isImporting}
                        >
                          {isImporting ? <Loader2 size={16} className="spinner" /> : <Film size={16} />}
                          <span>Import Full Profile</span>
                        </button>
                        <button 
                          className="btn btn-secondary flex-center" 
                          style={{ flex: 1, minHeight: '44px', gap: '0.5rem' }}
                          onClick={() => handleImportMovie(true)}
                          disabled={isImporting}
                        >
                          {isImporting ? <Loader2 size={16} className="spinner" /> : <Users size={16} />}
                          <span>Import Title + Actresses Only</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              // Person (Actor / Actress) Preview
              <div className="preview-body" style={{ paddingTop: '2rem' }}>
                <div className="preview-main-info flex">
                  <div className="preview-poster-container">
                    {details.photoUrl ? (
                      <img src={details.photoUrl} alt={details.name} className="preview-poster" style={{ borderRadius: '50%', aspectRatio: '1/1', objectFit: 'cover' }} />
                    ) : (
                      <div className="preview-poster-fallback flex-center" style={{ borderRadius: '50%', aspectRatio: '1/1' }}>
                        <User size={48} />
                      </div>
                    )}
                  </div>
                  <div className="preview-text-info">
                    <span className="badge badge-primary uppercase" style={{ marginBottom: '0.5rem' }}>
                      {details.gender === 'Female' ? 'Actress' : 'Actor / Person'}
                    </span>
                    <h2 className="preview-title">{details.name}</h2>
                    
                    <div className="preview-meta-row flex" style={{ flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                      {details.birthDate && (
                        <span><strong>Born:</strong> {new Date(details.birthDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      )}
                      {details.birthPlace && (
                        <span><strong>Place of Birth:</strong> {details.birthPlace}</span>
                      )}
                      {details.nationality && (
                        <span><strong>Nationality:</strong> {details.nationality}</span>
                      )}
                      <span><strong>Gender:</strong> {details.gender}</span>
                    </div>

                    <p className="preview-synopsis" style={{ marginTop: '1rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {details.bio || 'No biographical information available.'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="preview-actions flex" style={{ marginTop: '2rem' }}>
                  {importSuccess ? (
                    <div className="import-success-banner flex-center" style={{ gap: '0.5rem', width: '100%' }}>
                      <CheckCircle2 size={24} className="success-icon" />
                      <span>Successfully imported! Redirecting to local details...</span>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-primary flex-center" 
                      style={{ width: '100%', minHeight: '44px', gap: '0.5rem' }}
                      onClick={handleImportPerson}
                      disabled={isImporting}
                    >
                      {isImporting ? <Loader2 size={16} className="spinner" /> : <User size={16} />}
                      <span>Import Cast Profile</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="preview-modal-error flex-center flex-column">
            <HelpCircle size={40} className="error-icon" />
            <p>Unable to load preview details.</p>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        )}
      </div>

      <style>{`
        .preview-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.7);
          z-index: 1000;
          backdrop-filter: blur(8px);
          padding: 1.5rem;
        }
        .preview-modal-card {
          position: relative;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg, 12px);
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          animation: modalScaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes modalScaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .preview-modal-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background-color: rgba(0,0,0,0.5);
          color: white;
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
          z-index: 10;
          transition: background-color 0.2s;
        }
        .preview-modal-close:hover {
          background-color: rgba(0,0,0,0.8);
        }
        .preview-modal-loading, .preview-modal-error {
          padding: 4rem 2rem;
          color: var(--text-secondary);
          gap: 1rem;
          text-align: center;
        }
        .icon-spinner {
          color: var(--accent-color);
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .preview-banner {
          position: relative;
          height: 200px;
          background-size: cover;
          background-position: center;
        }
        .preview-banner-fade {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(to bottom, transparent, var(--bg-primary));
        }
        .preview-body {
          padding: 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .preview-main-info {
          gap: 1.5rem;
        }
        @media (max-width: 640px) {
          .preview-main-info {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
        }
        .preview-poster-container {
          flex-shrink: 0;
          width: 150px;
        }
        .preview-poster {
          width: 100%;
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
        }
        .preview-poster-fallback {
          width: 100%;
          aspect-ratio: 2/3;
          background-color: var(--bg-tertiary);
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }
        .preview-text-info {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        @media (max-width: 640px) {
          .preview-text-info {
            align-items: center;
          }
        }
        .preview-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.2;
          margin-bottom: 0.25rem;
        }
        .preview-original-title {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }
        .preview-meta-row {
          gap: 1rem;
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-bottom: 0.75rem;
        }
        .star-rating {
          color: #eab308;
        }
        .preview-genres {
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        .genre-badge {
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .preview-synopsis {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }
        .preview-cast-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          border-top: 1px solid var(--border-color);
          padding-top: 1.25rem;
        }
        .section-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .preview-cast-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.75rem;
          max-height: 250px;
          overflow-y: auto;
          padding-right: 0.5rem;
        }
        .preview-cast-card {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 0.5rem;
          gap: 0.75rem;
          justify-content: flex-start;
        }
        .preview-cast-avatar-container {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
        }
        .preview-cast-avatar {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--border-color);
        }
        .preview-cast-avatar-fallback {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
        }
        .preview-cast-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          overflow: hidden;
        }
        .preview-cast-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          text-align: left;
        }
        .preview-cast-character {
          font-size: 0.75rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          text-align: left;
        }
        .preview-cast-gender-tag {
          font-size: 0.625rem;
          padding: 0.05rem 0.35rem;
          border-radius: 3px;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 0.125rem;
        }
        .preview-cast-gender-tag.female {
          background-color: rgba(236, 72, 153, 0.15);
          color: #ec4899;
          border: 1px solid rgba(236, 72, 153, 0.3);
        }
        .preview-cast-gender-tag.male {
          background-color: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .preview-cast-gender-tag.unspecified {
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }
        .preview-actions {
          gap: 1rem;
          border-top: 1px solid var(--border-color);
          padding-top: 1.25rem;
        }
        .import-success-banner {
          background-color: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: var(--border-radius);
          padding: 0.75rem;
          font-weight: 500;
          text-align: center;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default ExternalPreviewModal;
