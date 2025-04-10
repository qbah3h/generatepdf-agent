const asyncHandler = require('express-async-handler');
const Conversation = require('../models/conversation');

const processTextInput = asyncHandler(async (req, res) => {
  const { from, text } = req.body;

  // Create or update conversation
  let conversation = await Conversation.findOne({
    userId: from,
    status: 'active'
  }).sort({ updatedAt: -1 });

  if (!conversation) {
    conversation = new Conversation({
      userId: from,
      messages: []
    });
  }

  // Add user message to conversation
  conversation.messages.push({
    role: 'user',
    content: text
  });

  // TODO: Process with LLM here
  const aiResponse = 'This endpoint is working';

  // Add AI response to conversation
  conversation.messages.push({
    role: 'assistant',
    content: aiResponse
  });

  await conversation.save();

  res.json({
    success: true,
    response: aiResponse
  });
});

const processImageInput = asyncHandler(async (req, res) => {
  const { from } = req.body;
  const image = req.file;

  if (!from || !image) {
    res.status(400);
    throw new Error('Missing required parameters');
  }

  // Create conversation entry for image processing
  // const conversation = new Conversation({
  //   userId: from,
  //   messages: [
  //     {
  //       role: 'user',
  //       content: 'Image uploaded',
  //       metadata: {
  //         filename: image.originalname,
  //         mimetype: image.mimetype,
  //         size: image.size
  //       }
  //     }
  //   ]
  // });

  // await conversation.save();

  // TODO: Process image with OCR/LLM here
  // For now, keeping the existing PDF generation logic
  // ... [Your existing PDF generation code]

  // Create or update conversation
  let conversation = await Conversation.findOne({
    userId: from,
    status: 'active'
  }).sort({ updatedAt: -1 });

  if (!conversation) {
    conversation = new Conversation({
      userId: from,
      messages: []
    });
  }

  // Add user message to conversation
  conversation.messages.push({
    role: 'user',
    content: text
  });

  // TODO: Process with LLM here
  const aiResponse = 'This endpoint is working for images';

  // Add AI response to conversation
  conversation.messages.push({
    role: 'assistant',
    content: aiResponse
  });

  await conversation.save();

  res.json({
    success: true,
    response: aiResponse
  });
});

module.exports = {
  processTextInput,
  processImageInput
};
