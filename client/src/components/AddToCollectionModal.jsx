import React, { useState, useEffect } from 'react';
import { X, Plus, FolderPlus, Check, AlertCircle } from 'lucide-react';
import api from '../services/api';

const AddToCollectionModal = ({ isOpen, onClose, entityType, entityId }) => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColCover, setNewColCover] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [dialogInfo, setDialogInfo] = useState(null); // { type: 'success' | 'error', title: '...', message: '...' }

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
      setDialogInfo(null); // Reset any stale dialog on open
    }
  }, [isOpen, entityId]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const res = await api.get('/collections');
      setCollections(res.data);
    } catch (err) {
      console.error('Failed to fetch collections', err);
      setDialogInfo({
        type: 'error',
        title: 'Error Loading Collections',
        message: 'Could not load your collections. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    try {
      const res = await api.post('/collections', {
        name: newColName.trim(),
        description: newColDesc.trim(),
        coverImage: newColCover.trim()
      });
      
      // Add newly created collection to list
      setCollections((prev) => [res.data, ...prev]);
      setNewColName('');
      setNewColDesc('');
      setNewColCover('');
      setShowCreateForm(false);

      // Trigger custom success dialog box
      setDialogInfo({
        type: 'success',
        title: 'Collection Created!',
        message: `Collection "${res.data.name}" has been created successfully.`
      });
    } catch (err) {
      console.error('Failed to create collection', err);
      setDialogInfo({
        type: 'error',
        title: 'Create Failed',
        message: err.response?.data?.message || 'Failed to create collection.'
      });
    }
  };

  const handleAddToCollection = async (colId, colName) => {
    try {
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

      // Trigger custom success dialog box — clicking OK will close the whole modal
      setDialogInfo({
        type: 'success',
        title: 'Saved to Collection',
        message: `Successfully saved item to "${colName}".`,
        closeOnOk: true
      });
    } catch (err) {
      console.error('Failed to add to collection', err);
      setDialogInfo({
        type: 'error',
        title: 'Save Failed',
        message: err.response?.data?.message || 'Failed to add item.'
      });
    }
  };

  const handleRemoveFromCollection = async (colId, colName) => {
    try {
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

      // Trigger custom success dialog box
      setDialogInfo({
        type: 'success',
        title: 'Removed from Collection',
        message: `Successfully removed item from "${colName}".`
      });
    } catch (err) {
      console.error('Failed to remove from collection', err);
      setDialogInfo({
        type: 'error',
        title: 'Remove Failed',
        message: err.response?.data?.message || 'Failed to remove item.'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Main Save to Collection Dialog */}
      <div className="modal-backdrop flex-center" style={{ zIndex: 1100 }} onClick={onClose}>
        <div className="modal-content collection-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header flex-between">
            <span className="modal-title">Save to Collection</span>
            <button onClick={onClose} className="modal-close-btn flex-center">
              <X size={20} />
            </button>
          </div>

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
                              onClick={() => handleRemoveFromCollection(col._id, col.name)}
                            >
                              <Check size={14} />
                              <span>Saved</span>
                            </button>
                          ) : (
                            <button 
                              className="btn btn-sm flex-center" 
                              style={{ gap: '0.25rem', minWidth: '90px' }}
                              onClick={() => handleAddToCollection(col._id, col.name)}
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

            <button 
              className="btn btn-secondary flex-center" 
              style={{ width: '100%', gap: '0.5rem', marginTop: '0.5rem' }}
              onClick={() => setShowCreateForm(true)}
            >
              <FolderPlus size={18} />
              <span>Create New Collection</span>
            </button>
          </div>
        </div>
      </div>

      {/* CREATE COLLECTION NESTED DIALOG */}
      {showCreateForm && (
        <div className="modal-backdrop flex-center" style={{ zIndex: 1150 }} onClick={() => setShowCreateForm(false)}>
          <div className="modal-content collection-modal-content animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header flex-between">
              <span className="modal-title">Create Collection</span>
              <button onClick={() => setShowCreateForm(false)} className="modal-close-btn flex-center">
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
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  placeholder="Describe what goes into this collection..."
                  rows="2"
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Cover Image URL</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://example.com/image.jpg"
                  value={newColCover}
                  onChange={(e) => setNewColCover(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', minHeight: '44px', marginTop: '1rem' }}>
                Create Collection
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION/STATUS DIALOG POPUP */}
      {dialogInfo && (
        <div className="dialog-backdrop flex-center" style={{ zIndex: 1200 }} onClick={() => setDialogInfo(null)}>
          <div className="dialog-box text-center" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-icon-wrapper flex-center">
              {dialogInfo.type === 'success' ? (
                <Check size={32} className="text-success-icon" />
              ) : (
                <AlertCircle size={32} className="text-error-icon" />
              )}
            </div>
            <h3 className="dialog-title">{dialogInfo.title}</h3>
            <p className="dialog-message">{dialogInfo.message}</p>
            <button className="btn btn-primary dialog-btn" onClick={() => {
              setDialogInfo(null);
              if (dialogInfo?.closeOnOk) onClose();
            }}>
              OK
            </button>
          </div>
        </div>
      )}

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
        
        /* Dialog Box Styling */
        .dialog-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dialog-box {
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 2rem;
          width: 90%;
          max-width: 380px;
          box-shadow: var(--shadow-lg);
          animation: scaleIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .dialog-icon-wrapper {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          margin: 0 auto 1.25rem auto;
        }
        .dialog-icon-wrapper:has(.text-success-icon) {
          background-color: rgba(16, 185, 129, 0.12);
        }
        .dialog-icon-wrapper:has(.text-error-icon) {
          background-color: rgba(220, 38, 38, 0.12);
        }
        .text-success-icon {
          color: #10b981;
        }
        .text-error-icon {
          color: #dc2626;
        }
        .dialog-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }
        .dialog-message {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }
        .dialog-btn {
          width: 100%;
          min-height: 38px;
        }
        
        @keyframes scaleIn {
          from {
            transform: scale(0.92);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default AddToCollectionModal;
