const mongoose = require('mongoose');

const B2UsageSchema = new mongoose.Schema({
  // Single document to track overall usage
  singleton: {
    type: String,
    default: 'b2_usage',
    unique: true
  },
  totalBytesUsed: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('B2Usage', B2UsageSchema);
