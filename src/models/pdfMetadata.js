const mongoose = require('mongoose');

const pdfMetadataSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  filename: {
    type: String,
    required: true,
  },
  template: {
    type: String,
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  status: {
    type: String,
    enum: ['generated', 'failed', 'deleted'],
    default: 'generated',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('PdfMetadata', pdfMetadataSchema);
