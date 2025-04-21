const express = require('express');
const ipFilter = require('../middleware/ipFilter');
const { validate, textInputValidation, imageInputValidation } = require('../middleware/validator');
const orchestrateProcessing = require('../middleware/orchestrateProcessing');
const { upload } = require('../utils/fileStorage');
const { saveImage } = require('../services/imageService');

const router = express.Router();

// Apply IP filtering to all routes
router.use(ipFilter);

// Text processing endpoint
router.post(
  '/text',
  // pdfGenerationLimiter,
  validate(textInputValidation),
  orchestrateProcessing,
  (req, res) => {
    res.json({
      success: true,
      message: req.processedResult
    });
  }
);

// Image processing endpoint
router.post(
  '/image-test',
  // pdfGenerationLimiter,
  upload.single('image'),
  validate(imageInputValidation),
  orchestrateProcessing,
  (req, res) => {
    res.json({ success: true, message: req.processedResult });
  }
);

// New endpoint for image uploads
router.post('/image',
  upload.single('image'),
  async (req, res) => {
    console.log(`image endpoint --- Response ${JSON.stringify(req)}`)
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image uploaded' });
      }

      const { from } = req.body;
      const savedImage = await saveImage(req.file, from);

      next();
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
  },
  orchestrateProcessing,
  (req, res) => {
    res.json({ success: true, message: req.processedResult });
  });

module.exports = router;
