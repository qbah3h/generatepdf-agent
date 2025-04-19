const Conversation = require('../models/conversation');

class ConversationService {
  static async createConversation(userId, initialMessage, metadata = {}) {
    const conversation = new Conversation({
      userId,
      messages: [{
        role: 'user',
        content: initialMessage
      }],
      metadata
    });
    return await conversation.save();
  }

  static async getConversationHistory(userId, limit = 10, skip = 0) {
    return await Conversation.find({ userId })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  static async getActiveConversation(userId) {
    return await Conversation.findOne({
      userId,
      status: 'active'
    }).sort({ updatedAt: -1 });
  }

  static async addMessage(conversationId, role, content, metadata = {}) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversation.messages.push({
      role,
      content,
      metadata
    });
    conversation.updatedAt = new Date();
    return await conversation.save();
  }

  static async updateContext(conversationId, context) {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { $set: { context } },
      { new: true }
    );
  }

  static async archiveConversation(conversationId) {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { $set: { status: 'archived' } },
      { new: true }
    );
  }

  static async searchConversations(userId, query) {
    return await Conversation.find({
      userId,
      $or: [
        { 'messages.content': { $regex: query, $options: 'i' } },
        { 'metadata.title': { $regex: query, $options: 'i' } }
      ]
    }).sort({ updatedAt: -1 });
  }
}

module.exports = ConversationService;
