const express = require('express');
const multer = require('multer');
const { processTextInput, processImageInput } = require('../controllers/agentController');
const auth = require('../middleware/auth');
const { validate, textInputValidation, imageInputValidation } = require('../middleware/validator');
const { apiLimiter, pdfGenerationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const upload = multer();

// Apply rate limiting to all routes
router.use(apiLimiter);

// Text processing endpoint
router.post(
  '/text',
  auth,
  validate(textInputValidation),
  processTextInput
);

// Image processing endpoint
router.post(
  '/image',
  auth,
  pdfGenerationLimiter,
  upload.single('image'),
  validate(imageInputValidation),
  processImageInput
);

module.exports = router;
