const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  entityType: {
    type: String,
    enum: ['movie', 'cast', 'clip'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000 // slightly generous note length limit
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Comment', CommentSchema);
