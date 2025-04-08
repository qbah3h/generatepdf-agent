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
app.post('/generate', async (req, res) => {
  try {
    const curriculum = req.body;
    console.log(curriculum)
    // Call the PDF generation service
    const response = await axios.post('https://167.114.145.216:8090/api/cv/generate', curriculum, {
      responseType: 'arraybuffer'
    });

    const filename = 'CV - Nombre - Tema.pdf';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}`
    });

    res.send(response.data);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.listen(port, () => {
  console.log(`AI Agent service running on port ${port}`);
});