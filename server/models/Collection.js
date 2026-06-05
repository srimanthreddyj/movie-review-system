const mongoose = require('mongoose');

const CollectionItemSchema = new mongoose.Schema({
  entityType: {
    type: String,
    enum: ['movie', 'cast', 'clip'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
});

const CollectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  coverImage: {
    type: String,
    default: ''
  },
  items: [CollectionItemSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Collection', CollectionSchema);
