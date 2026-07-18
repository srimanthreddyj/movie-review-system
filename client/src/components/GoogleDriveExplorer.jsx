/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useState, useMemo } from 'react';
import { 
  Folder, File, FileText, Image as ImageIcon, Video, FileAudio, 
  ChevronRight, ChevronDown, Search, ArrowLeft, ArrowUpRight, Menu
} from 'lucide-react';
import FilePreviewModal from './FilePreviewModal';

const getFileIcon = (mimeType, size = 20) => {
  if (mimeType === 'application/vnd.google-apps.folder') return <Folder size={size} color="#facc15" />;
  if (mimeType.startsWith('image/')) return <ImageIcon size={size} color="#3b82f6" />;
  if (mimeType.startsWith('video/')) return <Video size={size} color="#ef4444" />;
  if (mimeType.startsWith('audio/')) return <FileAudio size={size} color="#10b981" />;
  if (mimeType.startsWith('text/') || mimeType === 'application/pdf' || mimeType.startsWith('application/vnd.google-apps.document')) return <FileText size={size} color="#8b5cf6" />;
  return <File size={size} color="#9ca3af" />;
};

const TreeNode = ({ node, onSelect, expandedFolders, toggleFolder }) => {
  const isFolder = node.type === 'folder';
  const isExpanded = expandedFolders.has(node.id);

  return (
    <div style={{ marginLeft: `${node.depth * 12}px` }}>
      <div 
        className="tree-node flex-center" 
        style={{ 
          justifyContent: 'flex-start', 
          padding: '0.25rem 0.5rem', 
          cursor: 'pointer',
          borderRadius: '4px',
          gap: '0.25rem',
          color: 'var(--text-secondary)'
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isFolder) {
            toggleFolder(node.id);
            onSelect(node);
          } else {
            onSelect(node);
          }
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{ width: '16px', display: 'flex', alignItems: 'center' }}>
          {isFolder && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </div>
        {getFileIcon(node.mimeType, 16)}
        <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.name}
        </span>
      </div>
      {isFolder && isExpanded && node.children && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} onSelect={onSelect} expandedFolders={expandedFolders} toggleFolder={toggleFolder} />
          ))}
        </div>
      )}
    </div>
  );
};

