const express = require('express');
const multer = require('multer');
const ipFilter = require('../middleware/ipFilter');
const { validate, textInputValidation, imageInputValidation } = require('../middleware/validator');
const { pdfGenerationLimiter } = require('../middleware/rateLimiter');
const openai = require('../config/openai');
const Curriculum = require('../models/curriculum');
const Conversation = require('../models/conversation');


const router = express.Router();
const upload = multer();

// Apply IP filtering to all routes
router.use(ipFilter);

/**
 * Main orchestration middleware that handles both text and image processing
 * This is where you can implement your custom orchestration logic
 */
async function orchestrateProcessing(req, res, next) {
  try {
    // Determine which endpoint was called
    const endpoint = req.path.substring(1); // removes the leading slash
    console.log("----------------------");
    console.log('Endpoint:', endpoint);
    // Add endpoint info to the request object for downstream use
    req.processingContext = {
      endpoint,
      timestamp: new Date().toISOString(),
      // Add any other context information you need
    };

    // CUSTOM CODE SECTION START //
    /*
     * Here you can implement your custom logic based on the endpoint
     * Examples:
     * - if (endpoint === 'text') { // Handle text processing }
     * - if (endpoint === 'image') { // Handle image processing }
     * 
     * You can also implement:
     * - Pre-processing steps
     * - Data transformation
     * - Logging and monitoring
     * - Error handling
     */
    // CUSTOM CODE SECTION END //

    console.log('Processing context:', req.processingContext);

    // Store the result in req object for the endpoint handler
    // req.processedResult = await processTextInput(req);
    req.processedResult = await cvAgent(req);

    next();
  } catch (error) {
    next(error);
  }
}

// Text processing endpoint
router.post(
  '/text',
  // pdfGenerationLimiter,
  validate(textInputValidation),
  orchestrateProcessing, // Add orchestration middleware
  async (req, res, next) => {
    try {
      // CUSTOM CODE SECTION START //
      /*
       * Implement text-specific processing here
       * You have access to:
       * - req.processingContext.endpoint ('text')
       * - req.body (validated text input)
       */
      // CUSTOM CODE SECTION END //

      res.json({
        success: true,
        message: req.processedResult
      });
    } catch (error) {
      next(error);
    }
  }
);

// Image processing endpoint
router.post(
  '/image',
  // pdfGenerationLimiter,
  upload.single('image'),
  validate(imageInputValidation),
  orchestrateProcessing, // Add orchestration middleware
  async (req, res, next) => {
    try {
      // CUSTOM CODE SECTION START //
      /*
       * Implement image-specific processing here
       * You have access to:
       * - req.processingContext.endpoint ('image')
       * - req.file (uploaded image)
       * - req.body (other form data)
       */
      // CUSTOM CODE SECTION END //

      res.json({ success: true, message: 'Image processing completed' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Conversation-aware CV agent function
 * Maintains conversation history by timestamp, loads or creates conversation for the 'from' number, and uses a system prompt.
 */
// Accurate token counting using tiktoken for OpenAI models
const { encoding_for_model } = require('@dqbd/tiktoken');
let encoder;
function getEncoder() {
  if (!encoder) {
    encoder = encoding_for_model('gpt-4o');
  }
  return encoder;
}
function countTokens(text) {
  if (!text) return 0;
  const enc = getEncoder();
  return enc.encode(text).length;
}

// Helper to call OpenAI and count tokens
async function callOpenAIWithTokenCount({ model, messages }) {
  // Count input tokens (all message contents)
  const inputText = messages.map(m => m.content).join(' ');
  const inputTokens = countTokens(inputText);

  // Call OpenAI
  const response = await openai.chat.completions.create({ model, messages });
  const outputText = response.choices[0].message.content;
  const outputTokens = countTokens(outputText);

  return { response, inputTokens, outputTokens };
}

async function cvAgent(req) {
  const systemPrompt = `You are a CV creator assistant. Each time you are prompted with a JSON structure, your task is to complete it.
The JSON will include the changes made during the chat, along with the latest input from the user. You must update the CV sections one at a time, based on both lastChatbotMessage and lastUserMessage.
Your response must always return the updated JSON, including:
- A new message in chatbotMessage — this should be short, assertive, and ask only the necessary question to move the conversation forward.
- An updated status field:
Use "active" if the conversation is still in progress.
Use "ready" once all required fields are complete and the user has confirmed they’re ready to generate the PDF.
Do not include extra explanations or summaries. Return only the updated JSON object as it will be used as a function input.
Respect the original structure.
Update only one section at a time. For example, ask for the full name, then update the information section with it. The next iteration will be based on the updated JSON.
Use lastChatbotMessage + userMessage as your state of the conversation history. It should drive what gets asked or updated next.
Always return a full updated JSON with the new message and any changed fields only.
Only update chatbotMessage and section if the user has provided a valid input. Do not update any other field`;

  const { from, text } = req.body;

  // Load or create conversation for this 'from' number
  let conversation = await Conversation.findOne({ userId: from, status: 'active' });
  if (!conversation) {
    conversation = await Conversation.create({
      userId: from,
      messages: [],
      status: 'active'
    });
  }

  let curriculum = await Curriculum.findOne({ status: 'active', from }) || await Curriculum.createWithDefaultSections(from);
  curriculum.userMessage = text;
  
  if (conversation.messages.length > 0) {
    curriculum.lastChatbotMessage = conversation.messages[conversation.messages.length - 1].content;
  }

  // Add user message to conversation
  conversation.messages.push({
    role: 'user',
    content: text,
    timestamp: new Date()
  });

  // Sort messages by timestamp (ascending)
  conversation.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Build chat history for OpenAI
  const inputMessages = [
    { role: 'system', content: systemPrompt + curriculum },
  ];
  console.log('Input messages:', inputMessages);

  // Call OpenAI API and count tokens
  const { response, inputTokens, outputTokens } = await callOpenAIWithTokenCount({
    model: 'gpt-4o',
    messages: inputMessages
  });

  const aiResponseText = response.choices[0].message.content;
  console.log('Raw AI response:', aiResponseText);

  // Save token usage to conversation metadata
  if (!conversation.metadata) conversation.metadata = {};
  if (!conversation.metadata.tokenUsage) conversation.metadata.tokenUsage = [];
  conversation.metadata.tokenUsage.push({
    timestamp: new Date(),
    inputTokens,
    outputTokens
  });

  let cleaned = aiResponseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '');
  }
  const aiResponse = JSON.parse(cleaned);

  Object.assign(curriculum, aiResponse);
  await curriculum.save();


  // Add assistant message to conversation
  conversation.messages.push({
    role: 'assistant',
    content: aiResponse.chatbotMessage,
    timestamp: new Date()
  });

  await conversation.save();

  return aiResponse.chatbotMessage;
}

module.exports = router;
