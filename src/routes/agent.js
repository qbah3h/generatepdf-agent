const express = require('express');
const multer = require('multer');
const { processTextInput, processImageInput } = require('../controllers/agentController');
const ipFilter = require('../middleware/ipFilter');
const { validate, textInputValidation, imageInputValidation } = require('../middleware/validator');
const { pdfGenerationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const upload = multer();

// Apply IP filtering to all routes
router.use(ipFilter);

// Text processing endpoint
router.post(
  '/text',
  // pdfGenerationLimiter,
  validate(textInputValidation),
  processTextInput
);

// Image processing endpoint
router.post(
  '/image',
  // pdfGenerationLimiter,
  upload.single('image'),
  validate(imageInputValidation),
  processImageInput
);

module.exports = router;