const GoogleDriveExplorer = ({ tree, onClose }) => {
  const [currentFolder, setCurrentFolder] = useState(tree);
  const [expandedFolders, setExpandedFolders] = useState(new Set([tree[0]?.id]));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreview, setSelectedPreview] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);

  const toggleFolder = (folderId) => {
    const newSet = new Set(expandedFolders);
    if (newSet.has(folderId)) newSet.delete(folderId);
    else newSet.add(folderId);
    setExpandedFolders(newSet);
  };

  const flattenTree = (nodes) => {
    let flat = [];
    nodes.forEach(n => {
      flat.push(n);
      if (n.children) flat = flat.concat(flattenTree(n.children));
    });
    return flat;
  };

  const allFiles = useMemo(() => flattenTree(tree), [tree]);

  const displayedItems = useMemo(() => {
    if (searchQuery) {
      return allFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()) && f.type !== 'folder');
    }
    // If not searching, just show current folder children. For root, it's tree itself. 
    // Wait, `tree` is array of root nodes.
    return currentFolder || tree;
  }, [currentFolder, tree, searchQuery, allFiles]);

  const handleSelectNode = (node) => {
    if (node.type === 'folder') {
      setCurrentFolder(node.children || []);
    } else {
      setSelectedPreview(node);
    }
  };

  return (
    <div className="drive-explorer" style={{ display: 'flex', flexDirection: 'column', height: '80vh', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
      <style>{`
        .drive-main-content {
          flex-direction: row;
        }
        .drive-sidebar {
          width: 250px;
          border-right: 1px solid var(--border-color);
          border-bottom: none;
        }
        .mobile-sidebar-toggle {
          display: none;
        }
        .mobile-sidebar-overlay {
          display: none;
        }
        @media (max-width: 768px) {
          .drive-explorer {
            height: 100dvh !important;
            width: 100vw !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 99999 !important;
            border-radius: 0 !important;
            border: none !important;
          }
          .drive-main-content {
            flex-direction: column;
            position: relative;
          }
          .drive-sidebar {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: 260px !important;
            z-index: 10;
            background-color: var(--bg-primary);
            box-shadow: 2px 0 8px rgba(0,0,0,0.5);
            transition: transform 0.3s ease;
            max-height: none;
            border-right: 1px solid var(--border-color) !important;
            border-bottom: none !important;
          }
          .drive-sidebar.hidden {
            transform: translateX(-100%);
            box-shadow: none;
          }
          .mobile-sidebar-toggle {
            display: flex;
          }
          .mobile-sidebar-overlay {
            display: block;
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0,0,0,0.5);
            z-index: 5;
          }
          .mobile-sidebar-overlay.hidden {
            display: none;
          }
          .drive-header-wrapper {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1rem !important;
          }
          .drive-header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
          }
          .drive-search-wrapper {
            width: 100% !important;
          }
          .drive-grid {
            padding: 1rem !important;
          }
          .file-card {
             padding: 0.75rem !important;
          }
          .hide-on-mobile {
            display: none;
          }
        }
      `}</style>
      {/* Header */}
      <div className="drive-header drive-header-wrapper flex-between" style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="drive-header-top">
          <div className="flex-center" style={{ gap: '0.75rem' }}>
            <button onClick={onClose} className="btn flex-center" style={{ gap: '0.25rem', padding: '0.35rem 0.6rem' }}>
              <ArrowLeft size={16} /> <span className="hide-on-mobile">Exit</span>
            </button>
            <button onClick={() => setShowSidebar(!showSidebar)} className="btn flex-center mobile-sidebar-toggle" style={{ padding: '0.35rem 0.6rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
              <Menu size={16} />
            </button>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Drive Explorer</h3>
          </div>
        </div>
        <div className="search-bar-container drive-search-wrapper" style={{ margin: 0, width: '300px' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem', paddingRight: '1rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', minHeight: '32px' }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="drive-main-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className={`mobile-sidebar-overlay ${!showSidebar ? 'hidden' : ''}`} onClick={() => setShowSidebar(false)} />
        {/* Sidebar Tree */}
        <div className={`drive-sidebar ${!showSidebar ? 'hidden' : ''}`} style={{ overflowY: 'auto', padding: '1rem', backgroundColor: 'var(--bg-tertiary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Folders</div>
          {tree.map(node => (
            <TreeNode 
              key={node.id} 
              node={node} 
              onSelect={handleSelectNode} 
              expandedFolders={expandedFolders} 
              toggleFolder={toggleFolder} 
            />
          ))}
        </div>

        {/* File Grid */}
        <div className="drive-grid" style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
          {!searchQuery && currentFolder !== tree && (
            <div style={{ marginBottom: '1rem' }}>
              <button 
                className="btn flex-center" 
                style={{ gap: '0.5rem', padding: '0.5rem', backgroundColor: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
                onClick={() => setCurrentFolder(tree)} // naive back to root for demo
              >
                <ArrowUpRight size={16} /> Back to Root
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
            {displayedItems.map(item => (
              <div 
                key={item.id} 
                className="file-card flex-center" 
                style={{ 
                  flexDirection: 'column', 
                  padding: '1rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-secondary)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  textAlign: 'center',
                  minWidth: 0
                }}
                onClick={() => handleSelectNode(item)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center', width: '100%' }}>
                  {item.thumbnailLink ? (
                    <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <img 
                        src={item.thumbnailLink.replace(/=s\d+/, '=s400')} 
                        alt={item.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                      <div style={{ display: 'none' }}>
                        {getFileIcon(item.mimeType, 32)}
                      </div>
                    </div>
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {getFileIcon(item.mimeType, 32)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: '500', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                  {item.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {item.type === 'folder' ? 'Folder' : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
                </div>
              </div>
            ))}
          </div>

          {displayedItems.length === 0 && (
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>
              No files found.
            </div>
          )}
        </div>
      </div>

      {selectedPreview && (
        <FilePreviewModal file={selectedPreview} onClose={() => setSelectedPreview(null)} />
      )}
    </div>
  );
};

export default GoogleDriveExplorer;
