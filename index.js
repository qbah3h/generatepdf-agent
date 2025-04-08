const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// PDF Generation endpoint
app.post('/api/agent', async (req, res) => {
  try {
    const curriculum = req.body;
    
    console.log('Sending request to PDF service with curriculum:', JSON.stringify(curriculum, null, 2));
    
    // Call the PDF generation service
    const response = await axios.post('http://167.114.145.216:8090/api/cv/generate', cv, {
      responseType: 'arraybuffer',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // Disable SSL verification since we're using HTTP
      httpsAgent: false
    });

    const filename = 'CV - Nombre - Tema.pdf';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}`
    });

    res.send(response.data);
  } catch (error) {
    console.error('Error generating PDF:', error.message);
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
      res.status(error.response.status).json({ error: 'Server responded with an error' });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
      res.status(503).json({ error: 'No response from PDF service' });
    } else {
      // Something happened in setting up the request
      console.error('Error setting up request:', error.message);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
});

app.listen(port, () => {
  console.log(`AI Agent service running on port ${port}`);
});

const cv = {
    "fullName": "Heikel Molina",
        "email": "qbah3h@gmail.com",
        "phone": "+59891048084",
        "address": "18 de julio 1445 apto 2, Montevideo",
        "summary": "Experienced software developer with a focus on web technologies.",
        "skills": ["Java", "Spring Boot", "JavaScript", "React", "SQL"],
    "experiences": [
        {
            "jobTitle": "Senior Developer",
                "company": "Tech Solutions",
                "startDate": "Jan 2020",
                "endDate": "Present",
                "description": "Led a team building enterprise applications."
        }
    ],
    "education": [
        {
            "degree": "B.Sc. Computer Science",
                "institution": "University of Example",
                "startDate": "2015",
                "endDate": "2019",
                "details": "Graduated with honors."
        }
    ],
    "projects": [
        {
            "title": "Personal Portfolio Website",
                "description": "Built a responsive portfolio using React and Tailwind."
        }
    ]
}