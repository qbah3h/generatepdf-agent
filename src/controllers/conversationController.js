const asyncHandler = require('express-async-handler');
const ConversationService = require('../services/conversationService');

// Get conversation history
const getHistory = asyncHandler(async (req, res) => {
  const { limit = 10, skip = 0 } = req.query;
  const conversations = await ConversationService.getConversationHistory(
    req.user.userId,
    parseInt(limit),
    parseInt(skip)
  );
  res.json(conversations);
});

// Get active conversation
const getActiveConversation = asyncHandler(async (req, res) => {
  const conversation = await ConversationService.getActiveConversation(req.user.userId);
  if (!conversation) {
    return res.status(404).json({ error: 'No active conversation found' });
  }
  res.json(conversation);
});

// Create new conversation
const createConversation = asyncHandler(async (req, res) => {
  const { message, metadata } = req.body;
  const conversation = await ConversationService.createConversation(
    req.user.userId,
    message,
    metadata
  );
  res.status(201).json(conversation);
});

// Add message to conversation
const addMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { role, content, metadata } = req.body;
  
  const conversation = await ConversationService.addMessage(
    conversationId,
    role,
    content,
    metadata
  );
  res.json(conversation);
});

// Update conversation context
const updateContext = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { context } = req.body;
  
  const conversation = await ConversationService.updateContext(
    conversationId,
    context
  );
  res.json(conversation);
});

// Archive conversation
const archiveConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const conversation = await ConversationService.archiveConversation(conversationId);
  res.json(conversation);
});

// Search conversations
const searchConversations = asyncHandler(async (req, res) => {
  const { query } = req.query;
  const conversations = await ConversationService.searchConversations(
    req.user.userId,
    query
  );
  res.json(conversations);
});

module.exports = {
  getHistory,
  getActiveConversation,
  createConversation,
  addMessage,
  updateContext,
  archiveConversation,
  searchConversations
};
