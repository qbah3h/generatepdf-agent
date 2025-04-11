const mongoose = require('mongoose');

const curriculumSchema = new mongoose.Schema({
  lastChatbotMessage: { type: String, default: '' },
  userMessage: { type: String, default: '' },
  chatbotMessage: { type: String, default: '' },
  status: { type: String, default: 'new' },
  image: { type: Boolean, default: false },
  section: [{
    status: { type: String, default: '' },
    name: { type: String, required: true },
    content: [{
      // Information section
      fullName: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
      summary: { type: String, default: '' },
      skills: [{ type: String }],
      
      // Experience section
      jobTitle: { type: String, default: '' },
      company: { type: String, default: '' },
      startDate: { type: String, default: '' },
      endDate: { type: String, default: '' },
      description: { type: String, default: '' },
      
      // Education section
      degree: { type: String, default: '' },
      institution: { type: String, default: '' },
      details: { type: String, default: '' },
      
      // Project section
      title: { type: String, default: '' },
      description: { type: String, default: '' }
    }]
  }]
}, {
  timestamps: true
});

const Curriculum = mongoose.model('Curriculum', curriculumSchema);

module.exports = Curriculum;
