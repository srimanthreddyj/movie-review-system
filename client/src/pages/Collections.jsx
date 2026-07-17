import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Trash2, FolderPlus, Plus, X, Film, User, 
  Video, Edit3, AlertCircle, Check, FolderOpen 
} from 'lucide-react';
import api from '../services/api';
import MovieCard from '../components/MovieCard';
import CastCard from '../components/CastCard';
import ClipCard from '../components/ClipCard';
import { useRestorePageState, useNavigationHistory } from '../context/NavigationHistoryContext';
import './Collections.css';

const Collections = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { navigationType } = useNavigationHistory();
  const isPop = navigationType === 'POP';

  const [collections, setCollections] = useState([]);
  const [selectedCol, setSelectedCol] = useState(null);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form Fields
  const [colName, setColName] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colCover, setColCover] = useState('');

  // Navigation History State Restoration
  const [pageState, setPageState] = useRestorePageState('collections', {
    selectedCollectionId: null,
    activeTab: 'movie',
    currentPage: 1,
    itemPage: 1,
    colSearchQuery: '',
    itemSearchQuery: ''
  }, loading || detailLoading);

  const { selectedCollectionId, activeTab, currentPage, itemPage, colSearchQuery, itemSearchQuery } = pageState;

  const setSelectedCollectionId = (val) => setPageState(prev => ({ ...prev, selectedCollectionId: typeof val === 'function' ? val(prev.selectedCollectionId) : val }));
  const setActiveTab = (val) => setPageState(prev => ({ ...prev, activeTab: typeof val === 'function' ? val(prev.activeTab) : val }));
  const setCurrentPage = (val) => setPageState(prev => ({ ...prev, currentPage: typeof val === 'function' ? val(prev.currentPage) : val }));
  const setItemPage = (val) => setPageState(prev => ({ ...prev, itemPage: typeof val === 'function' ? val(prev.itemPage) : val }));
  const setColSearchQuery = (val) => setPageState(prev => ({ ...prev, colSearchQuery: typeof val === 'function' ? val(prev.colSearchQuery) : val }));
  const setItemSearchQuery = (val) => setPageState(prev => ({ ...prev, itemSearchQuery: typeof val === 'function' ? val(prev.itemSearchQuery) : val }));
  
  // Custom Confirmation Dialog State
  const [itemToRemove, setItemToRemove] = useState(null);

  const isInitialMountRef = useRef(true);

  // Reset item page when active collection or tab changes
  useEffect(() => {
    if (isInitialMountRef.current) {
      return;
    }
    setItemPage(1);
  }, [selectedCol?._id, activeTab, itemSearchQuery]);

  // Reset current page when colSearchQuery changes
  useEffect(() => {
    if (isInitialMountRef.current) {
      return;
    }
    setCurrentPage(1);
  }, [colSearchQuery]);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/collections');
      setCollections(response.data);
      
      if (selectedCollectionId) {
        const matchedCol = response.data.find(c => c._id === selectedCollectionId);
        if (matchedCol) {
          setSelectedCol(matchedCol);
          fetchCollectionDetail(matchedCol._id);
        }
      }
    } catch (err) {
      console.error('Failed to load collections:', err);
      setError('Could not load collections catalogue.');
    } finally {
      setLoading(false);
      isInitialMountRef.current = false;
    }
  };

  const fetchCollectionDetail = async (id) => {
    try {
      setDetailLoading(true);
      setError('');
      const response = await api.get(`/collections/${id}`);
      setSelectedCol(response.data);
      setSelectedCollectionId(id);
      // Automatically focus first tab that has items, or default to movie, unless restoring
      if (!isPop) {
        const items = response.data.items || [];
        if (items.some(i => i.entityType === 'movie')) setActiveTab('movie');
        else if (items.some(i => i.entityType === 'cast')) setActiveTab('cast');
        else if (items.some(i => i.entityType === 'clip')) setActiveTab('clip');
        else setActiveTab('movie');
      }
    } catch (err) {
      console.error('Failed to load collection details:', err);
      setError('Could not load collection details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!colName.trim()) return;

    try {
      setError('');
      const response = await api.post('/collections', {
        name: colName.trim(),
        description: colDesc.trim(),
        coverImage: colCover.trim()
      });
      setCollections((prev) => [response.data, ...prev]);
      setShowCreateModal(false);
      resetForm();
      triggerSuccess('Collection created successfully!');
    } catch (err) {
      console.error('Failed to create collection:', err);
      setError(err.response?.data?.message || 'Failed to create collection.');
    }
  };

  const handleEditCollection = async (e) => {
    e.preventDefault();
    if (!colName.trim() || !selectedCol) return;

    try {
      setError('');
      const response = await api.put(`/collections/${selectedCol._id}`, {
        name: colName.trim(),
        description: colDesc.trim(),
        coverImage: colCover.trim()
      });
      
      // Update details view
      setSelectedCol(prev => ({
        ...prev,
        name: response.data.name,
        description: response.data.description,
        coverImage: response.data.coverImage
      }));

      // Update in main list
      setCollections(prev => prev.map(c => c._id === selectedCol._id ? response.data : c));
      setShowEditModal(false);
      resetForm();
      triggerSuccess('Collection updated successfully!');
    } catch (err) {
      console.error('Failed to update collection:', err);
      setError(err.response?.data?.message || 'Failed to update collection.');
    }
  };

  const handleDeleteCollection = async (id) => {
    if (!window.confirm('Are you sure you want to delete this collection? All saved links inside will be unsaved.')) {
      return;
    }

    try {
      setError('');
      await api.delete(`/collections/${id}`);
      setCollections((prev) => prev.filter((c) => c._id !== id));
      setSelectedCol(null);
      triggerSuccess('Collection deleted successfully!');
    } catch (err) {
      console.error('Failed to delete collection:', err);
      setError('Could not delete collection.');
    }
  };

  const handleRemoveItem = (entityId) => {
    setItemToRemove(entityId);
  };

  const executeRemoveItem = async (entityId) => {
    if (!selectedCol) return;

    try {
      setError('');
      await api.delete(`/collections/${selectedCol._id}/items/${entityId}`);
      
      // Update local detailed state
      setSelectedCol(prev => ({
        ...prev,
        items: prev.items.filter(item => item.entityId.toString() !== entityId.toString())
      }));

      // Update cached item counts in main lists
      setCollections(prev => prev.map(c => {
        if (c._id === selectedCol._id) {
          return {
            ...c,
            items: c.items.filter(item => item.entityId.toString() !== entityId.toString())
          };
        }
        return c;
      }));

      triggerSuccess('Item removed from collection.');
    } catch (err) {
      console.error('Failed to remove item from collection:', err);
      setError('Failed to remove item.');
    }
  };

  const triggerSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const resetForm = () => {
    setColName('');
    setColDesc('');
    setColCover('');
  };

  const openEditModal = () => {
    if (!selectedCol) return;
    setColName(selectedCol.name);
    setColDesc(selectedCol.description || '');
    setColCover(selectedCol.coverImage || '');
    setShowEditModal(true);
  };

  // Filter Items by activeTab and search
  const filteredItems = (() => {
    if (!selectedCol) return [];
    let items = selectedCol.items.filter(item => item.entityType === activeTab);
    if (itemSearchQuery) {
      const lowerQ = itemSearchQuery.toLowerCase();
      items = items.filter(item => {
        if (!item.details) return false;
        if (activeTab === 'movie') return item.details.title?.toLowerCase().includes(lowerQ);
        if (activeTab === 'cast') return item.details.name?.toLowerCase().includes(lowerQ);
        if (activeTab === 'clip') return item.details.title?.toLowerCase().includes(lowerQ);
        return false;
      });
    }
    return items;
  })();

  // Count helper
  const getTabCount = (type) => {
    if (!selectedCol) return 0;
    return selectedCol.items.filter(item => item.entityType === type).length;
  };

  if (loading) {
    return <div className="container loading flex-center">Loading your collections...</div>;
  }

  return (
    <div className="container collections-container">
      {/* Notifications */}
      {successMsg && (
        <div className="alert alert-success flex-center global-toast">
          <Check size={16} style={{ marginRight: '0.5rem' }} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error flex-center" style={{ margin: '1rem 0', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* DETAILED VIEW */}
      {selectedCol ? (
        <div className="collection-details-view animate-fade-in">
          {/* Back Action Bar */}
          <div className="details-header-bar flex-between">
            <button onClick={() => { setSelectedCol(null); setSelectedCollectionId(null); }} className="btn btn-secondary flex-center" style={{ gap: '0.5rem' }}>
              <ArrowLeft size={16} />
              <span>Back to Collections</span>
            </button>

            <div className="flex-center" style={{ gap: '0.75rem' }}>
              <button onClick={openEditModal} className="btn btn-secondary flex-center" style={{ gap: '0.375rem' }} title="Edit Info">
                <Edit3 size={14} />
                <span>Edit Info</span>
              </button>
              <button onClick={() => handleDeleteCollection(selectedCol._id)} className="btn btn-danger flex-center" style={{ gap: '0.375rem' }} title="Delete Collection">
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Banner Hero */}
          {(() => {
            let heroImage = selectedCol.coverImage;
            if (!heroImage && selectedCol.items && selectedCol.items.length > 0) {
              const firstItem = selectedCol.items[0].details;
              if (firstItem) {
                if (selectedCol.items[0].entityType === 'movie') heroImage = firstItem.posterUrl || (firstItem.posterPath ? `https://image.tmdb.org/t/p/w500${firstItem.posterPath}` : null);
                else if (selectedCol.items[0].entityType === 'cast') heroImage = firstItem.profileUrl || (firstItem.profilePath ? `https://image.tmdb.org/t/p/w500${firstItem.profilePath}` : null);
                else if (selectedCol.items[0].entityType === 'clip') heroImage = firstItem.thumbnailUrl;
              }
            }
            const bannerStyle = heroImage 
              ? { backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.85)), url(${heroImage})` }
              : { background: 'linear-gradient(135deg, var(--bg-tertiary), var(--accent-light))' };
              
            return (
              <div className="collection-banner flex-center" style={bannerStyle}>
                <div className="banner-content">
                  {!heroImage && <div className="banner-initial-icon flex-center">{selectedCol.name ? selectedCol.name.charAt(0).toUpperCase() : '?'}</div>}
                  <h1 className="banner-title" style={{ marginTop: !heroImage ? '1rem' : '0' }}>{selectedCol.name}</h1>
                  <p className="banner-desc">{selectedCol.description || 'No description provided.'}</p>
                  <span className="banner-count-tag">{selectedCol.items?.length || 0} items stored</span>
                </div>
              </div>
            );
          })()}

          {/* Tab Selector */}
          <div className="collections-tabs flex-center">
            <button 
              onClick={() => setActiveTab('movie')} 
              className={`col-tab-btn flex-center ${activeTab === 'movie' ? 'active' : ''}`}
            >
              <Film size={15} style={{ marginRight: '0.375rem' }} />
              <span>Movies & Shows ({getTabCount('movie')})</span>
            </button>
            <button 
              onClick={() => setActiveTab('cast')} 
              className={`col-tab-btn flex-center ${activeTab === 'cast' ? 'active' : ''}`}
            >
              <User size={15} style={{ marginRight: '0.375rem' }} />
              <span>Cast Profiles ({getTabCount('cast')})</span>
            </button>
            <button 
              onClick={() => setActiveTab('clip')} 
              className={`col-tab-btn flex-center ${activeTab === 'clip' ? 'active' : ''}`}
            >
              <Video size={15} style={{ marginRight: '0.375rem' }} />
              <span>Video Clips ({getTabCount('clip')})</span>
            </button>
          </div>

          <div className="search-box-row" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <input 
              type="text" 
              placeholder={`Search in ${activeTab}s...`} 
              value={itemSearchQuery}
              onChange={(e) => setItemSearchQuery(e.target.value)}
              className="form-input"
              style={{ maxWidth: '400px' }}
            />
          </div>

          {/* List of items under tab */}
          {detailLoading ? (
            <div className="flex-center" style={{ padding: '3rem' }}>Loading items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="collection-empty-tab flex-center">
              <h3>No items saved in this category</h3>
              <p>Go to your tracked lists or search detail pages to add titles/actors to this collection!</p>
            </div>
          ) : (() => {
            const totalItemPages = Math.ceil(filteredItems.length / 12);
            const paginatedItems = filteredItems.slice((itemPage - 1) * 12, itemPage * 12);
            
            return (
              <>
                <div className="grid-cards">
                  {paginatedItems.map((item) => (
                    <div key={item._id} className="collection-item-wrapper" style={{ position: 'relative' }}>
                      {/* Floating Remove Button */}
                      <button 
                        onClick={() => handleRemoveItem(item.entityId)}
                        className="col-item-remove-btn flex-center"
                        title="Remove from Collection"
                      >
                        <X size={14} />
                      </button>

                      {/* Render Component */}
                      {item.entityType === 'movie' && item.details && (
                        <MovieCard 
                          movie={item.details} 
                          onClick={(movie) => setSelectedCardId(movie._id || movie.refId)}
                          highlighted={(item.details._id || item.details.refId) === selectedCardId}
                        />
                      )}
                      {item.entityType === 'cast' && item.details && (
                        <CastCard 
                          cast={item.details} 
                          onClick={(cast) => setSelectedCardId(cast._id || cast.refId)}
                          highlighted={(item.details._id || item.details.refId) === selectedCardId}
                        />
                      )}
                      {item.entityType === 'clip' && item.details && (
                        <ClipCard clip={item.details} />
                      )}

                      {/* Deleted item placeholder */}
                      {!item.details && (
                        <div className="card deleted-item-card flex-center">
                          <AlertCircle size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                          <span className="deleted-title">Item Deleted</span>
                          <p>This item no longer exists in your catalog.</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination Footer */}
                {totalItemPages > 1 && (
                  <div className="pagination-container" style={{ marginTop: '2rem' }}>
                    <button 
                      onClick={() => setItemPage(prev => Math.max(prev - 1, 1))}
                      disabled={itemPage === 1}
                      className="pagination-btn"
                      title="Previous Page"
                    >
                      Prev
                    </button>
                    
                    {Array.from({ length: totalItemPages }, (_, i) => i + 1).map((p) => {
                      const isNearStart = itemPage <= 4;
                      const isNearEnd = itemPage >= totalItemPages - 3;
                      const showPage = p === 1 || p === totalItemPages || Math.abs(itemPage - p) <= 1;

                      if (!showPage) {
                        if ((p === 2 && !isNearStart) || (p === totalItemPages - 1 && !isNearEnd)) {
                          return <span key={p} className="pagination-info">...</span>;
                        }
                        return null;
                      }

                      return (
                        <button
                          key={p}
                          onClick={() => setItemPage(p)}
                          className={`pagination-btn ${itemPage === p ? 'active' : ''}`}
                        >
                          {p}
                        </button>
                      );
                    })}

                    <button 
                      onClick={() => setItemPage(prev => Math.min(prev + 1, totalItemPages))}
                      disabled={itemPage === totalItemPages}
                      className="pagination-btn"
                      title="Next Page"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        /* MAIN LIST VIEW */
        <div className="collections-list-view">
          <div className="collections-header flex-between">
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ margin: 0, padding: 0 }}>Your Collections</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.938rem', marginTop: '0.25rem' }}>
                Curate custom folders, thematic lists, and custom catalogs.
              </p>
            </div>
            <button 
              onClick={() => { resetForm(); setShowCreateModal(true); }} 
              className="btn btn-primary flex-center" 
              style={{ gap: '0.5rem' }}
            >
              <FolderPlus size={18} />
              <span>New Collection</span>
            </button>
          </div>

          <div className="search-box-row" style={{ marginBottom: '1.5rem', display: 'flex' }}>
            <input 
              type="text" 
              placeholder="Search collections..." 
              value={colSearchQuery}
              onChange={(e) => setColSearchQuery(e.target.value)}
              className="form-input"
              style={{ maxWidth: '400px' }}
            />
          </div>

          {collections.length === 0 ? (
            <div className="collections-empty-state flex-center">
              <FolderPlus size={48} className="empty-state-icon" />
              <h2>No collections created yet</h2>
              <p>Group together films, behind-the-scenes clips, and cast profiles into custom collections!</p>
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="btn btn-primary flex-center"
                style={{ marginTop: '1.5rem', gap: '0.5rem' }}
              >
                <Plus size={18} />
                <span>Create Collection</span>
              </button>
            </div>
          ) : (() => {
            const filteredCollections = collections.filter(c => c.name.toLowerCase().includes(colSearchQuery.toLowerCase()));
            
            if (filteredCollections.length === 0) {
              return (
                <div className="collections-empty-state flex-center">
                  <h2>No matching collections found.</h2>
                </div>
              );
            }
            
            const totalPages = Math.ceil(filteredCollections.length / 12);
            const paginatedCollections = filteredCollections.slice((currentPage - 1) * 12, currentPage * 12);
            
            return (
              <>
                <div className="grid-cards">
                  {paginatedCollections.map((col) => {
                    const count = col.items?.length || 0;
                    
                    let coverStyle = {};
                    if (col.coverImage) {
                      coverStyle = { backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.75)), url(${col.coverImage})` };
                    } else if (col.previewImage) {
                      coverStyle = { backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.75)), url(${col.previewImage})` };
                    }
                    
                    const firstLetter = col.name ? col.name.charAt(0).toUpperCase() : '?';

                    return (
                      <div 
                        key={col._id} 
                        className="card collection-card-preview"
                        onClick={() => fetchCollectionDetail(col._id)}
                      >
                        {col.coverImage || col.previewImage ? (
                          <div className="col-preview-banner" style={coverStyle}>
                            <span className="col-preview-badge">{count} items</span>
                          </div>
                        ) : (
                          <div className="col-preview-banner empty-cover flex-center" style={{ background: 'linear-gradient(135deg, var(--bg-tertiary), var(--accent-light))', display: 'flex', flexDirection: 'column' }}>
                            <span className="col-initial-placeholder" style={{ fontSize: '3rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)' }}>
                              {firstLetter}
                            </span>
                            <span className="col-preview-badge" style={{ position: 'absolute', top: '10px', right: '10px' }}>{count} items</span>
                          </div>
                        )}
                        <div className="card-content">
                          <h3 className="col-preview-name">{col.name}</h3>
                          <p className="col-preview-desc">{col.description || 'No description provided.'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Footer */}
                {totalPages > 1 && (
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
              </>
            );
          })()}
        </div>
      )}

      {/* CUSTOM CONFIRMATION POPUP FOR ITEM REMOVAL */}
      {itemToRemove && (
        <div className="dialog-backdrop flex-center" onClick={() => setItemToRemove(null)}>
          <div className="dialog-box text-center animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-icon-wrapper flex-center" style={{ backgroundColor: 'rgba(220, 38, 38, 0.12)' }}>
              <X size={30} style={{ color: 'var(--error-color)' }} />
            </div>
            <h3 className="dialog-title">Remove Item?</h3>
            <p className="dialog-message">
              Are you sure you want to remove this item from the collection?
            </p>
            <div className="flex-center" style={{ gap: '0.75rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, minHeight: '38px' }}
                onClick={() => setItemToRemove(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                style={{ flex: 1, minHeight: '38px' }}
                onClick={() => {
                  const id = itemToRemove;
                  setItemToRemove(null);
                  executeRemoveItem(id);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL POPUP */}
      {showCreateModal && (
        <div className="modal-backdrop flex-center" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header flex-between">
              <span className="modal-title">Create Collection</span>
              <button onClick={() => setShowCreateModal(false)} className="modal-close-btn flex-center">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCollection} className="modal-form">
              <div className="form-group">
                <label className="form-label">Collection Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Action Thrillers"
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  placeholder="Describe what goes into this collection..."
                  rows="2"
                  value={colDesc}
                  onChange={(e) => setColDesc(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Cover Image URL</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://example.com/image.jpg"
                  value={colCover}
                  onChange={(e) => setColCover(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', minHeight: '44px', marginTop: '1rem' }}>
                Create Collection
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL POPUP */}
      {showEditModal && (
        <div className="modal-backdrop flex-center" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header flex-between">
              <span className="modal-title">Edit Collection Information</span>
              <button onClick={() => setShowEditModal(false)} className="modal-close-btn flex-center">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditCollection} className="modal-form">
              <div className="form-group">
                <label className="form-label">Collection Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Action Thrillers"
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  placeholder="Describe what goes into this collection..."
                  rows="2"
                  value={colDesc}
                  onChange={(e) => setColDesc(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Cover Image URL</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://example.com/image.jpg"
                  value={colCover}
                  onChange={(e) => setColCover(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', minHeight: '44px', marginTop: '1rem' }}>
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collections;
