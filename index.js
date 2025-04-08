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
    const response = await axios.post('http://167.114.145.216:8090/api/cv/generate', curriculum, {
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