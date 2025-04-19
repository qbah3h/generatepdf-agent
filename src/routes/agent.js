const express = require('express');
const multer = require('multer');
const ipFilter = require('../middleware/ipFilter');
const { validate, textInputValidation, imageInputValidation } = require('../middleware/validator');
const orchestrateProcessing = require('../middleware/orchestrateProcessing');

const router = express.Router();
const upload = multer();

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
  '/image',
  // pdfGenerationLimiter,
  upload.single('image'),
  validate(imageInputValidation),
  orchestrateProcessing,
  (req, res) => {
    res.json({ success: true, message: req.processedResult });
  }
);

module.exports = router;
