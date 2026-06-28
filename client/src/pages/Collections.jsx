import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, Trash2, FolderPlus, Plus, X, Film, User, 
  Video, Edit3, AlertCircle, Check, FolderOpen 
} from 'lucide-react';
import api from '../services/api';
import MovieCard from '../components/MovieCard';
import CastCard from '../components/CastCard';
import ClipCard from '../components/ClipCard';
import './Collections.css';

const Collections = () => {
  const [collections, setCollections] = useState([]);
  const [selectedCol, setSelectedCol] = useState(null);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Tab State for Detail View
  const [activeTab, setActiveTab] = useState('movie'); // 'movie' | 'cast' | 'clip'

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form Fields
  const [colName, setColName] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colCover, setColCover] = useState('');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);

  // Reset item page when active collection or tab changes
  useEffect(() => {
    setItemPage(1);
  }, [selectedCol?._id, activeTab]);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/collections');
      setCollections(response.data);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to load collections:', err);
      setError('Could not load collections catalogue.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectionDetail = async (id) => {
    try {
      setDetailLoading(true);
      setError('');
      const response = await api.get(`/collections/${id}`);
      setSelectedCol(response.data);
      // Automatically focus first tab that has items, or default to movie
      const items = response.data.items || [];
      if (items.some(i => i.entityType === 'movie')) setActiveTab('movie');
      else if (items.some(i => i.entityType === 'cast')) setActiveTab('cast');
      else if (items.some(i => i.entityType === 'clip')) setActiveTab('clip');
      else setActiveTab('movie');
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

  const handleRemoveItem = async (entityId) => {
    if (!selectedCol) return;
    if (!window.confirm('Are you sure you want to remove this item from the collection?')) return;

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

  // Filter Items by activeTab
  const filteredItems = selectedCol 
    ? selectedCol.items.filter(item => item.entityType === activeTab)
    : [];

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
            <button onClick={() => setSelectedCol(null)} className="btn btn-secondary flex-center" style={{ gap: '0.5rem' }}>
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
          <div className="collection-banner flex-center" style={{
            backgroundImage: selectedCol.coverImage ? `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.85)), url(${selectedCol.coverImage})` : 'linear-gradient(135deg, var(--bg-tertiary), var(--accent-light))'
          }}>
            <div className="banner-content">
              <FolderOpen size={48} className="banner-folder-icon" />
              <h1 className="banner-title">{selectedCol.name}</h1>
              <p className="banner-desc">{selectedCol.description || 'No description provided.'}</p>
              <span className="banner-count-tag">{selectedCol.items?.length || 0} items stored</span>
            </div>
          </div>

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
                        <MovieCard movie={item.details} />
                      )}
                      {item.entityType === 'cast' && item.details && (
                        <CastCard cast={item.details} />
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
            const totalPages = Math.ceil(collections.length / 12);
            const paginatedCollections = collections.slice((currentPage - 1) * 12, currentPage * 12);
            
            return (
              <>
                <div className="grid-cards">
                  {paginatedCollections.map((col) => {
                    const count = col.items?.length || 0;
                    const coverStyle = col.coverImage 
                      ? { backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.75)), url(${col.coverImage})` }
                      : { background: 'linear-gradient(135deg, var(--bg-tertiary), var(--accent-light))' };

                    return (
                      <div 
                        key={col._id} 
                        className="card collection-card-preview"
                        onClick={() => fetchCollectionDetail(col._id)}
                      >
                        <div className="col-preview-banner" style={coverStyle}>
                          <span className="col-preview-badge">{count} items</span>
                        </div>
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
