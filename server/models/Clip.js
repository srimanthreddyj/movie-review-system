const mongoose = require('mongoose');

const ClipSchema = new mongoose.Schema({
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie'
  },
  title: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  clipType: {
    type: String,
    enum: ['trailer', 'scene', 'interview', 'song', 'bts', 'other'],
    default: 'trailer'
  },
  castInvolved: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cast'
  }],
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false } // only createdAt is needed
});

module.exports = mongoose.model('Clip', ClipSchema);
