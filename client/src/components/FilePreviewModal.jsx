import { useState, useEffect } from 'react';
import { X, Download, AlertCircle, Plus, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import api, { getBaseURL } from '../services/api';

const FilePreviewModal = ({ file, onClose }) => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addedToClips, setAddedToClips] = useState(false);
  const [addingToClips, setAddingToClips] = useState(false);

  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isPdf = file.mimeType === 'application/pdf';
  const isText = file.mimeType.startsWith('text/') || file.mimeType === 'application/json';
  const isMarkdown = file.name.endsWith('.md');
  const isGoogleDoc = file.mimeType.startsWith('application/vnd.google-apps.');

  const handleAddToClips = async () => {
    setAddingToClips(true);
    try {
      const driveUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
      const thumb = file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+/, '=s800') : '';
      await api.post('/clips', {
        title: file.name,
        url: driveUrl,
        clipType: 'other',
        thumbnailUrl: thumb
      });
      setAddedToClips(true);
    } catch (err) {
      console.error('Failed to add Google Drive video to clips:', err);
      alert(err.response?.data?.message || 'Failed to add clip.');
    } finally {
      setAddingToClips(false);
    }
  };

  useEffect(() => {
    if (isText || isMarkdown) {
      setLoading(true);
      fetch(file.webContentLink)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch text content');
          return res.text();
        })
        .then(text => setContent(text))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [file]);

  const renderContent = () => {
    if (isImage) {
      return (
        <img 
          src={file.webContentLink || file.webViewLink} 
          alt={file.name} 
          style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
        />
      );
    }

    if (isVideo) {
      const baseURL = getBaseURL();
      const streamUrl = `${baseURL}/cliproom/stream/${file.id}`;
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
          <video 
            controls 
            playsInline 
            style={{ width: '100%', maxHeight: '100%', objectFit: 'contain' }}
          >
            <source src={streamUrl} type={file.mimeType} />
            Your browser does not support the video element.
          </video>
        </div>
      );
    }

    if (isPdf || isGoogleDoc) {
      // Use iframe to show webViewLink (Google's native preview player)
      // Construct the preview URL explicitly using the file ID to avoid framing errors
      const previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', textAlign: 'center', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
            Cannot view full screen? <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'underline', marginLeft: '0.5rem', fontWeight: '500' }}>Open directly in Google Drive</a>
          </div>
          <iframe 
            className="preview-iframe"
            src={previewUrl} 
            title={file.name}
            style={{ width: '100%', flex: 1, border: 'none' }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            webkitallowfullscreen="true"
            mozallowfullscreen="true"
          />
        </div>
      );
    }
    if (isAudio) {
      return (
        <audio controls style={{ width: '100%' }}>
          <source src={file.webContentLink} type={file.mimeType} />
          Your browser does not support the audio element.
        </audio>
      );
    }

    if (isText || isMarkdown) {
      if (loading) return <div className="flex-center" style={{ height: '50vh' }}>Loading text...</div>;
      if (error) return <div className="alert alert-error">{error}</div>;
      
      if (isMarkdown) {
        return (
          <div style={{ padding: '2rem', textAlign: 'left', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', overflowY: 'auto', maxHeight: '80vh' }}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        );
      }

      return (
        <pre style={{ padding: '2rem', textAlign: 'left', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', overflowY: 'auto', maxHeight: '80vh', whiteSpace: 'pre-wrap' }}>
          {content}
        </pre>
      );
    }

    return (
      <div className="flex-center" style={{ flexDirection: 'column', gap: '1rem', height: '50vh' }}>
        <AlertCircle size={48} color="var(--text-muted)" />
        <p>No preview available for this file type.</p>
        <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          Open in Google Drive
        </a>
      </div>
    );
  };

  return (
    <div className="modal-backdrop flex-center" onClick={onClose} style={{ zIndex: 10000 }}>
      <style>{`
        .preview-modal-content {
          width: 90%;
          max-width: 1200px;
          border-radius: 8px;
        }
        .preview-iframe {
          height: 80dvh;
        }
        .preview-modal-body {
          padding: 0;
          background-color: #000;
        }
        @media (max-width: 768px) {
          .preview-modal-content {
            width: 100%;
            height: 100%;
            max-width: none;
            border-radius: 0;
            display: flex;
            flex-direction: column;
          }
          .preview-modal-body {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            background-color: #000;
            width: 100%;
          }
          .preview-iframe {
            width: 100%;
            height: 100%;
            min-height: 100%;
          }
        }
      `}</style>
      <div className="modal-content preview-modal-content" onClick={e => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden' }}>
        <div className="modal-header flex-between" style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
            <span className="modal-title" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{file.name}</span>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.createdTime).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            {isVideo && (
              <button 
                onClick={handleAddToClips} 
                disabled={addingToClips || addedToClips} 
                className={`btn ${addedToClips ? 'btn-secondary' : 'btn-primary'} flex-center`} 
                style={{ padding: '0.35rem 0.75rem', gap: '0.35rem', fontSize: '0.8rem' }}
                title="Save Video to Clips Catalogue"
              >
                {addedToClips ? <Check size={16} /> : <Plus size={16} />}
                <span>{addedToClips ? 'Added to Clips' : 'Add to Clips'}</span>
              </button>
            )}
            {file.webContentLink && (
              <a href={file.webContentLink} target="_blank" rel="noopener noreferrer" className="btn flex-center" style={{ padding: '0.5rem' }} title="Download">
                <Download size={18} />
              </a>
            )}
            <button onClick={onClose} className="modal-close-btn flex-center" style={{ padding: '0.5rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="modal-body preview-modal-body">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
