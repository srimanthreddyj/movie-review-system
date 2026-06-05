import React, { useState, useEffect } from 'react';
import { X, Plus, FolderPlus, Check, AlertCircle } from 'lucide-react';
import api from '../services/api';

const AddToCollectionModal = ({ isOpen, onClose, entityType, entityId }) => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
    }
  }, [isOpen, entityId]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const res = await api.get('/collections');
      setCollections(res.data);
      setActionError('');
    } catch (err) {
      console.error('Failed to fetch collections', err);
      setActionError('Could not load collections.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    try {
      setActionError('');
      const res = await api.post('/collections', {
        name: newColName.trim(),
        description: newColDesc.trim(),
        coverImage: ''
      });
      
      // Add newly created collection to list
      setCollections((prev) => [res.data, ...prev]);
      setNewColName('');
      setNewColDesc('');
      setShowCreateForm(false);
      setActionSuccess('Collection created successfully!');
      setTimeout(() => setActionSuccess(''), 2000);
    } catch (err) {
      console.error('Failed to create collection', err);
      setActionError(err.response?.data?.message || 'Failed to create collection.');
    }
  };

  const handleAddToCollection = async (colId) => {
    try {
      setActionError('');
      await api.post(`/collections/${colId}/items`, {
        entityType,
        entityId
      });
      
      // Update local state to show item was added
      setCollections((prev) =>
        prev.map((c) => {
          if (c._id === colId) {
            return {
              ...c,
              items: [...c.items, { entityType, entityId }]
            };
          }
          return c;
        })
      );
      setActionSuccess('Added to collection!');
      setTimeout(() => setActionSuccess(''), 2000);
    } catch (err) {
      console.error('Failed to add to collection', err);
      setActionError(err.response?.data?.message || 'Failed to add item.');
    }
  };

  const handleRemoveFromCollection = async (colId) => {
    try {
      setActionError('');
      await api.delete(`/collections/${colId}/items/${entityId}`);
      
      // Update local state to show item was removed
      setCollections((prev) =>
        prev.map((c) => {
          if (c._id === colId) {
            return {
              ...c,
              items: c.items.filter((item) => item.entityId.toString() !== entityId.toString())
            };
          }
          return c;
        })
      );
      setActionSuccess('Removed from collection.');
      setTimeout(() => setActionSuccess(''), 2000);
    } catch (err) {
      console.error('Failed to remove from collection', err);
      setActionError(err.response?.data?.message || 'Failed to remove item.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop flex-center" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="modal-content collection-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header flex-between">
          <span className="modal-title">Save to Collection</span>
          <button onClick={onClose} className="modal-close-btn flex-center">
            <X size={20} />
          </button>
        </div>

        {actionError && (
          <div className="alert alert-error flex-center" style={{ margin: '1rem', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="alert alert-success flex-center" style={{ margin: '1rem', gap: '0.5rem' }}>
            <Check size={16} />
            <span>{actionSuccess}</span>
          </div>
        )}

        <div className="modal-body" style={{ padding: '1rem' }}>
          {loading ? (
            <div className="flex-center" style={{ padding: '2rem' }}>Loading collections...</div>
          ) : (
            <div className="collections-selector-list">
              {collections.length === 0 ? (
                <p className="no-collections-text" style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: '1rem 0' }}>
                  No collections created yet.
                </p>
              ) : (
                <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '1rem' }}>
                  {collections.map((col) => {
                    const isAdded = col.items.some(
                      (item) => item.entityId.toString() === entityId.toString() && item.entityType === entityType
                    );

                    return (
                      <div 
                        key={col._id} 
                        className="collection-select-row flex-between"
                        style={{
                          padding: '0.75rem',
                          borderBottom: '1px solid var(--border-color)',
                          gap: '1rem'
                        }}
                      >
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{col.name}</div>
                          {col.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{col.description}</div>
                          )}
                        </div>

                        {isAdded ? (
                          <button 
                            className="btn btn-sm btn-success flex-center" 
                            style={{ gap: '0.25rem', minWidth: '90px' }}
                            onClick={() => handleRemoveFromCollection(col._id)}
                          >
                            <Check size={14} />
                            <span>Saved</span>
                          </button>
                        ) : (
                          <button 
                            className="btn btn-sm flex-center" 
                            style={{ gap: '0.25rem', minWidth: '90px' }}
                            onClick={() => handleAddToCollection(col._id)}
                          >
                            <Plus size={14} />
                            <span>Save</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Toggle Create Form */}
          {!showCreateForm ? (
            <button 
              className="btn btn-secondary flex-center" 
              style={{ width: '100%', gap: '0.5rem', marginTop: '0.5rem' }}
              onClick={() => setShowCreateForm(true)}
            >
              <FolderPlus size={18} />
              <span>Create New Collection</span>
            </button>
          ) : (
            <form onSubmit={handleCreateCollection} style={{ marginTop: '1rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ fontSize: '0.813rem' }}>Collection Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. My Favourites 2026"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.813rem' }}>Description</label>
                <textarea 
                  className="form-input" 
                  placeholder="What's this collection about..."
                  rows="2"
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                />
              </div>
              <div className="flex-center" style={{ gap: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                >
                  Create
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .collection-modal-content {
          max-width: 450px !important;
          width: 90%;
        }
        .collection-select-row:last-child {
          border-bottom: none;
        }
        .btn-success {
          background-color: #10b981 !important;
          color: #ffffff !important;
        }
        .btn-success:hover {
          background-color: #059669 !important;
        }
      `}</style>
    </div>
  );
};

export default AddToCollectionModal;
