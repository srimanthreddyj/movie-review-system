import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Tag, Plus, Edit2, Trash2, Check, X, Shield, Star, Folder, Calendar, Info, Loader2 } from 'lucide-react';
import './Profile.css';

const PRESET_COLORS = [
  '#4f46e5', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#6b7280'  // Gray
];

const Profile = () => {
  const { user, refreshUser } = useAuth();
  
  // Tag Creation States
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  // Tag Editing States
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState('');

  // Stats States
  const [stats, setStats] = useState({
    favourites: 0,
    collections: 0,
    tags: 0
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchStats();
    // Refresh user profile metadata on mount
    refreshUser();
  }, []);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      setError('');
      const [favsRes, colRes] = await Promise.all([
        api.get('/favourites'),
        api.get('/collections')
      ]);

      const favs = favsRes.data || {};
      const totalFavs = (favs.movies?.length || 0) + (favs.cast?.length || 0) + (favs.clips?.length || 0);

      setStats({
        favourites: totalFavs,
        collections: colRes.data?.length || 0,
        tags: user?.tags?.length || 0
      });
    } catch (err) {
      console.error('Failed to load user profile statistics:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Sync stats when user profile tags list changes
  useEffect(() => {
    if (user?.tags) {
      setStats(prev => ({ ...prev, tags: user.tags.length }));
    }
  }, [user]);

  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setIsCreating(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/tags', {
        name: newTagName.trim(),
        color: newTagColor
      });
      setNewTagName('');
      setNewTagColor(PRESET_COLORS[0]);
      await refreshUser();
      triggerSuccess('Tag created successfully!');
    } catch (err) {
      console.error('Failed to create tag:', err);
      setError(err.response?.data?.message || 'Failed to create tag.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (tag) => {
    setEditingTagId(tag._id);
    setEditingTagName(tag.name);
    setEditingTagColor(tag.color);
  };

  const handleCancelEdit = () => {
    setEditingTagId(null);
    setEditingTagName('');
    setEditingTagColor('');
  };

  const handleUpdateTag = async (tagId) => {
    if (!editingTagName.trim()) return;

    setError('');
    setSuccess('');
    try {
      await api.put(`/tags/${tagId}`, {
        name: editingTagName.trim(),
        color: editingTagColor
      });
      setEditingTagId(null);
      await refreshUser();
      triggerSuccess('Tag updated successfully!');
    } catch (err) {
      console.error('Failed to update tag:', err);
      setError(err.response?.data?.message || 'Failed to update tag.');
    }
  };

  const handleDeleteTag = async (tagId, tagName) => {
    if (!window.confirm(`Are you sure you want to delete tag "${tagName}"? It will be unassigned from all items.`)) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      await api.delete(`/tags/${tagId}`);
      await refreshUser();
      triggerSuccess('Tag deleted successfully!');
    } catch (err) {
      console.error('Failed to delete tag:', err);
      setError('Failed to delete tag.');
    }
  };

  const triggerSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="container profile-page-container">
      {/* Messages */}
      {success && (
        <div className="alert alert-success flex-center" style={{ marginBottom: '1.5rem', justifyContent: 'flex-start', gap: '0.5rem' }}>
          <Check size={16} />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="alert alert-error flex-center" style={{ marginBottom: '1.5rem', justifyContent: 'flex-start', gap: '0.5rem' }}>
          <Info size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Account Hero Info */}
      <section className="profile-card-hero animate-fade-in">
        <div className="profile-hero-avatar">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-hero-details">
          <h1>{user.name}</h1>
          <p className="profile-hero-email">{user.email}</p>
          <span className={`profile-badge-role ${user.role}`}>
            {user.role === 'admin' ? 'Administrator' : 'User Account'}
          </span>
        </div>
        <div className="profile-hero-meta flex-center" style={{ gap: '0.25rem' }}>
          <Calendar size={12} />
          <span>Member since: {new Date(user.createdAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</span>
        </div>
      </section>

      {/* Statistics counters */}
      <section className="profile-stats-grid">
        <div className="profile-stat-box flex-center" style={{ flexDirection: 'column' }}>
          <Star className="profile-stat-icon" size={24} style={{ color: 'var(--accent-color)', marginBottom: '0.5rem', opacity: 0.8 }} />
          <span className="profile-stat-number">{loadingStats ? '...' : stats.favourites}</span>
          <span className="profile-stat-label">Favourites</span>
        </div>
        <div className="profile-stat-box flex-center" style={{ flexDirection: 'column' }}>
          <Folder className="profile-stat-icon" size={24} style={{ color: 'var(--accent-color)', marginBottom: '0.5rem', opacity: 0.8 }} />
          <span className="profile-stat-number">{loadingStats ? '...' : stats.collections}</span>
          <span className="profile-stat-label">Collections</span>
        </div>
        <div className="profile-stat-box flex-center" style={{ flexDirection: 'column' }}>
          <Tag className="profile-stat-icon" size={24} style={{ color: 'var(--accent-color)', marginBottom: '0.5rem', opacity: 0.8 }} />
          <span className="profile-stat-number">{stats.tags}</span>
          <span className="profile-stat-label">Custom Tags</span>
        </div>
      </section>

      {/* Tag Management */}
      <section className="tag-management-card animate-fade-in">
        <div className="tag-management-header">
          <h2 className="flex-center" style={{ gap: '0.5rem' }}>
            <Tag size={20} style={{ color: 'var(--accent-color)' }} />
            <span>Manage Catalog Tags</span>
          </h2>
          <span style={{ fontSize: '0.813rem', color: 'var(--text-muted)' }}>{user?.tags?.length || 0} active tags</span>
        </div>

        {/* Existing Tags List */}
        <div className="tags-list-container">
          {!user?.tags || user.tags.length === 0 ? (
            <div className="empty-tags-placeholder flex-center" style={{ flexDirection: 'column', gap: '0.5rem' }}>
              <Tag size={32} style={{ opacity: 0.4 }} />
              <p style={{ margin: 0 }}>You haven't created any tags yet.</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Create a tag below to group and label titles in your catalogue.</span>
            </div>
          ) : (
            user.tags.map((tag) => (
              <div key={tag._id} className="tag-edit-row">
                {editingTagId === tag._id ? (
                  /* Edit inline form */
                  <div className="tag-edit-form">
                    <input
                      type="text"
                      className="form-input tag-edit-input-field"
                      value={editingTagName}
                      onChange={(e) => setEditingTagName(e.target.value)}
                      placeholder="Tag Name"
                      style={{ minHeight: '38px' }}
                      required
                    />
                    
                    {/* Inline Swatches */}
                    <div className="color-presets-wrapper" style={{ margin: 0, alignItems: 'center' }}>
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditingTagColor(c)}
                          className={`color-preset-btn ${editingTagColor === c ? 'selected' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <div className="custom-color-input-container">
                        <input
                          type="color"
                          value={editingTagColor}
                          onChange={(e) => setEditingTagColor(e.target.value)}
                          className="custom-color-picker-input"
                          title="Custom Color Picker"
                        />
                      </div>
                    </div>

                    <div className="tag-actions-group">
                      <button 
                        onClick={() => handleUpdateTag(tag._id)} 
                        className="btn btn-sm btn-primary flex-center" 
                        style={{ minHeight: '34px', padding: '0 0.75rem', backgroundColor: 'var(--success-color)', borderColor: 'var(--success-color)' }}
                        title="Save Changes"
                      >
                        <Check size={14} style={{ marginRight: '0.25rem' }} />
                        <span>Save</span>
                      </button>
                      <button 
                        onClick={handleCancelEdit} 
                        className="btn btn-sm btn-secondary flex-center" 
                        style={{ minHeight: '34px', padding: '0 0.75rem' }}
                        title="Cancel"
                      >
                        <X size={14} style={{ marginRight: '0.25rem' }} />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Regular Tag Row display */
                  <>
                    <div className="tag-preview-group">
                      <span 
                        className="tag-pill-preview flex-center"
                        style={{ backgroundColor: tag.color + '15', borderColor: tag.color, color: tag.color }}
                      >
                        {tag.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Color: {tag.color}</span>
                    </div>

                    <div className="tag-actions-group">
                      <button 
                        onClick={() => handleStartEdit(tag)} 
                        className="btn btn-sm btn-secondary flex-center" 
                        style={{ minHeight: '34px', padding: '0 0.75rem' }}
                        title="Edit Tag"
                      >
                        <Edit2 size={12} style={{ marginRight: '0.25rem' }} />
                        <span>Edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteTag(tag._id, tag.name)} 
                        className="btn btn-sm btn-danger flex-center" 
                        style={{ minHeight: '34px', padding: '0 0.75rem', backgroundColor: 'var(--error-color)', borderColor: 'var(--error-color)' }}
                        title="Delete Tag"
                      >
                        <Trash2 size={12} style={{ marginRight: '0.25rem' }} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Create Tag Sub-Form */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }} className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.375rem' }}>
            <Plus size={16} />
            <span>Create New Custom Tag</span>
          </h3>

          <form onSubmit={handleCreateTag} className="flex" style={{ flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tag Name *</label>
              <input
                type="text"
                placeholder="e.g. Masterpiece, Recommended, Rewatch"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Choose Tag Label Color</label>
              <div className="color-presets-wrapper" style={{ alignItems: 'center' }}>
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className={`color-preset-btn ${newTagColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <div className="custom-color-input-container">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Custom:</span>
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="custom-color-picker-input"
                    title="Custom Color Picker"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreating || !newTagName.trim()}
              className="btn btn-primary flex-center"
              style={{ width: 'fit-content', padding: '0.5rem 1.5rem', minHeight: '40px', gap: '0.5rem', marginTop: '0.5rem' }}
            >
              {isCreating ? <Loader2 size={16} className="spinner" /> : <Plus size={16} />}
              <span>Create Tag</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default Profile;
