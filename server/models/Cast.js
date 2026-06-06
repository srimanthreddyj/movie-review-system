const mongoose = require('mongoose');

const CastSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  photoUrl: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  birthDate: {
    type: Date
  },
  nationality: {
    type: String,
    default: ''
  },
  knownFor: {
    type: String,
    default: 'Actor'
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Non-binary', 'Other', 'Unspecified'],
    default: 'Unspecified'
  },
  imdbId: {
    type: String,
    default: ''
  },
  tmdbId: {
    type: String,
    default: ''
  },
  dataSource: {
    type: String,
    default: 'manual'
  },
  isPopular: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Cast', CastSchema);
