const mongoose = require('mongoose');

const MovieCastSchema = new mongoose.Schema({
  castId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cast',
    required: true
  },
  characterName: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['Actor', 'Actress', 'Director', 'Producer', 'Composer', 'Writer', 'Crew', 'Other'],
    default: 'Actor'
  }
});

const MovieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  originalTitle: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'English'
  },
  languages: [String],
  genre: [String],
  releaseDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['released', 'upcoming'],
    default: 'released'
  },
  mediaType: {
    type: String,
    enum: ['movie', 'series'],
    default: 'movie',
    index: true
  },
  posterUrl: {
    type: String,
    default: ''
  },
  bannerUrl: {
    type: String,
    default: ''
  },
  synopsis: {
    type: String,
    default: ''
  },
  explanation: {
    type: String,
    default: ''
  },
  explanationGeneratedAt: {
    type: Date
  },
  rating: {
    type: Number,
    default: 0
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
    enum: ['tmdb', 'omdb', 'wikidata', 'manual'],
    default: 'manual'
  },
  cast: [MovieCastSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Movie', MovieSchema);
