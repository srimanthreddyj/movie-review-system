const mongoose = require('mongoose');

const CacheMetadataSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  lastUpdated: {
    type: Date,
    required: true
  }
});

module.exports = mongoose.model('CacheMetadata', CacheMetadataSchema);
