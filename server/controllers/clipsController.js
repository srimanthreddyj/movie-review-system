const Clip = require('../models/Clip');
const Movie = require('../models/Movie');
const Cast = require('../models/Cast');
const User = require('../models/User');
const TagAssignment = require('../models/TagAssignment');
const B2Usage = require('../models/B2Usage');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

// Initialize B2 S3 Client
const b2Config = {
  endpoint: process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
  region: process.env.B2_REGION || 'us-east-005',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY
  }
};
const s3Client = new S3Client(b2Config);
const B2_BUCKET = process.env.B2_BUCKET_NAME || 'moviebuzz';

// Max free tier limit: 10GB. We cap at 9GB (90%)
const MAX_B2_BYTES = 9 * 1024 * 1024 * 1024;


// Helper to sign B2 URL for a clip
const signClip = async (clip) => {
  if (!clip) return clip;
  const clipObj = typeof clip.toObject === 'function' ? clip.toObject() : clip;
  if (clipObj.url && clipObj.url.startsWith('b2://')) {
    const fileKey = clipObj.url.replace('b2://', '');
    clipObj.b2Key = clipObj.url; // Preserve original b2:// key for frontend edits
    clipObj.isB2 = true;
    try {
      const command = new GetObjectCommand({
        Bucket: B2_BUCKET,
        Key: fileKey,
        ResponseContentType: 'video/mp4'
      });
      clipObj.url = await getSignedUrl(s3Client, command, { expiresIn: 7200 });
    } catch (err) {
      console.error('Failed to sign B2 URL:', err);
      // Keep b2Key set; url stays as b2:// to signal failure
    }
  }
  return clipObj;
};
exports.signClip = signClip;

// Stream clip video directly with Range headers for mobile Safari/Chrome compatibility
exports.streamClip = async (req, res) => {
  try {
    const { id } = req.params;
    const clip = await Clip.findById(id);

    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    if (!clip.url || !clip.url.startsWith('b2://')) {
      return res.redirect(clip.url);
    }

    const fileKey = clip.url.replace('b2://', '');
    const range = req.headers.range;

    const getObjectParams = {
      Bucket: B2_BUCKET,
      Key: fileKey
    };

    if (range) {
      getObjectParams.Range = range;
    }

    const s3Command = new GetObjectCommand(getObjectParams);
    const s3Response = await s3Client.send(s3Command);

    res.setHeader('Content-Type', s3Response.ContentType || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    if (s3Response.ContentLength) {
      res.setHeader('Content-Length', s3Response.ContentLength);
    }
    if (s3Response.ContentRange) {
      res.setHeader('Content-Range', s3Response.ContentRange);
      res.status(206);
    } else {
      res.status(200);
    }

    s3Response.Body.pipe(res);
  } catch (error) {
    console.error('Error streaming video clip from B2:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Streaming video clip failed', error: error.message });
    }
  }
};

