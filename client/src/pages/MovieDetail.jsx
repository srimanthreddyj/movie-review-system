import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api, { getProxiedImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import FavouriteButton from '../components/FavouriteButton';
import AddToCollectionModal from '../components/AddToCollectionModal';
import CastCard from '../components/CastCard';
import ClipCard from '../components/ClipCard';
import CommentSection from '../components/CommentSection';
import { Film, Calendar, Globe, Star, Sparkles, Clock, AlertTriangle, ArrowLeft, Tag, FolderPlus, Heart, MessageSquare } from 'lucide-react';

const MovieDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isExternal = id.startsWith('tmdb-');
  
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiWarning, setAiWarning] = useState('');

  // Favourites state
  const [userFavs, setUserFavs] = useState([]);

  // Collection Modal State
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);

  // Tag Assignments state
  const [movieTags, setMovieTags] = useState([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Open collections modal if redirected with state from preview page
  useEffect(() => {
    if (location.state?.openCollections) {
      setIsCollectionModalOpen(true);
      // Clean up location state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    if (isExternal) {
      fetchExternalMovieDetails();
      setUserFavs([]);
      setMovieTags([]);
    } else {
      fetchMovieDetails();
      fetchUserFavourites();
      fetchMovieTags();
    }
  }, [id]);

  const fetchMovieDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/movies/${id}`);
      setMovie(response.data);
    } catch (err) {
      console.error('Failed to load movie details:', err);
      setError(err.response?.data?.message || 'Could not find the requested movie.');
    } finally {
      setLoading(false);
    }
  };

  const fetchExternalMovieDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const searchParams = new URLSearchParams(location.search);
      const source = searchParams.get('source') || 'tmdb';
      const mediaType = searchParams.get('mediaType') || 'movie';
      const refId = id.replace(/^tmdb-/, '');

      const response = await api.get('/movies/external-details-preview', {
        params: { refId, source, mediaType }
      });
      
      // Normalize the cast list for the preview page so it conforms to the structure of CastCard expect
      const details = response.data;
      if (details && details.cast) {
        details.cast = details.cast.map((actor, idx) => ({
          _id: actor.tmdbId || `preview-cast-${idx}`,
          characterName: actor.characterName,
          role: actor.role,
          castId: {
            _id: actor.tmdbId || `preview-cast-${idx}`,
            tmdbId: actor.tmdbId,
            name: actor.name,
            photoUrl: actor.photoUrl,
            knownFor: actor.knownFor,
            gender: actor.gender,
            source: 'tmdb'
          }
        }));
      }
      setMovie(details);
    } catch (err) {
      console.error('Failed to load preview details:', err);
      setError(err.response?.data?.message || 'Could not load preview details from TMDB.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserFavourites = async () => {
    try {
      const response = await api.get('/favourites');
      setUserFavs(response.data.movies || []);
    } catch (err) {
      console.error('Failed to load user favourites:', err);
    }
  };

  const fetchMovieTags = async () => {
    try {
      const response = await api.get('/tags');
      const tagsData = response.data || [];
      const assigned = [];
      for (const tag of tagsData) {
        try {
          const assignRes = await api.get(`/tags?tagId=${tag._id}`);
          const hasMovie = assignRes.data.movies.some(m => m._id.toString() === id);
          if (hasMovie) {
            assigned.push(tag);
          }
        } catch (e) {
          // Ignore
        }
      }
      setMovieTags(assigned);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const ensureImported = async () => {
    setLoading(true);
    setError('');
    try {
      const searchParams = new URLSearchParams(location.search);
      const source = searchParams.get('source') || 'tmdb';
      const mediaType = searchParams.get('mediaType') || 'movie';
      const refId = id.replace(/^tmdb-/, '');

      const response = await api.get('/movies/external-details', {
        params: {
          refId,
          source,
          mediaType,
          title: movie.title,
          onlyActresses: 'false'
        }
      });
      return response.data._id;
    } catch (err) {
      console.error('On-demand import failed:', err);
      setError(err.response?.data?.message || 'Failed to save movie details to the database.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleExternalFavourite = async () => {
    try {
      const localId = await ensureImported();
      await api.post(`/favourites/movies/${localId}`);
      navigate(`/movies/${localId}`, { replace: true });
    } catch (err) {
      console.error('Failed to favorite external item:', err);
    }
  };

  const handleExternalSaveToCollection = async () => {
    try {
      const localId = await ensureImported();
      navigate(`/movies/${localId}`, { replace: true, state: { openCollections: true } });
    } catch (err) {
      console.error('Failed to save external item to collection:', err);
    }
  };

  const handleExternalAssignTag = async (tagId) => {
    try {
      const localId = await ensureImported();
      await api.post(`/tags/${tagId}/assign`, {
        entityType: 'movie',
        entityId: localId
      });
      navigate(`/movies/${localId}`, { replace: true });
    } catch (err) {
      console.error('Failed to assign tag to external item:', err);
    }
  };

  const handleExternalGenerateAI = async () => {
    try {
      const localId = await ensureImported();
      setAiLoading(true);
      setAiWarning('');
      await api.post(`/movies/${localId}/explanation`);
      navigate(`/movies/${localId}`, { replace: true });
    } catch (err) {
      console.error('Failed to generate AI explanation:', err);
      setAiWarning('AI Generation failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateAIExplanation = async () => {
    setAiLoading(true);
    setAiWarning('');
    try {
      const response = await api.post(`/movies/${id}/explanation`);
      
      // Update movie state with new explanation details
      setMovie(prev => ({
        ...prev,
        explanation: response.data.explanation,
        explanationGeneratedAt: response.data.explanationGeneratedAt
      }));

      if (response.data.isFallback) {
        setAiWarning('Warning: The live AI Service was unreachable. A fallback profile has been compiled locally.');
      }
    } catch (err) {
      console.error('AI generation failed:', err);
      setAiWarning(err.response?.data?.message || 'AI Generation failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAssignTag = async (tagId) => {
    try {
      await api.post(`/tags/${tagId}/assign`, {
        entityType: 'movie',
        entityId: id
      });
      fetchMovieTags();
      setShowTagDropdown(false);
    } catch (err) {
      console.error('Failed to assign tag:', err);
    }
  };

  const handleRemoveTag = async (tagId) => {
    try {
      await api.delete(`/tags/${tagId}/assign/${id}`);
      fetchMovieTags();
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  // Safe client-side Markdown to HTML compiler
  const parseMarkdown = (mdText) => {
    if (!mdText) return { __html: '' };
    
    let html = mdText
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="md-h2">$2</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>')
      // Bullet lists
      .replace(/^\s*-\s+(.*$)/gim, '<li class="md-li">$1</li>')
      // Alerts notes
      .replace(/^> \[\!NOTE\]\s*$/gim, '<div class="md-alert md-alert-note">')
      .replace(/^> \[\!IMPORTANT\]\s*$/gim, '<div class="md-alert md-alert-important">')
      .replace(/<\/div>\s*^> (.*$)/gim, '<strong>$1</strong></div>') // Simple closing
      // Bold and italics
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Paragraph spacing
      .replace(/\n\n/g, '</p><p class="md-p">')
      .replace(/\n/g, '<br />');

    // Wrap elements
    html = `<p class="md-p">${html}</p>`;
    return { __html: html };
  };

  if (loading) {
    return <div className="container loading-view flex-center">Loading details...</div>;
  }

  if (error || !movie) {
    return (
      <div className="container error-view flex-center">
        <AlertTriangle size={40} className="text-danger" />
        <h2>{error || 'Movie not found'}</h2>
        <Link to="/movies" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
          Back to Catalogue
        </Link>
      </div>
    );
  }

  // Destructure movie details
  const { title, originalTitle, mediaType, releaseDate, synopsis, genre = [], language, posterUrl, bannerUrl, cast = [], explanation, explanationGeneratedAt } = movie;

  // Filter actresses (Female) first for listing
  const sortedCast = [...cast].sort((a, b) => {
    const aFemale = a.castId?.gender === 'Female' ? 1 : 0;
    const bFemale = b.castId?.gender === 'Female' ? 1 : 0;
    return bFemale - aFemale; // Descending order: Actresses first
  });

  return (
    <div className="container detail-container">
      {/* External Preview Warning Banner */}
      {isExternal && (
        <div className="flex-between" style={{
          backgroundColor: 'var(--accent-light)',
          border: '1px solid var(--accent-color)',
          padding: '1rem',
          borderRadius: 'var(--border-radius)',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div className="flex-center" style={{ gap: '0.5rem', textAlign: 'left' }}>
            <Sparkles size={18} className="ai-spark-icon" />
            <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>
              This movie is a live preview from TMDB. Save it to CineTrack to enable private notes, tags, and collections.
            </span>
          </div>
          <button onClick={ensureImported} className="btn btn-accent btn-sm flex-center">
            Save to Catalogue
          </button>
        </div>
      )}

      {/* Back button */}
      <Link to="/movies" className="back-link flex-center" style={{ justifyContent: 'flex-start', marginBottom: '1.5rem', gap: '0.25rem' }}>
        <ArrowLeft size={14} />
        <span>Back to Catalogue</span>
      </Link>

      {/* Banner / Poster Section */}
      <div className="detail-hero">
        {bannerUrl ? (
          <div className="banner-img-container">
            <img src={getProxiedImageUrl(bannerUrl)} alt={`${title} Banner`} className="banner-img" />
          </div>
        ) : (
          <div className="banner-img-fallback" />
        )}

        <div className="detail-meta-overlay flex-between">
          <div className="hero-poster-wrapper">
            {posterUrl ? (
              <img src={getProxiedImageUrl(posterUrl)} alt={`${title} Poster`} className="hero-poster" />
            ) : (
              <div className="hero-poster-fallback flex-center">No Image</div>
            )}
          </div>

          <div className="hero-details">
            <h1 className="hero-title">{title}</h1>
            {originalTitle && originalTitle !== title && (
              <p className="hero-subtitle">Original Title: {originalTitle}</p>
            )}
            
            <div className="hero-badges flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" style={{ textTransform: 'capitalize' }}>{mediaType}</span>
              {releaseDate && (
                <span className="badge flex-center">
                  <Calendar size={12} style={{ marginRight: '0.25rem' }} />
                  {new Date(releaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              )}
              {language && (
                <span className="badge flex-center">
                  <Globe size={12} style={{ marginRight: '0.25rem' }} />
                  {language}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Row: Favourites & Tag Management */}
      <section className="detail-actions-row flex-between" style={{ flexWrap: 'wrap', gap: '1rem', margin: '2rem 0' }}>
        <div className="flex-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          {isExternal ? (
            <button 
              onClick={handleExternalFavourite} 
              disabled={loading} 
              className="btn fav-btn flex-center"
            >
              <Heart size={16} style={{ marginRight: '0.5rem' }} />
              <span>Add to Favourites</span>
            </button>
          ) : (
            <FavouriteButton 
              entityType="movies" 
              entityId={id} 
              favouritesList={userFavs}
              onUpdate={fetchUserFavourites}
            />
          )}
          
          <button 
            onClick={isExternal ? handleExternalSaveToCollection : () => setIsCollectionModalOpen(true)}
            className="btn btn-secondary flex-center"
            style={{ gap: '0.5rem', minHeight: '40px' }}
          >
            <FolderPlus size={16} />
            <span>Save to Collection</span>
          </button>
        </div>

        {/* Tags Assignment UI */}
        <div className="detail-tags-manager" style={{ position: 'relative' }}>
          <div className="assigned-tags-list flex-center" style={{ gap: '0.375rem', flexWrap: 'wrap' }}>
            {!isExternal && movieTags.map((tag) => (
              <span 
                key={tag._id} 
                className="tag-badge flex-center" 
                style={{ backgroundColor: tag.color + '15', borderColor: tag.color, color: tag.color }}
              >
                <span>{tag.name}</span>
                <button onClick={() => handleRemoveTag(tag._id)} className="tag-remove-btn flex-center">
                  &times;
                </button>
              </span>
            ))}
            <button 
              onClick={() => setShowTagDropdown(!showTagDropdown)} 
              className="btn btn-sm flex-center" 
              style={{ gap: '0.25rem', minHeight: '32px' }}
            >
              <Tag size={12} />
              <span>Assign Tag</span>
            </button>
          </div>

          {/* Tag Select Dropdown */}
          {showTagDropdown && (
            <div className="tags-dropdown-menu">
              <div className="tags-dropdown-header">Assign a Tag</div>
              {user?.tags?.filter(t => !movieTags.some(mt => mt._id === t._id)).length === 0 ? (
                <div className="tags-dropdown-empty">No other tags available</div>
              ) : (
                user?.tags?.filter(t => !movieTags.some(mt => mt._id === t._id)).map((tag) => (
                  <button 
                    key={tag._id} 
                    onClick={() => isExternal ? handleExternalAssignTag(tag._id) : handleAssignTag(tag._id)} 
                    className="tags-dropdown-item flex-center"
                    style={{ justifyContent: 'flex-start', gap: '0.5rem' }}
                  >
                    <span className="tag-dropdown-color-dot" style={{ backgroundColor: tag.color }} />
                    <span>{tag.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* Grid: Synopsis vs. Genres */}
      <div className="detail-columns-grid">
        {/* Left Side: Summary details */}
        <div className="detail-left-col">
          <section className="detail-section">
            <h2>Synopsis</h2>
            <p className="detail-synopsis-text">{synopsis || 'No synopsis available.'}</p>
          </section>

          {/* Populated Cast Members */}
          <section className="detail-section">
            <h2>Cast & Crew</h2>
            {sortedCast.length === 0 ? (
              <p className="empty-msg">No cast details imported.</p>
            ) : (
              <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {sortedCast.map((c) => (
                  c.castId && (
                    <CastCard 
                      key={c._id} 
                      cast={c.castId} 
                      characterName={c.characterName} 
                      onClick={(actor) => {
                        const targetId = actor.tmdbId || actor._id || actor.refId;
                        if (targetId && targetId !== 'undefined') {
                          navigate(`/cast/tmdb-${targetId}?source=tmdb`);
                        }
                      }}
                    />
                  )
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Side: Genres & AI Explanations */}
        <div className="detail-right-col">
          <section className="detail-section">
            <h2>Genres</h2>
            <div className="genre-list flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
              {genre.length === 0 ? (
                <span className="empty-msg">No genres added.</span>
              ) : (
                genre.map((g, index) => (
                  <span key={index} className="detail-genre-pill">{g}</span>
                ))
              )}
            </div>
          </section>

          {/* AI Explanation Area */}
          <section className="detail-section ai-explanation-section">
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h2 style={{ border: 'none', margin: 0, padding: 0 }} className="flex-center">
                <Sparkles size={20} className="ai-spark-icon" style={{ marginRight: '0.5rem' }} />
                <span>AI Critic Explanation</span>
              </h2>
              {explanation && !isExternal && (
                <button 
                  onClick={handleGenerateAIExplanation} 
                  disabled={aiLoading} 
                  className="btn btn-sm flex-center"
                  style={{ minHeight: '32px', gap: '0.25rem' }}
                >
                  <Sparkles size={12} />
                  <span>Regenerate</span>
                </button>
              )}
            </div>

            {aiWarning && (
              <div className="alert alert-warning flex-center" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
                <AlertTriangle size={16} />
                <span>{aiWarning}</span>
              </div>
            )}

            {aiLoading ? (
              <div className="ai-loading-container flex-center">
                <div className="spinner" />
                <span>Generating custom cinematic breakdown using Gemini AI...</span>
              </div>
            ) : explanation ? (
              <div className="ai-markdown-content">
                {explanationGeneratedAt && (
                  <div className="ai-timestamp flex-center" style={{ justifyContent: 'flex-start', gap: '0.25rem' }}>
                    <Clock size={12} />
                    <span>Generated on: {new Date(explanationGeneratedAt).toLocaleDateString()}</span>
                  </div>
                )}
                <div dangerouslySetInnerHTML={parseMarkdown(explanation)} />
              </div>
            ) : (
              <div className="ai-placeholder flex-center">
                <Sparkles size={36} className="ai-placeholder-icon" />
                <h3>No explanation generated yet</h3>
                <p>
                  {isExternal 
                    ? "Save to your catalogue first to generate an AI plot critique, performance breakdown, and themes explanation from Google Gemini."
                    : "Click below to generate a detailed plot analysis, performance breakdown, and themes explanation from Google Gemini."}
                </p>
                <button 
                  onClick={isExternal ? handleExternalGenerateAI : handleGenerateAIExplanation} 
                  className="btn btn-accent flex-center" 
                  style={{ gap: '0.5rem' }}
                >
                  <Sparkles size={16} />
                  <span>Generate AI Explanation</span>
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Private Notes Section */}
      {isExternal ? (
        <div className="comment-section" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <MessageSquare size={36} style={{ color: 'var(--text-muted)', opacity: 0.6, marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1.125rem', margin: 0 }}>Reviews and Notes are locked</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0.5rem auto 1rem auto' }}>
            Private personal notes, reviews, and logs are disabled for previews. Save this title to your database to start taking notes.
          </p>
          <button onClick={ensureImported} className="btn btn-secondary btn-sm">
            Save to Catalogue
          </button>
        </div>
      ) : (
        <CommentSection entityType="movie" entityId={id} />
      )}

      <AddToCollectionModal 
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        entityType="movie"
        entityId={id}
      />

      <style>{`
        .detail-container {
          padding-top: 1.5rem;
          padding-bottom: 4rem;
          text-align: left;
        }
        .back-link {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
        .back-link:hover {
          color: var(--text-primary);
        }
        
        /* Hero Section */
        .detail-hero {
          position: relative;
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
          overflow: hidden;
          background-color: var(--bg-secondary);
          margin-bottom: 1rem;
        }
        .banner-img-container {
          height: 300px;
          width: 100%;
          background-color: #000;
          overflow: hidden;
          position: relative;
        }
        .banner-img-container::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 150px;
          background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
        }
        .banner-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.65;
        }
        .banner-img-fallback {
          height: 150px;
          background-color: var(--bg-tertiary);
        }
        .detail-meta-overlay {
          padding: 1.5rem;
          position: relative;
          z-index: 10;
          margin-top: -100px;
          align-items: flex-end;
          gap: 1.5rem;
        }
        @media (max-width: 640px) {
          .detail-meta-overlay {
            flex-direction: column;
            align-items: center;
            margin-top: 0;
            padding: 1.25rem;
            text-align: center;
          }
        }
        .hero-poster-wrapper {
          width: 150px;
          aspect-ratio: 2/3;
          border-radius: var(--border-radius);
          overflow: hidden;
          border: 3px solid var(--bg-secondary);
          background-color: var(--bg-tertiary);
          box-shadow: var(--shadow-md);
          flex-shrink: 0;
        }
        .hero-poster {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .hero-poster-fallback {
          height: 100%;
          color: var(--text-muted);
          font-size: 0.875rem;
        }
        .hero-details {
          flex-grow: 1;
        }
        .hero-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          line-height: 1.2;
          color: #ffffff;
        }
        [data-theme='light'] .hero-title {
          color: var(--text-primary);
        }
        .hero-subtitle {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-bottom: 0.75rem;
        }
        
        /* Grid */
        .detail-columns-grid {
          display: grid;
          grid-template-columns: 3fr 2fr;
          gap: 2rem;
        }
        @media (max-width: 1024px) {
          .detail-columns-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
        }
        .detail-section {
          margin-bottom: 2rem;
        }
        .detail-synopsis-text {
          font-size: 1rem;
          line-height: 1.6;
          color: var(--text-secondary);
        }
        
        /* Tag Badge remove */
        .tag-badge {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          border: 1px solid;
          gap: 0.25rem;
        }
        .tag-remove-btn {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 0.875rem;
          line-height: 1;
          width: 14px;
          height: 14px;
        }
        .tags-dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.25rem;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          box-shadow: var(--shadow-md);
          z-index: 20;
          width: 180px;
          padding: 0.375rem 0;
        }
        .tags-dropdown-header {
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .tags-dropdown-item {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: background-color var(--transition-speed);
        }
        .tags-dropdown-item:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .tag-dropdown-color-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        
        /* Genre pills */
        .detail-genre-pill {
          font-size: 0.875rem;
          padding: 0.25rem 0.75rem;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-secondary);
        }
        
        /* AI Panel */
        .ai-explanation-section {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 1.5rem;
        }
        .ai-spark-icon {
          color: var(--accent-color);
        }
        .ai-timestamp {
          font-size: 0.75rem;
          color: var(--text-muted);
          gap: 0.25rem;
          margin-bottom: 1rem;
        }
        .ai-loading-container {
          flex-direction: column;
          gap: 1rem;
          padding: 3rem 1rem;
          color: var(--text-secondary);
          font-size: 0.875rem;
          text-align: center;
        }
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-color);
          border-top-color: var(--accent-color);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .ai-placeholder {
          flex-direction: column;
          padding: 2.5rem 1rem;
          text-align: center;
          gap: 0.75rem;
        }
        .ai-placeholder-icon {
          color: var(--text-muted);
          opacity: 0.6;
        }
        .ai-placeholder h3 {
          font-size: 1.125rem;
          margin: 0;
        }
        .ai-placeholder p {
          font-size: 0.875rem;
          max-width: 300px;
          margin-bottom: 0.5rem;
        }
        
        /* AI Markdown Styles */
        .ai-markdown-content {
          font-size: 0.938rem;
          line-height: 1.6;
          color: var(--text-secondary);
        }
        .ai-markdown-content .md-h1,
        .ai-markdown-content .md-h2,
        .ai-markdown-content .md-h3 {
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          border: none;
          padding: 0;
          letter-spacing: -0.01em;
        }
        .ai-markdown-content .md-h1 { font-size: 1.35rem; }
        .ai-markdown-content .md-h2 { font-size: 1.15rem; }
        .ai-markdown-content .md-h3 { font-size: 1rem; }
        .ai-markdown-content .md-p {
          margin-bottom: 1rem;
        }
        .ai-markdown-content .md-li {
          margin-left: 1.25rem;
          margin-bottom: 0.375rem;
        }
        .ai-markdown-content .md-alert {
          padding: 0.75rem 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          border-left: 3px solid;
          font-size: 0.875rem;
        }
        .ai-markdown-content .md-alert-note {
          background-color: var(--accent-light);
          border-left-color: var(--accent-color);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};

export default MovieDetail;
