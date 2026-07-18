import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const FilePreviewModal = ({ file, onClose }) => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isPdf = file.mimeType === 'application/pdf';
  const isText = file.mimeType.startsWith('text/') || file.mimeType === 'application/json';
  const isMarkdown = file.name.endsWith('.md');
  const isGoogleDoc = file.mimeType.startsWith('application/vnd.google-apps.');

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

    if (isVideo || isPdf || isGoogleDoc) {
      // Use iframe to show webViewLink (Google's native preview player)
      // Construct the preview URL explicitly using the file ID to avoid framing errors
      const previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      
      return (
        <iframe 
          className="preview-iframe"
          src={previewUrl} 
          title={file.name}
          style={{ width: '100%', border: 'none' }}
          allow="autoplay; fullscreen"
        />
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
          height: 80vh;
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
          }
          .preview-iframe {
            height: 100%;
            min-height: 50vh;
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
