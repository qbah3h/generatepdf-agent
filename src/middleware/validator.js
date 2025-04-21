const { body, validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      error: 'Validation Error',
      details: errors.array()
    });
  };
};

// Validation schemas
const textInputValidation = [
  body('from').notEmpty().withMessage('User ID is required'),
  body('userMessage').notEmpty().withMessage('Text input is required')
];

const imageInputValidation = [
  body('from').notEmpty().withMessage('User ID is required'),
  // Add more image-specific validations as needed
];

module.exports = {
  validate,
  textInputValidation,
  imageInputValidation
};
