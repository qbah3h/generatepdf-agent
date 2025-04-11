const mongoose = require('mongoose');

const curriculumSchema = new mongoose.Schema({
  from: { type: String, required: true },
  lastChatbotMessage: { type: String, default: '' },
  userMessage: { type: String, default: '' },
  chatbotMessage: { type: String, default: '' },
  status: { type: String, default: 'new' },
  image: { type: Boolean, default: false },
  section: [{
    status: { type: String, enum: ['completed', 'working', 'pending'], default: 'pending' },
    name: { type: String, enum: ['information', 'experiences', 'education', 'projects'], required: true },
    content: [{
      // Common fields for PDF generation service
      fullName: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
      summary: { type: String, default: '' },
      skills: { type: [String], default: [] },
      
      // Experience fields
      jobTitle: { type: String, default: '' },
      company: { type: String, default: '' },
      startDate: { type: String, default: '' },
      endDate: { type: String, default: '' },
      description: { type: String, default: '' },
      
      // Education fields
      degree: { type: String, default: '' },
      institution: { type: String, default: '' },
      details: { type: String, default: '' },
      
      // Project fields
      title: { type: String, default: '' },
      description: { type: String, default: '' }
    }]
  }]
}, {
  timestamps: true
});

// Static method to create a new curriculum with default sections
curriculumSchema.statics.createWithDefaultSections = async function(from) {
  const defaultSections = [
    {
      status: 'pending',
      name: 'information',
      content: [{
        fullName: '',
        email: '',
        phone: '',
        address: '',
        summary: '',
        skills: []
      }]
    },
    {
      status: 'pending',
      name: 'experiences',
      content: [{
        jobTitle: '',
        company: '',
        startDate: '',
        endDate: '',
        description: ''
      }]
    },
    {
      status: 'pending',
      name: 'education',
      content: [{
        degree: '',
        institution: '',
        startDate: '',
        endDate: '',
        details: ''
      }]
    },
    {
      status: 'pending',
      name: 'projects',
      content: [{
        title: '',
        description: ''
      }]
    }
  ];

  return this.create({
    from,
    section: defaultSections
  });
};

const Curriculum = mongoose.model('Curriculum', curriculumSchema);

module.exports = Curriculum;
