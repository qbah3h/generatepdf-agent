const express = require('express');
const { body } = require('express-validator');
const {
  getHistory,
  getActiveConversation,
  createConversation,
  addMessage,
  updateContext,
  archiveConversation,
  searchConversations
} = require('../controllers/conversationController');
const auth = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication and rate limiting to all routes
router.use(auth);
router.use(apiLimiter);

// Validation schemas
const conversationValidation = [
  body('message').notEmpty().withMessage('Message is required'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
];

const messageValidation = [
  body('role').isIn(['user', 'assistant', 'system']).withMessage('Invalid role'),
  body('content').notEmpty().withMessage('Content is required'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
];

const contextValidation = [
  body('context').isObject().withMessage('Context must be an object')
];

// Routes
router.get('/history', getHistory);
router.get('/active', getActiveConversation);
router.get('/search', searchConversations);
router.post('/', validate(conversationValidation), createConversation);
router.post('/:conversationId/messages', validate(messageValidation), addMessage);
router.patch('/:conversationId/context', validate(contextValidation), updateContext);
router.patch('/:conversationId/archive', archiveConversation);

module.exports = router;
