import React, { useState } from 'react';
import api from '../services/api';
import ExternalPreviewModal from '../components/ExternalPreviewModal';
import { Film, User, CheckCircle2, Search, Loader2, PowerOff, Power } from 'lucide-react';
import './Admin.css';

/**
 * Import Hub page – provides tools:
 *   • Unified external search (Checks DB -> TMDB -> OMDb -> Wikidata -> Gemini fallbacks)
 *   • Selective "Actress-Only" imports for movie cast profiles
 *   • Live TMDB search and import for cast members (actors/actresses)
 *   • Manual movie creation with rich metadata fields
 */
const Admin = () => {
  const [activeTab, setActiveTab] = useState('movies'); // 'movies' or 'cast'
  const [onlyActresses, setOnlyActresses] = useState(false);
  const [externalApisEnabled, setExternalApisEnabled] = useState(true);

  // Movie search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Cast search states
  const [castSearchQuery, setCastSearchQuery] = useState('');
  const [castSearchResults, setCastSearchResults] = useState([]);
  const [castLoading, setCastLoading] = useState(false);
  const [castMessage, setCastMessage] = useState('');

  // Preview Modal states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewEntity, setPreviewEntity] = useState(null);

  // Healing catalogue states
  const [healing, setHealing] = useState(false);

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/settings');
        setExternalApisEnabled(data.externalApisEnabled);
      } catch (err) {
        console.error('Failed to fetch settings', err);
      }
    };
    fetchSettings();
  }, []);

  const handleToggleApis = async () => {
    try {
      const newValue = !externalApisEnabled;
      setExternalApisEnabled(newValue);
      await api.put('/settings', { externalApisEnabled: newValue });
    } catch (err) {
      console.error('Failed to update settings', err);
      setExternalApisEnabled(!externalApisEnabled); // Revert on failure
    }
  };

  const handleHealCatalogue = async () => {
    setHealing(true);
    setMessage('Syncing and repairing catalogue: searching TMDB and updating missing metadata...');
    try {
      const { data } = await api.post('/movies/heal-gemini');
      setMessage(
        `Heal complete! Successfully repaired ${data.healedCount} movies. Failed: ${data.failedCount}. ${
          data.popularSyncTriggered ? 'Popular cache refresh initiated.' : ''
        }`
      );
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Failed to sync & repair catalogue.');
    } finally {
      setHealing(false);
    }
  };

  const handleCleanupCast = async () => {
    setLoading(true);
    setMessage('Running database cleanup script...');
    try {
      const { data } = await api.post('/settings/cleanup/cast');
      setMessage(`Cleanup complete: ${data.message}`);
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Cleanup script failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setMessage('');
    setSearchResults([]);
    try {
      const { data } = await api.get('/movies/search', { params: { q: searchQuery } });
      setSearchResults(data || []);
      if (!data || data.length === 0) {
        setMessage('No titles found.');
      }
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Failed to search external sources.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (refId, source, mediaType, title) => {
    setLoading(true);
    setMessage('');
    try {
      const { data } = await api.get('/movies/external-details', {
        params: { refId, source, mediaType, title, onlyActresses: onlyActresses.toString() }
      });
      setMessage(`"${data.title}" imported successfully!`);
      setSearchResults(prev => prev.map(item => 
        item.refId === refId && item.source === source
          ? { ...item, source: 'local' }
          : item
      ));
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCastSearch = async () => {
    if (!castSearchQuery.trim()) return;
    setCastLoading(true);
    setCastMessage('');
    setCastSearchResults([]);
    try {
      const { data } = await api.get('/cast/search-external', { params: { q: castSearchQuery } });
      setCastSearchResults(data || []);
      if (!data || data.length === 0) {
        setCastMessage('No persons found.');
      }
    } catch (err) {
      console.error(err);
      setCastMessage(err.response?.data?.message || 'Failed to search cast members.');
    } finally {
      setCastLoading(false);
    }
  };

  const handleCastImport = async (tmdbId, name) => {
    setCastLoading(true);
    setCastMessage('');
    try {
      const { data } = await api.post('/cast/import-external', { tmdbId, name });
      setCastMessage(`"${data.name}" imported successfully!`);
      setCastSearchResults(prev => prev.map(item => 
        item.tmdbId === tmdbId ? { ...item, source: 'local' } : item
      ));
    } catch (err) {
      console.error(err);
      setCastMessage(err.response?.data?.message || 'Import failed.');
    } finally {
      setCastLoading(false);
    }
  };

  const handleManualCreate = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      title: form.title.value,
      synopsis: form.synopsis.value,
      releaseDate: form.releaseDate.value,
      mediaType: form.mediaType.value,
      language: form.language.value,
      genre: form.genre.value ? form.genre.value.split(',').map(s => s.trim()) : [],
      posterUrl: form.posterUrl.value || '',
      rating: form.rating.value ? parseFloat(form.rating.value) : 0,
      dataSource: 'manual'
    };

    setLoading(true);
    setMessage('');
    try {
      await api.post('/movies', payload);
      setMessage('Movie created successfully.');
      form.reset();
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Failed to create movie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="admin-page">
      <h1 className="page-title">Import Hub</h1>

      {/* Settings / Danger Zone */}
      <div className="panel danger-zone" style={{ borderLeft: '4px solid #ef4444', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}>
              <PowerOff size={20} /> Danger Zone: API Kill Switch
            </h2>
            <p className="panel-desc" style={{ margin: 0 }}>
              Toggle this switch to simulate a total external network failure (TMDB, OMDb, Gemini).
              When OFF, the app will instantly fall back to rendering local-only database cache.
            </p>
          </div>
          <button 
            onClick={handleToggleApis}
            className={externalApisEnabled ? 'btn-primary' : 'btn-accent'}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              backgroundColor: externalApisEnabled ? '#10b981' : '#ef4444',
              borderColor: 'transparent'
            }}
          >
            {externalApisEnabled ? <Power size={18} /> : <PowerOff size={18} />}
            {externalApisEnabled ? 'APIs Enabled' : 'APIs Disabled'}
          </button>
        </div>
      </div>

      {/* Database Maintenance Tools */}
      <div className="panel maintenance-zone" style={{ borderLeft: '4px solid #3b82f6', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}>
              <CheckCircle2 size={20} /> Database Maintenance
            </h2>
            <p className="panel-desc" style={{ margin: 0 }}>
              Run maintenance scripts to clean up the database. E.g., fixing duplicate cast members resulting from multi-role imports.
            </p>
          </div>
          <button 
            onClick={handleCleanupCast}
            disabled={loading}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#3b82f6', borderColor: 'transparent' }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            Cleanup Duplicate Cast
          </button>
        </div>
      </div>

      <div className="panel search-import-panel">
        <div className="tab-header flex">
          <button 
            className={`tab-btn ${activeTab === 'movies' ? 'active' : ''}`}
            onClick={() => setActiveTab('movies')}
          >
            Movies & Shows
          </button>
          <button 
            className={`tab-btn ${activeTab === 'cast' ? 'active' : ''}`}
            onClick={() => setActiveTab('cast')}
          >
            Actors & Actresses
          </button>
        </div>

        {activeTab === 'movies' ? (
          <div>
            <h2>Search & Import Catalog</h2>
            <p className="panel-desc">
              Search for movies or shows. View previews or import them. Enable "Actresses Only" importing to filter out male/unspecified cast members on import.
            </p>

            <div className="options-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={onlyActresses} 
                  onChange={(e) => setOnlyActresses(e.target.checked)} 
                  className="checkbox-input"
                />
                <span>Import Female Cast Members (Actresses Only)</span>
              </label>

              <button
                onClick={handleHealCatalogue}
                disabled={healing || loading}
                className="btn-accent flex-center"
                style={{ gap: '0.5rem', minHeight: '38px', padding: '0 1rem', display: 'inline-flex', alignItems: 'center' }}
              >
                {healing ? <Loader2 className="animate-spin" size={16} /> : <Film size={16} />}
                <span>Sync & Repair Catalogue</span>
              </button>
            </div>
            
            <div className="search-box-row">
              <input
                type="text"
                placeholder="Search movie or series title…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} disabled={loading} className="btn-primary search-btn">
                Search
              </button>
            </div>

            {loading && <div className="loader">Searching sources...</div>}
            {message && <p className="msg">{message}</p>}

            <ul className="results-list">
              {searchResults.map((item, idx) => (
                <li 
                  key={`${item.refId}-${item.source}-${idx}`} 
                  className="result-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setPreviewEntity({
                      refId: item.refId,
                      source: item.source,
                      type: item.mediaType,
                      title: item.title
                    });
                    setPreviewOpen(true);
                  }}
                >
                  <div className="result-details">
                    <div className="result-header">
                      <span className="result-title">{item.title}</span>
                      <span className="result-meta">
                        {item.releaseDate ? new Date(item.releaseDate).getFullYear() : 'N/A'} • {item.mediaType === 'series' ? 'TV Series' : 'Movie'}
                      </span>
                    </div>
                    <div className="source-row">
                      Source: <span className={`source-badge ${item.source}`}>{item.source.toUpperCase()}</span>
                    </div>
                    {item.synopsis && <p className="result-synopsis">{item.synopsis.slice(0, 150)}...</p>}
                  </div>
                  
                  <div className="action-col">
                    {item.source === 'local' ? (
                      <span className="badge-imported">In Catalog</span>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImport(item.refId, item.source, item.mediaType, item.title);
                        }} 
                        disabled={loading} 
                        className="btn-secondary"
                      >
                        Import
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <h2>Search & Import Cast Members</h2>
            <p className="panel-desc">
              Search for actors or actresses from TMDB and import them directly to cache their rich bio data, gender, birthday, place of birth, and nationality.
            </p>
            
            <div className="search-box-row">
              <input
                type="text"
                placeholder="Search actor or actress name…"
                value={castSearchQuery}
                onChange={(e) => setCastSearchQuery(e.target.value)}
                className="search-input"
                onKeyDown={(e) => e.key === 'Enter' && handleCastSearch()}
              />
              <button onClick={handleCastSearch} disabled={castLoading} className="btn-primary search-btn">
                Search
              </button>
            </div>

            {castLoading && <div className="loader">Searching persons...</div>}
            {castMessage && <p className="msg">{castMessage}</p>}

            <ul className="results-list">
              {castSearchResults.map((item, idx) => (
                <li 
                  key={`${item.tmdbId}-${idx}`} 
                  className="result-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setPreviewEntity({
                      refId: item.tmdbId,
                      source: item.source || 'tmdb',
                      type: 'person',
                      title: item.name
                    });
                    setPreviewOpen(true);
                  }}
                >
                  <div className="result-details flex" style={{ gap: '1rem', alignItems: 'center' }}>
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt={item.name} className="cast-avatar-mini" />
                    ) : (
                      <div className="cast-avatar-mini-fallback">
                        <User size={18} />
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span className="result-title">{item.name}</span>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                        <span className={`cast-result-meta ${item.gender?.toLowerCase() || 'unspecified'}`}>
                          {item.gender}
                        </span>
                        {item.knownForDepartment && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            • {item.knownForDepartment}
                          </span>
                        )}
                      </div>
                      {item.knownFor && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          Known for: {item.knownFor}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="action-col">
                    {item.source === 'local' ? (
                      <span className="badge-imported">In Catalog</span>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCastImport(item.tmdbId, item.name);
                        }} 
                        disabled={castLoading} 
                        className="btn-secondary"
                      >
                        Import
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Manual Creation Panel */}
      <div className="panel manual-create">
        <h2>Manual Movie Creation</h2>
        <p className="panel-desc">Create a movie profile from scratch in our database.</p>
        
        <form onSubmit={handleManualCreate} className="manual-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Title</label>
              <input type="text" name="title" placeholder="e.g. Inception" required className="form-input" />
            </div>
            
            <div className="form-group">
              <label>Media Type</label>
              <select name="mediaType" required className="form-input">
                <option value="movie">Movie</option>
                <option value="series">TV Series</option>
              </select>
            </div>

            <div className="form-group">
              <label>Language</label>
              <input type="text" name="language" placeholder="e.g. English" required className="form-input" />
            </div>

            <div className="form-group">
              <label>Genres (comma separated)</label>
              <input type="text" name="genre" placeholder="e.g. Action, Sci-Fi, Thriller" required className="form-input" />
            </div>

            <div className="form-group">
              <label>Release Date</label>
              <input type="date" name="releaseDate" required className="form-input" />
            </div>

            <div className="form-group">
              <label>Rating (0.0 to 10.0)</label>
              <input type="number" name="rating" placeholder="e.g. 8.8" step="0.1" min="0" max="10" className="form-input" />
            </div>
          </div>

          <div className="form-group full-width">
            <label>Poster URL (optional)</label>
            <input type="url" name="posterUrl" placeholder="e.g. https://image.tmdb.org/..." className="form-input" />
          </div>

          <div className="form-group full-width">
            <label>Synopsis</label>
            <textarea name="synopsis" placeholder="Provide a brief synopsis of the plot..." rows={3} required className="form-input" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            Create Movie
          </button>
        </form>
      </div>

      {/* External Preview Modal */}
      {previewEntity && (
        <ExternalPreviewModal
          isOpen={previewOpen}
          onClose={() => { setPreviewOpen(false); setPreviewEntity(null); }}
          entityRefId={previewEntity.refId}
          entitySource={previewEntity.source}
          entityType={previewEntity.type}
          entityTitle={previewEntity.title}
        />
      )}
    </section>
  );
};

export default Admin;
