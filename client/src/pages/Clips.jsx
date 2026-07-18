import React, { useEffect, useState, useRef } from 'react';
import api, { getProxiedImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ClipCard from '../components/ClipCard';
import { Video, Plus, Search, RotateCcw, X, AlertCircle } from 'lucide-react';

const Clips = () => {
  const { user, isAdmin } = useAuth();
  const [clips, setClips] = useState([]);
  const [moviesList, setMoviesList] = useState([]);
  const [castList, setCastList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClips, setTotalClips] = useState(0);

  // Cast Suggestions State
  const [movieCastSuggestions, setMovieCastSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Form Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [editingClipId, setEditingClipId] = useState(null);
  const [userFavs, setUserFavs] = useState([]);

  // Form Fields
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    description: '',
    clipType: 'trailer',
    movieId: '',
    castInvolved: []
  });

  // Selected Cast & Search States
  const [selectedCast, setSelectedCast] = useState([]);
  const [castSearchQuery, setCastSearchQuery] = useState('');
  const [castSearchResults, setCastSearchResults] = useState([]);
  const [searchingCast, setSearchingCast] = useState(false);

  // Selected Movie & Search States
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [searchingMovie, setSearchingMovie] = useState(false);

  // Autocomplete UI dropdown visibility & click-outside tracking
  const [showMovieDropdown, setShowMovieDropdown] = useState(false);
  const [showCastDropdown, setShowCastDropdown] = useState(false);
  const movieSearchRef = useRef(null);
  const castSearchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (movieSearchRef.current && !movieSearchRef.current.contains(e.target)) {
        setShowMovieDropdown(false);
      }
      if (castSearchRef.current && !castSearchRef.current.contains(e.target)) {
        setShowCastDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMovieSearchChange = async (e) => {
    const query = e.target.value;
    setMovieSearchQuery(query);
    if (!query.trim()) {
      setMovieSearchResults([]);
      setShowMovieDropdown(false);
      return;
    }
    
    setSearchingMovie(true);
    setShowMovieDropdown(true);
    try {
      const res = await api.get('/movies/search', {
        params: { q: query }
      });
      setMovieSearchResults(res.data || []);
    } catch (err) {
      console.error('Failed to search external movies:', err);
    } finally {
      setSearchingMovie(false);
    }
  };

  const handleSelectMovie = (movie) => {
    setSelectedMovie(movie);
    setFormData(prev => ({ ...prev, movieId: movie.source === 'local' ? movie.refId : '' }));
    setMovieSearchQuery('');
    setMovieSearchResults([]);
    setShowMovieDropdown(false);
  };

  const handleClearSelectedMovie = () => {
    setSelectedMovie(null);
    setFormData(prev => ({ ...prev, movieId: '' }));
    setShowMovieDropdown(false);
  };

  const handleCastSearchChange = async (e) => {
    const query = e.target.value;
    setCastSearchQuery(query);
    if (!query.trim()) {
      setCastSearchResults([]);
      setShowCastDropdown(false);
      return;
    }
    
    setSearchingCast(true);
    setShowCastDropdown(true);
    try {
      const res = await api.get('/cast/search-external', {
        params: { q: query }
      });
      setCastSearchResults(res.data || []);
    } catch (err) {
      console.error('Failed to search external cast:', err);
    } finally {
      setSearchingCast(false);
    }
  };

  const handleAddSelectedCast = (cast) => {
    const isAlreadySelected = selectedCast.some(c => 
      (c._id && cast._id && c._id === cast._id) || 
      (c.tmdbId && cast.tmdbId && c.tmdbId === cast.tmdbId)
    );
    if (!isAlreadySelected) {
      setSelectedCast(prev => [...prev, cast]);
    }
    setCastSearchQuery('');
    setCastSearchResults([]);
    setShowCastDropdown(false);
  };

  const handleRemoveSelectedCast = (cast) => {
    setSelectedCast(prev => prev.filter(c => 
      !((c._id && cast._id && c._id === cast._id) || 
        (c.tmdbId && cast.tmdbId && c.tmdbId === cast.tmdbId))
    ));
  };

  useEffect(() => {
    fetchMoviesAndCast();
  }, []);

  const fetchClipsData = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 12
      };
      if (typeFilter) params.clipType = typeFilter;
      if (searchQuery) params.q = searchQuery;

      const [clipsRes, favsRes] = await Promise.all([
        api.get('/clips', { params }),
        api.get('/favourites')
      ]);
      setClips(clipsRes.data.clips || []);
      setCurrentPage(clipsRes.data.page || 1);
      setTotalPages(clipsRes.data.totalPages || 1);
      setTotalClips(clipsRes.data.totalClips || 0);
      setUserFavs(favsRes.data.clips || []);
    } catch (err) {
      console.error('Failed to fetch clips and favourites:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger loading when currentPage changes
  useEffect(() => {
    fetchClipsData(currentPage);
  }, [currentPage]);

  // When filters or search queries change, reset page to 1
  useEffect(() => {
    if (currentPage === 1) {
      fetchClipsData(1);
    } else {
      setCurrentPage(1);
    }
  }, [searchQuery, typeFilter]);

  // Fetch cast suggestions when selectedMovie changes
  useEffect(() => {
    const fetchMovieCastSuggestions = async () => {
      if (!selectedMovie) {
        setMovieCastSuggestions([]);
        return;
      }

      setLoadingSuggestions(true);
      try {
        if (selectedMovie.source === 'local') {
          const res = await api.get(`/movies/${selectedMovie.refId}`);
          const castList = (res.data.cast || [])
            .map(c => c.castId)
            .filter(Boolean)
            .map(c => ({
              ...c,
              source: 'local',
              refId: c._id
            }));
          setMovieCastSuggestions(castList);
        } else {
          const res = await api.get('/movies/external-details-preview', {
            params: {
              refId: selectedMovie.refId,
              source: selectedMovie.source,
              mediaType: selectedMovie.mediaType || 'movie',
              title: selectedMovie.title
            }
          });
          const castList = (res.data.cast || []).map(c => ({
            name: c.name,
            photoUrl: c.photoUrl,
            gender: c.gender || 'Unspecified',
            tmdbId: c.tmdbId,
            source: 'tmdb'
          }));
          setMovieCastSuggestions(castList);
        }
      } catch (err) {
        console.error('Failed to fetch movie cast suggestions:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchMovieCastSuggestions();
  }, [selectedMovie]);

  const handleRefreshFavourites = async () => {
    try {
      const favsRes = await api.get('/favourites');
      setUserFavs(favsRes.data.clips || []);
    } catch (err) {
      console.error('Failed to refresh favourites:', err);
    }
  };

  const handleEditClick = (clip) => {
    setEditingClipId(clip._id);
    
    // Set form fields safely
    setFormData({
      title: clip.title || '',
      url: clip.url || '',
      description: clip.description || '',
      clipType: clip.clipType || 'trailer',
      movieId: clip.movieId && typeof clip.movieId === 'object' ? clip.movieId._id : (clip.movieId || ''),
      castInvolved: clip.castInvolved ? clip.castInvolved.map(c => typeof c === 'object' ? c._id : c) : []
    });

    // Populate selected movie safely
    if (clip.movieId && typeof clip.movieId === 'object') {
      setSelectedMovie({
        refId: clip.movieId._id,
        title: clip.movieId.title,
        posterUrl: clip.movieId.posterUrl,
        mediaType: clip.movieId.mediaType,
        source: 'local'
      });
    } else {
      setSelectedMovie(null);
    }

    // Populate selected cast safely
    if (clip.castInvolved && Array.isArray(clip.castInvolved)) {
      setSelectedCast(
        clip.castInvolved.map(c => typeof c === 'object' ? {
          refId: c._id,
          _id: c._id,
          name: c.name,
          photoUrl: c.photoUrl,
          gender: c.gender,
          source: 'local'
        } : { _id: c, refId: c, name: 'Unknown Cast', source: 'local' })
      );
    } else {
      setSelectedCast([]);
    }

    setMovieSearchQuery('');
    setCastSearchQuery('');
    setFormError('');
    setShowAddModal(true);
  };

  const fetchMoviesAndCast = async () => {
    try {
      const [moviesRes, castRes] = await Promise.all([
        api.get('/movies'),
        api.get('/cast')
      ]);
      setMoviesList(moviesRes.data.movies || []);
      setCastList(castRes.data.casts || []);
    } catch (err) {
      console.error('Failed to load form lookup data:', err);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('');
    setCurrentPage(1);
  };

  const handleDeleteClip = async (id) => {
    try {
      await api.delete(`/clips/${id}`);
      fetchClipsData(currentPage);
    } catch (err) {
      console.error('Failed to delete clip:', err);
      alert(err.response?.data?.message || 'Delete failed.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCastCheckboxChange = (castId) => {
    setFormData((prev) => {
      const current = prev.castInvolved;
      const updated = current.includes(castId)
        ? current.filter(id => id !== castId)
        : [...current, castId];
      return { ...prev, castInvolved: updated };
    });
  };

  const handleAddClip = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.url) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setFormError('');
    setFormLoading(true);

    try {
      let finalMovieId = formData.movieId || null;
      
      // Resolve external movie to local ID (auto-import) if selected
      if (selectedMovie) {
        if (selectedMovie.source !== 'local') {
          try {
            const importRes = await api.get('/movies/external-details', {
              params: {
                refId: selectedMovie.refId,
                source: selectedMovie.source,
                mediaType: selectedMovie.mediaType || 'movie',
                title: selectedMovie.title,
                onlyActresses: 'false'
              }
            });
            finalMovieId = importRes.data._id;
          } catch (importErr) {
            console.error(`Failed to import movie ${selectedMovie.title} on clip save:`, importErr);
            throw new Error(`Failed to import movie "${selectedMovie.title}".`);
          }
        } else {
          finalMovieId = selectedMovie.refId || selectedMovie._id;
        }
      }

      // Resolve all selected external cast members to local IDs (duplicate-safe)
      const resolvedCastIds = await Promise.all(selectedCast.map(async (cast) => {
        if (cast.source === 'local' || !cast.source) {
          return cast.refId || cast._id;
        } else {
          try {
            const res = await api.post('/cast/import-external', {
              tmdbId: cast.tmdbId || cast.refId,
              name: cast.name
            });
            return res.data._id;
          } catch (importErr) {
            console.error(`Failed to import cast member ${cast.name} on clip save:`, importErr);
            throw new Error(`Failed to import cast member "${cast.name}".`);
          }
        }
      }));

      const finalFormData = {
        ...formData,
        movieId: finalMovieId,
        castInvolved: resolvedCastIds
      };

      if (editingClipId) {
        await api.put(`/clips/${editingClipId}`, finalFormData);
        fetchClipsData(currentPage);
      } else {
        await api.post('/clips', finalFormData);
        setCurrentPage(1);
        fetchClipsData(1);
      }

      setShowAddModal(false);
      // Reset form
      setFormData({
        title: '',
        url: '',
        description: '',
        clipType: 'trailer',
        movieId: '',
        castInvolved: []
      });
      setSelectedMovie(null);
      setMovieSearchQuery('');
      setMovieSearchResults([]);
      setSelectedCast([]);
      setCastSearchQuery('');
      setCastSearchResults([]);
      setEditingClipId(null);
    } catch (err) {
      setFormError(err.message || err.response?.data?.message || 'Failed to save clip. Ensure URL is valid.');
    } finally {
      setFormLoading(false);
    }
  };



  return (
    <div className="container clips-container">
      <header className="catalogue-header flex-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1>Video Clip Room</h1>
          <p style={{ margin: 0 }}>Watch trailers, BTS interviews, and scenes mapped to your catalogue.</p>
        </div>
        <div className="flex-center" style={{ gap: '0.5rem' }}>
          <button onClick={() => {
            setEditingClipId(null);
            setSelectedMovie(null);
            setSelectedCast([]);
            setMovieSearchQuery('');
            setCastSearchQuery('');
            setFormError('');
            setFormData({
              title: '',
              url: '',
              description: '',
              clipType: 'trailer',
              movieId: '',
              castInvolved: []
            });
            setShowAddModal(true);
          }} className="btn btn-primary flex-center" style={{ gap: '0.375rem' }}>
            <Plus size={16} />
            <span>Add Video Clip</span>
          </button>
          <button onClick={handleResetFilters} className="btn flex-center" style={{ gap: '0.375rem' }}>
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {/* Filters Bar */}
      <section className="filters-section">
        <div className="search-bar-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search clips by title, keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {/* Clip Type Filter */}
          <div className="filter-group">
            <label className="form-label">Clip Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-input select-filter"
            >
              <option value="">All Types</option>
              <option value="trailer">Trailer</option>
              <option value="scene">Scene</option>
              <option value="interview">Interview</option>
              <option value="song">Song</option>
              <option value="bts">Behind the Scenes</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </section>

      {/* Grid Content */}
      {loading ? (
        <div className="catalogue-loading flex-center">Loading clips catalogue...</div>
      ) : clips.length === 0 ? (
        <div className="catalogue-empty">
          <h3>No clips added</h3>
          <p>Be the first to add a trailer or behind-the-scenes video for your tracked items!</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Add Video Clip
          </button>
        </div>
      ) : (
        <div className="grid-cards">
          {clips.map((clip) => (
            <ClipCard 
              key={clip._id} 
              clip={clip} 
              onDelete={handleDeleteClip}
              onEdit={handleEditClick}
              userFavourites={userFavs}
              onFavouriteUpdate={handleRefreshFavourites}
              currentUserId={user?._id}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && totalPages > 1 && (
        <div className="pagination-container">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
            title="Previous Page"
          >
            Prev
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const isNearStart = currentPage <= 4;
            const isNearEnd = currentPage >= totalPages - 3;
            const showPage = p === 1 || p === totalPages || Math.abs(currentPage - p) <= 1;

            if (!showPage) {
              if ((p === 2 && !isNearStart) || (p === totalPages - 1 && !isNearEnd)) {
                return <span key={p} className="pagination-info">...</span>;
              }
              return null;
            }

            return (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`pagination-btn ${currentPage === p ? 'active' : ''}`}
              >
                {p}
              </button>
            );
          })}

          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="pagination-btn"
            title="Next Page"
          >
            Next
          </button>
        </div>
      )}

      {/* Add Clip Modal Popup */}
      {showAddModal && (
        <div className="modal-backdrop flex-center" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header flex-between">
              <span className="modal-title">{editingClipId ? 'Edit Video Clip Link' : 'Add Video Clip Link'}</span>
              <button onClick={() => { setShowAddModal(false); setEditingClipId(null); }} className="modal-close-btn flex-center">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="alert alert-error flex-center" style={{ gap: '0.5rem', margin: '1rem' }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddClip} className="modal-form">
              <div className="form-group">
                <label className="form-label">Clip Title *</label>
                <input 
                  type="text" 
                  name="title"
                  className="form-input" 
                  placeholder="e.g. Inception Main Trailer"
                  value={formData.title}
                  onChange={handleInputChange}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Video URL (YouTube link preferred) *</label>
                <input 
                  type="url" 
                  name="url"
                  className="form-input" 
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={formData.url}
                  onChange={handleInputChange}
                  autoComplete="off"
                  required 
                />
              </div>

              {/* Movie/TV Series Search autocomplete */}
              <div className="form-group" style={{ position: 'relative' }} ref={movieSearchRef}>
                <label className="form-label">Link to Movie/TV Series</label>
                
                {selectedMovie ? (
                  /* Selected Movie Preview */
                  <div className="selected-movie-preview flex-between" style={{
                    padding: '0.625rem 0.875rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: 'var(--bg-secondary)',
                    marginBottom: '0.5rem'
                  }}>
                    <div className="flex-center" style={{ gap: '0.75rem', justifyContent: 'flex-start' }}>
                      {selectedMovie.posterUrl ? (
                        <img 
                          src={getProxiedImageUrl(selectedMovie.posterUrl)} 
                          alt={selectedMovie.title} 
                          style={{ width: '30px', height: '45px', objectFit: 'cover', borderRadius: '4px' }} 
                        />
                      ) : (
                        <div style={{ width: '30px', height: '45px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }} className="flex-center">🎬</div>
                      )}
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{selectedMovie.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {selectedMovie.releaseDate ? new Date(selectedMovie.releaseDate).getFullYear() : 'N/A'} | {selectedMovie.mediaType === 'series' ? 'TV Show' : 'Movie'} | {selectedMovie.source === 'local' ? 'In Catalog' : 'TMDB'}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={handleClearSelectedMovie} className="modal-close-btn flex-center" style={{ width: '28px', height: '28px' }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  /* Search input */
                  <>
                    <input 
                      type="text" 
                      placeholder="Search movies/TV series to link..." 
                      value={movieSearchQuery}
                      onChange={handleMovieSearchChange}
                      onFocus={() => setShowMovieDropdown(true)}
                      className="form-input"
                      style={{ minHeight: '38px', fontSize: '0.813rem' }}
                    />
                    
                    {searchingMovie && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Searching movies...</div>
                    )}
                    
                    {showMovieDropdown && movieSearchResults.length > 0 && (
                      <div className="movie-search-results-list">
                        {movieSearchResults.map((m) => (
                          <div 
                            key={m.refId} 
                            className="movie-search-result-row flex-between"
                            onClick={() => handleSelectMovie(m)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderBottom: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              fontSize: '0.813rem',
                              transition: 'background-color 0.15s',
                              textAlign: 'left'
                            }}
                          >
                            <div className="flex-center" style={{ gap: '0.5rem', justifyContent: 'flex-start' }}>
                              {m.posterUrl ? (
                                <img src={getProxiedImageUrl(m.posterUrl)} alt={m.title} style={{ width: '20px', height: '30px', objectFit: 'cover', borderRadius: '2px' }} />
                              ) : (
                                <div style={{ width: '20px', height: '30px', backgroundColor: 'var(--bg-tertiary)' }} />
                              )}
                              <span>{m.title} ({m.releaseDate ? new Date(m.releaseDate).getFullYear() : 'N/A'}) - {m.mediaType === 'series' ? 'TV Show' : 'Movie'}</span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: m.source === 'local' ? '#10b981' : '#3b82f6', fontWeight: '600' }}>
                              {m.source === 'local' ? 'Catalog' : 'TMDB'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Clip Type</label>
                <select 
                  name="clipType"
                  value={formData.clipType}
                  onChange={handleInputChange}
                  className="form-input"
                >
                  <option value="trailer">Trailer</option>
                  <option value="scene">Scene</option>
                  <option value="interview">Interview</option>
                  <option value="song">Song</option>
                  <option value="bts">Behind the Scenes</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  name="description"
                  className="form-input" 
                  placeholder="Short note about this clip..."
                  rows="2"
                  value={formData.description}
                  onChange={handleInputChange}
                />
              </div>

              {/* Cast selection search input and result list */}
              <div className="form-group" style={{ position: 'relative' }} ref={castSearchRef}>
                <label className="form-label">Involved Cast Members</label>
                
                {/* Selected Cast Pills */}
                {selectedCast.length > 0 && (
                  <div className="selected-cast-list flex-center" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    {selectedCast.map(cast => (
                      <span key={cast.refId || cast._id} className="cast-pill flex-center" style={{ gap: '0.375rem', paddingLeft: cast.photoUrl ? '0.25rem' : '0.75rem' }}>
                        {cast.photoUrl && (
                          <img 
                            src={getProxiedImageUrl(cast.photoUrl)} 
                            alt={cast.name} 
                            style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} 
                          />
                        )}
                        <span>{cast.name}</span>
                        <button type="button" onClick={() => handleRemoveSelectedCast(cast)} className="remove-cast-pill-btn">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Movie Cast Suggestions */}
                {selectedMovie && (
                  <div className="movie-cast-suggestions-container" style={{ marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem', textAlign: 'left' }}>
                      Suggested Cast from "{selectedMovie.title}":
                    </span>
                    {loadingSuggestions ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'left' }}>Loading cast suggestions...</div>
                    ) : movieCastSuggestions.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'left' }}>No cast recommendations found.</div>
                    ) : (
                      <div className="suggestions-flex" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', maxHeight: '110px', overflowY: 'auto', padding: '0.375rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)' }}>
                        {movieCastSuggestions.map((actor, idx) => {
                          const isAlreadySelected = selectedCast.some(c => 
                            (c._id && actor._id && c._id === actor._id) || 
                            (c.tmdbId && actor.tmdbId && c.tmdbId === actor.tmdbId)
                          );
                          
                          return (
                            <button
                              key={actor.tmdbId || actor._id || idx}
                              type="button"
                              onClick={() => !isAlreadySelected && handleAddSelectedCast(actor)}
                              className="suggestion-pill flex-center"
                              disabled={isAlreadySelected}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.188rem 0.5rem',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                backgroundColor: isAlreadySelected ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                                color: isAlreadySelected ? 'var(--text-muted)' : 'var(--text-primary)',
                                cursor: isAlreadySelected ? 'not-allowed' : 'pointer',
                                fontSize: '0.75rem',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {actor.photoUrl && (
                                <img
                                  src={getProxiedImageUrl(actor.photoUrl)}
                                  alt={actor.name}
                                  style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                              )}
                              <span>{actor.name}</span>
                              {!isAlreadySelected && <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginLeft: '2px' }}>+</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Cast Search Input */}
                <input 
                  type="text" 
                  placeholder="Search cast members to add..." 
                  value={castSearchQuery}
                  onChange={handleCastSearchChange}
                  onFocus={() => setShowCastDropdown(true)}
                  className="form-input"
                  style={{ minHeight: '38px', fontSize: '0.813rem' }}
                />

                {/* Searching Loader Indicator */}
                {searchingCast && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Searching cast...</div>
                )}

                {/* Search Results Dropdown List */}
                {showCastDropdown && castSearchResults.length > 0 && (
                  <div className="cast-search-results-list">
                    {castSearchResults.map((cast) => {
                      const isAdded = selectedCast.some(c => 
                        (c._id && cast._id && c._id === cast._id) || 
                        (c.tmdbId && cast.tmdbId && c.tmdbId === cast.tmdbId)
                      );
                      
                      return (
                        <div 
                          key={cast.refId || cast._id} 
                          className="cast-search-result-row flex-between"
                          onClick={() => !isAdded && handleAddSelectedCast(cast)}
                          style={{ opacity: isAdded ? 0.5 : 1, cursor: isAdded ? 'default' : 'pointer' }}
                        >
                          <div className="flex-center" style={{ gap: '0.5rem', justifyContent: 'flex-start' }}>
                            {cast.photoUrl ? (
                              <img 
                                src={getProxiedImageUrl(cast.photoUrl)} 
                                alt={cast.name} 
                                style={{ width: '20px', height: '30px', objectFit: 'cover', borderRadius: '2px' }} 
                              />
                            ) : (
                              <div style={{ width: '20px', height: '30px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>👤</div>
                            )}
                            <span>{cast.name} ({cast.knownForDepartment || (cast.gender === 'Female' ? 'Actress' : 'Actor')}){cast.source === 'tmdb' ? ' - TMDB' : ' - Catalog'}</span>
                          </div>
                          {!isAdded && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: '600' }}>Add</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button type="submit" disabled={formLoading} className="btn btn-primary" style={{ width: '100%', minHeight: '44px', marginTop: '1rem' }}>
                {formLoading ? 'Saving video details...' : (editingClipId ? 'Save Changes' : 'Add Clip')}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .clips-container {
          padding-top: 2rem;
          padding-bottom: 4rem;
          text-align: left;
        }
        .catalogue-header h1 {
          margin-bottom: 0.25rem;
          border: none;
          padding: 0;
        }
        
        /* Filters Bar */
        .filters-section {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 1.5rem;
          margin-bottom: 2rem;
        }
        .search-bar-container {
          position: relative;
          width: 100%;
          margin-bottom: 1.25rem;
        }
        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .search-input {
          padding-left: 2.75rem !important;
        }
        .filters-grid {
          display: grid;
          gap: 1rem;
        }
        @media (max-width: 640px) {
          .filters-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .filter-group {
          margin-bottom: 0;
        }
        .select-filter {
          cursor: pointer;
        }
        
        .catalogue-loading {
          padding: 6rem 0;
          color: var(--text-muted);
          font-size: 1rem;
        }
        .catalogue-empty {
          text-align: center;
          padding: 5rem 1rem;
          background-color: var(--bg-secondary);
          border: 1px dashed var(--border-color);
          border-radius: var(--border-radius);
          color: var(--text-secondary);
        }
        .catalogue-empty h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .catalogue-empty p {
          font-size: 0.875rem;
          margin-bottom: 0;
        }

        /* Modal overlay */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0,0,0,0.5);
          z-index: 1000;
          padding: 1.5rem;
          overflow-y: auto;
        }
        .modal-content {
          width: 100%;
          max-width: 480px;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          box-shadow: var(--shadow-md);
          overflow: hidden;
          margin: auto;
        }
        .modal-header {
          padding: 1rem 1.5rem;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }
        .modal-title {
          font-weight: 600;
          font-size: 1.1rem;
        }
        .modal-close-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          width: 32px;
          height: 32px;
        }
        .modal-form {
          padding: 1.5rem;
        }
        .modal-cast-selector {
          max-height: 150px;
          overflow-y: auto;
          border: 1px solid var(--border-color);
          padding: 0.5rem;
          border-radius: var(--border-radius);
          background-color: var(--bg-secondary);
        }
        .cast-checkbox-row span {
          font-size: 0.875rem;
        }
        .cast-pill {
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 0.25rem 0.75rem;
          font-size: 0.813rem;
          font-weight: 500;
          color: var(--text-primary);
          gap: 0.375rem;
        }
        .remove-cast-pill-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .remove-cast-pill-btn:hover {
          color: #ef4444;
        }
        .cast-search-results-list,
        .movie-search-results-list {
          border: 1px solid var(--border-color);
          border-top: none;
          border-radius: 0 0 var(--border-radius) var(--border-radius);
          max-height: 160px;
          overflow-y: auto;
          background-color: var(--bg-primary);
          position: absolute;
          top: 100%;
          left: 0;
          width: 100%;
          z-index: 15;
          box-shadow: var(--shadow-sm);
        }
        .cast-search-result-row {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          font-size: 0.813rem;
          transition: background-color 0.15s;
          text-align: left;
        }
        .cast-search-result-row:last-child {
          border-bottom: none;
        }
        .cast-search-result-row:hover {
          background-color: var(--bg-tertiary);
        }
        .movie-search-result-row:hover {
          background-color: var(--bg-tertiary);
        }
      `}</style>
    </div>
  );
};

export default Clips;