// Get all clips with filtering and pagination
exports.getClips = async (req, res) => {
  try {
    const { movieId, castId, clipType, tagId, page = 1, limit = 10, q } = req.query;
    const filter = { addedBy: req.user.id }; // Scope to the logged-in user only

    if (movieId) {
      filter.movieId = movieId;
    }

    if (castId) {
      filter.castInvolved = castId;
    }

    if (clipType) {
      filter.clipType = clipType;
    }

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }

    if (tagId) {
      const assignments = await TagAssignment.find({
        userId: req.user.id,
        tagId,
        entityType: 'clip'
      });
      const clipIds = assignments.map(a => a.entityId);
      filter._id = { $in: clipIds };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const clips = await Clip.find(filter)
      .skip(skip)
      .limit(limitNum)
      .populate('movieId', 'title posterUrl mediaType')
      .populate('castInvolved', 'name photoUrl gender')
      .populate('addedBy', 'name')
      .sort({ createdAt: -1 });

    const total = await Clip.countDocuments(filter);

    const clipsList = await Promise.all(clips.map(c => signClip(c)));

    res.json({
      clips: clipsList,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalClips: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single clip by ID with fresh presigned URL
exports.getClipById = async (req, res) => {
  try {
    const { id } = req.params;
    const clip = await Clip.findById(id)
      .populate('movieId', 'title posterUrl mediaType')
      .populate('castInvolved', 'name photoUrl gender')
      .populate('addedBy', 'name');

    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    res.json(await signClip(clip));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Get presigned URL for upload
exports.getUploadUrl = async (req, res) => {
  try {
    const { fileName, fileType, fileSize } = req.query;
    
    if (!fileName || !fileSize) {
      return res.status(400).json({ message: 'Missing file details (fileName and fileSize are required)' });
    }

    const effectiveFileType = fileType && fileType.trim() ? fileType.trim() : 'video/mp4';
    const sizeNum = parseInt(fileSize, 10);

    // Check usage
    let usage = await B2Usage.findOne({ singleton: 'b2_usage' });
    if (!usage) {
      usage = new B2Usage({ singleton: 'b2_usage', totalBytesUsed: 0 });
      await usage.save();
    }

    if (usage.totalBytesUsed + sizeNum > MAX_B2_BYTES) {
      return res.status(403).json({ message: 'Free tier storage limit reached (90%). Cannot upload more clips.' });
    }

    const uniqueId = crypto.randomBytes(8).toString('hex');
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `clips/${uniqueId}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      ContentType: effectiveFileType
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    res.json({
      uploadUrl,
      fileKey: `b2://${key}`,
      size: sizeNum,
      fileType: effectiveFileType
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate upload URL', error: error.message });
  }
};

// Add a new clip
exports.addClip = async (req, res) => {
  try {
    const { movieId, title, url, description, clipType, thumbnailUrl, castInvolved, b2FileSize } = req.body;

    if (!title || !url) {
      return res.status(400).json({ message: 'Title and URL are required' });
    }

    // Verify movie exists if provided
    if (movieId) {
      const movieExists = await Movie.exists({ _id: movieId });
      if (!movieExists) {
        return res.status(404).json({ message: 'Movie not found' });
      }
    }

    // Validate castInvolved if provided
    if (castInvolved && Array.isArray(castInvolved)) {
      const castsCount = await Cast.countDocuments({ _id: { $in: castInvolved } });
      if (castsCount !== castInvolved.length) {
        return res.status(400).json({ message: 'One or more cast members not found' });
      }
    }

    const clip = new Clip({
      movieId: movieId || null,
      title,
      url,
      description,
      clipType: clipType || 'trailer',
      thumbnailUrl: thumbnailUrl || '',
      castInvolved: castInvolved || [],
      addedBy: req.user.id,
      b2FileSize: b2FileSize ? parseInt(b2FileSize, 10) : 0
    });

    await clip.save();

    // Track usage
    if (url && url.startsWith('b2://') && b2FileSize) {
      let usage = await B2Usage.findOne({ singleton: 'b2_usage' });
      if (!usage) usage = new B2Usage({ singleton: 'b2_usage', totalBytesUsed: 0 });
      usage.totalBytesUsed += parseInt(b2FileSize, 10);
      await usage.save();
    }

    // Populate references before returning
    const populatedClip = await Clip.findById(clip._id)
      .populate('movieId', 'title posterUrl mediaType')
      .populate('castInvolved', 'name photoUrl gender')
      .populate('addedBy', 'name');

    res.status(201).json(await signClip(populatedClip));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Edit a clip
exports.updateClip = async (req, res) => {
  try {
    const { id } = req.params;
    const { movieId, title, url, description, clipType, thumbnailUrl, castInvolved, b2FileSize } = req.body;

    const clip = await Clip.findById(id);
    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    // Access control: creator or admin
    if (clip.addedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You can only edit your own clips.' });
    }

    // Validate movie if provided
    if (movieId) {
      const movieExists = await Movie.exists({ _id: movieId });
      if (!movieExists) {
        return res.status(404).json({ message: 'Movie not found' });
      }
      clip.movieId = movieId;
    } else if (movieId === null || movieId === '') {
      clip.movieId = null;
    }

    // Validate castInvolved if provided
    if (castInvolved && Array.isArray(castInvolved)) {
      const castsCount = await Cast.countDocuments({ _id: { $in: castInvolved } });
      if (castsCount !== castInvolved.length) {
        return res.status(400).json({ message: 'One or more cast members not found' });
      }
      clip.castInvolved = castInvolved;
    }

    const oldUrl = clip.url;
    const oldB2Size = clip.b2FileSize;

    if (title) clip.title = title;
    if (url) clip.url = url;
    if (description !== undefined) clip.description = description;
    if (clipType) clip.clipType = clipType;
    if (thumbnailUrl !== undefined) clip.thumbnailUrl = thumbnailUrl;
    if (b2FileSize !== undefined) clip.b2FileSize = b2FileSize ? parseInt(b2FileSize, 10) : 0;

    await clip.save();

    // If URL changed and the old URL was a B2 object, delete it to save space
    if (url && oldUrl !== url && oldUrl.startsWith('b2://')) {
      const fileKey = oldUrl.replace('b2://', '');
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: B2_BUCKET,
          Key: fileKey
        }));
        if (oldB2Size) {
          await B2Usage.updateOne(
            { singleton: 'b2_usage' },
            { $inc: { totalBytesUsed: -oldB2Size } }
          );
        }
      } catch (err) {
        console.error('Failed to delete old B2 object on update:', err);
      }
    }

    // If URL changed and the new URL is a B2 object, increment usage
    if (url && oldUrl !== url && url.startsWith('b2://') && b2FileSize) {
      let usage = await B2Usage.findOne({ singleton: 'b2_usage' });
      if (!usage) usage = new B2Usage({ singleton: 'b2_usage', totalBytesUsed: 0 });
      usage.totalBytesUsed += parseInt(b2FileSize, 10);
      await usage.save();
    }

    const populatedClip = await Clip.findById(clip._id)
      .populate('movieId', 'title posterUrl mediaType')
      .populate('castInvolved', 'name photoUrl gender')
      .populate('addedBy', 'name');

    res.json(await signClip(populatedClip));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a clip
exports.deleteClip = async (req, res) => {
  try {
    const { id } = req.params;

    const clip = await Clip.findById(id);
    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    // Access control: creator or admin
    if (clip.addedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You can only delete your own clips.' });
    }

    await Clip.deleteOne({ _id: id });

    // Clean up B2 Object if it was hosted there
    if (clip.url && clip.url.startsWith('b2://')) {
      const fileKey = clip.url.replace('b2://', '');
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: B2_BUCKET,
          Key: fileKey
        }));
        if (clip.b2FileSize) {
          await B2Usage.updateOne(
            { singleton: 'b2_usage' },
            { $inc: { totalBytesUsed: -clip.b2FileSize } }
          );
        }
      } catch (err) {
        console.error('Failed to delete B2 object:', err);
      }
    }

    // Clean up references in user favourites
    await User.updateMany(
      {},
      { $pull: { 'favourites.clips': { entityId: id } } }
    );

    res.json({ message: 'Clip deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
