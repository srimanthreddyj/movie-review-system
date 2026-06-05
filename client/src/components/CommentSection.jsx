import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { MessageSquare, Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';

const CommentSection = ({ entityType, entityId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newText, setNewText] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const MAX_CHARS = 1000;

  useEffect(() => {
    fetchComments();
  }, [entityId, entityType]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/comments?entityType=${entityType}&entityId=${entityId}`);
      setComments(response.data);
    } catch (err) {
      console.error('Failed to load private notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newText.trim()) return;
    if (newText.length > MAX_CHARS) {
      setError(`Your note cannot exceed ${MAX_CHARS} characters.`);
      return;
    }

    setError('');
    try {
      const response = await api.post('/comments', {
        entityType,
        entityId,
        text: newText
      });
      setComments((prev) => [response.data, ...prev]);
      setNewText('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save note.');
    }
  };

  const handleUpdateComment = async (id) => {
    if (!editingText.trim()) return;
    if (editingText.length > MAX_CHARS) {
      setError(`Your note cannot exceed ${MAX_CHARS} characters.`);
      return;
    }

    setError('');
    try {
      const response = await api.put(`/comments/${id}`, { text: editingText });
      setComments((prev) =>
        prev.map((c) => (c._id === id ? { ...c, text: response.data.text } : c))
      );
      setEditingId(null);
      setEditingText('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update note.');
    }
  };

  const handleDeleteComment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this private note?')) return;
    try {
      await api.delete(`/comments/${id}`);
      setComments((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete note.');
    }
  };

  const startEditing = (comment) => {
    setEditingId(comment._id);
    setEditingText(comment.text);
    setError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingText('');
    setError('');
  };

  return (
    <div className="comment-section">
      <h3 className="section-title flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', marginBottom: '1rem' }}>
        <MessageSquare size={18} />
        <span>Private Personal Notes</span>
      </h3>

      <p className="section-subtitle">
        These notes are completely private and only visible to you.
      </p>

      {error && (
        <div className="alert alert-error flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Add Comment Form */}
      <form onSubmit={handleAddComment} className="comment-form">
        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
          <textarea
            className="form-input comment-textarea"
            placeholder="Type your personal thoughts, reviews, or logs here..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows="3"
            maxLength={MAX_CHARS}
          />
        </div>
        <div className="form-footer flex-between">
          <span className={`char-counter ${newText.length > MAX_CHARS ? 'text-danger' : ''}`}>
            {newText.length} / {MAX_CHARS} characters
          </span>
          <button 
            type="submit" 
            disabled={!newText.trim() || newText.length > MAX_CHARS} 
            className="btn btn-primary"
          >
            Save Note
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="comments-list">
        {loading && comments.length === 0 ? (
          <div className="comments-loading">Loading notes...</div>
        ) : comments.length === 0 ? (
          <div className="comments-empty">
            No private notes yet. Write your first thoughts above!
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment._id} className="comment-item">
              {editingId === comment._id ? (
                /* Edit Mode */
                <div className="comment-edit-mode">
                  <textarea
                    className="form-input comment-textarea"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows="3"
                    maxLength={MAX_CHARS}
                  />
                  <div className="form-footer flex-between" style={{ marginTop: '0.5rem' }}>
                    <span className={`char-counter ${editingText.length > MAX_CHARS ? 'text-danger' : ''}`}>
                      {editingText.length} / {MAX_CHARS} characters
                    </span>
                    <div className="edit-actions flex-center" style={{ gap: '0.5rem' }}>
                      <button 
                        type="button" 
                        onClick={() => handleUpdateComment(comment._id)}
                        disabled={!editingText.trim() || editingText.length > MAX_CHARS}
                        className="btn btn-primary btn-sm flex-center"
                      >
                        <Check size={14} style={{ marginRight: '0.25rem' }} />
                        Save
                      </button>
                      <button 
                        type="button" 
                        onClick={cancelEditing} 
                        className="btn btn-sm flex-center"
                      >
                        <X size={14} style={{ marginRight: '0.25rem' }} />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  <div className="comment-header flex-between">
                    <span className="comment-date">
                      {new Date(comment.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <div className="comment-item-actions flex-center">
                      <button 
                        onClick={() => startEditing(comment)} 
                        className="comment-icon-btn flex-center"
                        title="Edit Note"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        onClick={() => handleDeleteComment(comment._id)} 
                        className="comment-icon-btn delete-icon flex-center"
                        title="Delete Note"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="comment-body">
                    {comment.text}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        .comment-section {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 1.5rem;
          margin-top: 2rem;
          text-align: left;
        }
        .section-subtitle {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 1.25rem;
        }
        .comment-form {
          margin-bottom: 2rem;
        }
        .comment-textarea {
          resize: vertical;
          min-height: 80px;
          line-height: 1.4;
          font-family: inherit;
        }
        .form-footer {
          margin-top: 0.5rem;
        }
        .char-counter {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .comments-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .comments-loading, .comments-empty {
          text-align: center;
          padding: 1.5rem;
          color: var(--text-muted);
          font-size: 0.875rem;
          border: 1px dashed var(--border-color);
          border-radius: var(--border-radius);
        }
        .comment-item {
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 1rem;
          transition: border-color var(--transition-speed);
        }
        .comment-item:hover {
          border-color: var(--text-muted);
        }
        .comment-header {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
          padding-bottom: 0.25rem;
          border-bottom: 1px dashed var(--border-color);
        }
        .comment-item-actions {
          gap: 0.375rem;
        }
        .comment-icon-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          transition: background-color var(--transition-speed), color var(--transition-speed);
        }
        .comment-icon-btn:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .comment-icon-btn.delete-icon:hover {
          color: var(--error-color);
          background-color: rgba(220, 38, 38, 0.08);
        }
        .comment-body {
          font-size: 0.875rem;
          color: var(--text-primary);
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};

export default CommentSection;
