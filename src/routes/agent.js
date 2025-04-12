const express = require('express');
const multer = require('multer');
const ipFilter = require('../middleware/ipFilter');
const { validate, textInputValidation, imageInputValidation } = require('../middleware/validator');
const { pdfGenerationLimiter } = require('../middleware/rateLimiter');
const openai = require('../config/openai');
const Curriculum = require('../models/curriculum');


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
    req.processedResult = await processTextInput(req);

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

async function processTextInput(req) {
  const systemPrompt = `You are a CV creator assistant. Each time you are prompted with a JSON structure, your task is to complete it.
The JSON will include the changes made during the chat, along with the latest input from the user. You must update the CV sections one at a time, based on both lastChatbotMessage and lastUserMessage.
Your response must always return the updated JSON, including:
- A new message in chatbotMessage — this should be short, assertive, and ask only the necessary question to move the conversation forward.
- An updated status field:
Use "active" if the conversation is still in progress.
Use "ready" once all required fields are complete and the user has confirmed they’re ready to generate the PDF.
Do not include extra explanations or summaries. Return only the updated JSON object.
Respect the original structure. Never return a different schema unless asked
Update only one section at a time. For example, ask for the full name, then update the information section with it, and move on.
Use lastChatbotMessage + lastUserMessage as your state. It should drive what gets asked or updated next.
Always return a full updated JSON with the new message and any changed fields only.`;

  const { from, text } = req.body;

  // Load curriculum from database or create new
  let curriculum = await Curriculum.findOne({ status: 'active', from }) || await Curriculum.createWithDefaultSections(from);

  curriculum.userMessage = text;

  if (req.file) {
    curriculum.image = true;
  }

  const systemMessage = {
    role: 'system', content: `
  ${systemPrompt}
  ${curriculum}
  ` };

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-0125",
    messages: [systemMessage]
  });

  const aiResponseText = response.choices[0].message.content;
  console.log('Raw AI response:', aiResponseText);

  const aiResponse = JSON.parse(aiResponseText);
  console.log('Parsed AI response:', aiResponse);

  // Update the Mongoose document fields
  Object.assign(curriculum, {
    status: aiResponse.status,
    section: aiResponse.section || [],
    lastChatbotMessage: aiResponse.chatbotMessage,
    chatbotMessage: ""
  });

  // Update curriculum in database
  await curriculum.save();

  console.log('AI response:', aiResponse.chatbotMessage);
  
  return aiResponse.chatbotMessage;
}

module.exports = router;
