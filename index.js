const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const multer = require('multer');

dotenv.config();

// Configure multer for handling file uploads
const upload = multer();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Text processing endpoint
app.post('/api/agent/text', async (req, res) => {
  try {
    const { from, text } = req.body;
    
    if (!from || !text) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log(`Received text from ${from}:`, text);
    
    res.json({ 
      success: true,
      data: 'This endpoint is working'
    });
  } catch (error) {
    console.error('Error processing text:', error);
    res.status(500).json({ error: 'Failed to process text' });
  }
});

// Image processing endpoint
app.post('/api/agent/image', upload.single('image'), async (req, res) => {
  try {
    const { from } = req.body;
    const image = req.file;

    if (!from || !image) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log(`Received image from ${from}:`, {
      filename: image.originalname,
      mimetype: image.mimetype,
      size: image.size
    });

    // Create FormData instance
    const formData = new FormData();
    
    // Add the curriculum JSON
    formData.append('curriculumJson', JSON.stringify(cv));
    
    // Add the image file
    formData.append('image', new Blob([image.buffer], { type: image.mimetype }), image.originalname);

    // Call the Spring Boot service
    const response = await axios.post('http://167.114.145.216:8090/api/cv/generate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'arraybuffer'
    });

    const filename = 'CV - Nombre - Tema.pdf';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}`
    });

    res.send(response.data);
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Failed to process image' });
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