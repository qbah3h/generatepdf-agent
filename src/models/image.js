const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const Image = mongoose.model('Image', imageSchema);

module.exports = Image;