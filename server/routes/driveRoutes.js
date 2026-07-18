const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

const extractFolderId = (url) => {
  const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  const matchId = url.match(/id=([a-zA-Z0-9-_]+)/);
  return matchId ? matchId[1] : null;
};

router.post('/import-drive-folder', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });
    
    const folderId = extractFolderId(url);
    if (!folderId) return res.status(400).json({ message: 'Invalid Google Drive folder URL' });

    if (!process.env.GOOGLE_DRIVE_API_KEY) {
      return res.status(500).json({ message: 'Google Drive API key not configured on server' });
    }

    const drive = google.drive({ version: 'v3', auth: process.env.GOOGLE_DRIVE_API_KEY });

    // Verify folder
    try {
      const folderMeta = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, mimeType',
      });
      if (folderMeta.data.mimeType !== 'application/vnd.google-apps.folder') {
        return res.status(400).json({ message: 'URL does not point to a folder' });
      }
    } catch (e) {
      console.error('Drive API meta fetch error:', e.message);
      return res.status(404).json({ message: 'Folder not found or not accessible. Ensure the link is public.' });
    }

    // Recursively fetch
    const fetchFiles = async (parentId, currentDepth = 0) => {
      // Prevent infinite loops or extremely deep nested structures exceeding rate limits
      if (currentDepth > 10) return [];
      
      let items = [];
      let pageToken = null;
      do {
        const response = await drive.files.list({
          q: `'${parentId}' in parents and trashed=false`,
          fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, hasThumbnail, webViewLink, webContentLink, parents)',
          pageToken: pageToken,
          pageSize: 1000 // max page size
        });
        
        for (const file of response.data.files) {
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            const children = await fetchFiles(file.id, currentDepth + 1);
            items.push({ ...file, children, type: 'folder', depth: currentDepth + 1 });
          } else {
            items.push({ ...file, type: 'file', depth: currentDepth + 1 });
          }
        }
        pageToken = response.data.nextPageToken;
      } while (pageToken);
      return items;
    };

    const tree = await fetchFiles(folderId);
    
    res.json({
      folderId,
      tree
    });

  } catch (error) {
    console.error('Drive import error:', error);
    res.status(500).json({ message: 'Failed to import Google Drive folder: ' + error.message });
  }
});

module.exports = router;
