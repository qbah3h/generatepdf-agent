const mongoose = require('mongoose');

// Sub-schemas for each section type
const InformationSchema = new mongoose.Schema({
  fullName: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  summary: { type: String, default: '' },
  skills: { type: [String], default: [] }
}, { _id: false });

const ExperienceSchema = new mongoose.Schema({
  jobTitle: { type: String, default: '' },
  company: { type: String, default: '' },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  description: { type: String, default: '' }
}, { _id: false });

const EducationSchema = new mongoose.Schema({
  degree: { type: String, default: '' },
  institution: { type: String, default: '' },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  details: { type: String, default: '' }
}, { _id: false });

const ProjectSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  description: { type: String, default: '' }
}, { _id: false });

// Section schema with discriminated content
const SectionSchema = new mongoose.Schema({
  status: { type: String, enum: ['completed', 'working', 'pending'], default: 'pending' },
  name: { type: String, enum: ['information', 'experiences', 'education', 'projects'], required: true },
  content: {
    type: [mongoose.Schema.Types.Mixed],
    required: true
  }
}, { _id: true });

// Curriculum schema
const curriculumSchema = new mongoose.Schema({
  from: { type: String, required: true },
  userMessage: { type: String, default: '' },
  prevChatbotMessage: { type: String, default: '' },
  newChatbotMessage: { type: String, default: '' },
  status: { type: String, default: 'active' },
  image: { type: Boolean, default: false },
  section: [SectionSchema],
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
        fullName: '.',
        email: '.',
        phone: '.',
        address: '.',
        summary: '.',
        skills: []
      }]
    },
    {
      status: 'pending',
      name: 'experiences',
      content: [{
        jobTitle: '.',
        company: '.',
        startDate: '.',
        endDate: '.',
        description: '.'
      }]
    },
    {
      status: 'pending',
      name: 'education',
      content: [{
        degree: '.',
        institution: '.',
        startDate: '.',
        endDate: '.',
        details: '.'
      }]
    },
    {
      status: 'pending',
      name: 'projects',
      content: [{
        title: '.',
        description: '.'
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
