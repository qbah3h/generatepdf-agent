const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
  },
  preferences: {
    language: {
      type: String,
      default: 'en',
    },
    pdfTemplate: {
      type: String,
      default: 'default',
    },
    // Add more preferences as needed
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('User', userSchema);
