const axios = require('axios');
const FormData = require('form-data');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Calls the PDF generation service with the curriculum data
 * @param {Object} curriculumData - The curriculum data to generate a PDF from
 * @param {Buffer} [image] - Optional profile image data
 * @returns {Promise<Buffer>} - The PDF content as a buffer
 */
async function generatePDF(curriculumData, image) {
  try {
    // Format the curriculum data according to the PDF service requirements
    const formattedData = formatCurriculumData(curriculumData);
    
    // Create FormData instance
    const formData = new FormData();
    
    // Add the curriculum JSON
    formData.append('curriculumJson', JSON.stringify(formattedData));
    
    // Add the image if provided
    if (image) {
      formData.append('image', image, {
        filename: 'profile.jpg',
        contentType: 'image/jpeg'
      });
    }
    
    // Call the PDF generation service
    const response = await axios.post(
      `${process.env.SERVICE_URL}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        responseType: 'arraybuffer'
      }
    );
    
    // Return the PDF content as a buffer
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error generating PDF:', error.message);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Formats the curriculum data according to the PDF service requirements
 * @param {Object} curriculum - The curriculum data from the database
 * @returns {Object} - The formatted data for the PDF service
 */
function formatCurriculumData(curriculum) {
  // Extract information section
  const informationSection = curriculum.section.find(s => s.name === 'information');
  const information = informationSection ? informationSection.content[0] : {};
  
  // Extract experiences section
  const experiencesSection = curriculum.section.find(s => s.name === 'experiences');
  const experiences = experiencesSection ? experiencesSection.content : [];
  
  // Extract education section
  const educationSection = curriculum.section.find(s => s.name === 'education');
  const education = educationSection ? educationSection.content : [];
  
  // Extract projects section
  const projectsSection = curriculum.section.find(s => s.name === 'projects');
  const projects = projectsSection ? projectsSection.content : [];
  
  // Extract skills section
  const skillsSection = curriculum.section.find(s => s.name === 'skills');
  const skills = skillsSection ? skillsSection.content : [];
  
  // Extract certifications section
  const certificationsSection = curriculum.section.find(s => s.name === 'certifications');
  const certifications = certificationsSection ? certificationsSection.content : [];
  
  // Extract references section
  const referencesSection = curriculum.section.find(s => s.name === 'references');
  const references = referencesSection ? referencesSection.content : [];
  
  // Format the data according to the PDF service requirements
  return {
    fullName: information.fullName || '',
    email: information.email || '',
    phone: information.phone || '',
    address: information.address || '',
    summary: information.summary || '',
    language: information.language || '',
    style: curriculum.style || 'modern',
    skills: skills.map(skill => ({
      title: skill.title || '',
      description: skill.description || ''
    })),
    experiences: experiences.map(exp => ({
      jobTitle: exp.jobTitle || '',
      company: exp.company || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      description: exp.description || ''
    })),
    education: education.map(edu => ({
      degree: edu.degree || '',
      institution: edu.institution || '',
      startDate: edu.startDate || '',
      endDate: edu.endDate || '',
      details: edu.details || ''
    })),
    projects: projects.map(proj => ({
      title: proj.title || '',
      description: proj.description || ''
    })),
    certifications: certifications.map(cert => ({
      name: cert.name || '',
      link: cert.link || '',
      date: cert.date || ''
    })),
    references: references.map(ref => ({
      name: ref.name || '',
      phone: ref.phone || '',
      email: ref.email || ''
    }))
  };
}

module.exports = {
  generatePDF
};
