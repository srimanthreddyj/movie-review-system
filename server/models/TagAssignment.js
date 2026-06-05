const mongoose = require('mongoose');

const TagAssignmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tagId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  entityType: {
    type: String,
    enum: ['movie', 'cast', 'clip'],
    required: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false } // only createdAt is needed
});

module.exports = mongoose.model('TagAssignment', TagAssignmentSchema);
