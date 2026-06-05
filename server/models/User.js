const mongoose = require('mongoose');

const FavouriteItemSchema = new mongoose.Schema({
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  level: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  }
});

const TagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: '#808080' // default gray
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  favourites: {
    movies: [FavouriteItemSchema],
    cast: [FavouriteItemSchema],
    clips: [FavouriteItemSchema]
  },
  tags: [TagSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
