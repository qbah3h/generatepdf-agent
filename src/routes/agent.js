const express = require('express');
const multer = require('multer');
const ipFilter = require('../middleware/ipFilter');
const { validate, textInputValidation, imageInputValidation } = require('../middleware/validator');
const { pdfGenerationLimiter } = require('../middleware/rateLimiter');
const { openai } = require('../config/openai');


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

    await processTextInput(req, cvObj);

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

      res.json({ success: true, message: 'Text processing completed' });
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

async function processTextInput(req, cvObj) {
  const systemPrompt = `You are a CV creator assistant. Each time you are prompted with a JSON structure, your task is to complete it.
The JSON will include the changes made during the chat, along with the latest input from the user. You must update the CV sections one at a time, based on both lastChatbotMessage and lastUserMessage.
Your response must always return the updated JSON, including:
- A new message in newChatbotMessage — this should be short, assertive, and ask only the necessary question to move the conversation forward.
- An updated status field:
Use "active" if the conversation is still in progress.
Use "ready" once all required fields are complete and the user has confirmed they’re ready to generate the PDF.
Do not include extra explanations or summaries. Return only the updated JSON object.`;

  console.log('Body context:', req.body); // .from .text
  console.log('Contains image:', req.file);


  let curriculum = cvObj;

  curriculum.lastUserMessage = req.body.text;
  curriculum.newChatbotMessage = "";
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
  console.log('Response:', response);

  curriculum.newChatbotMessage = response.choices[0].message.content;

  console.log('New chatbot message:', curriculum.newChatbotMessage);


  // ask AI with system message obj
  // set lastChatbot message to current newChatbotMessage
  // return new chatbot message

  // if cv is completed, generate
  // update fields, save to database
  // send back cv

  return curriculum.lastChatbotMessage;
}


const cvObj = {
  "lastChatbotMessage": "",
  "lastUserMessage": "",
  "newChatbotMessage": "",
  "status": "active",
  "image": false,
  "section": [
    {
      "status": "",
      "name": "information",
      "content": [
        {
          "fullName": "",
          "email": "",
          "phone": "",
          "address": "",
          "summary": "",
          "skills": [
            "Java",
            "Spring Boot",
            "JavaScript",
            "React",
            "SQL"
          ]
        }
      ]
    },
    {
      "status": "",
      "name": "experiences",
      "content": [
        {
          "jobTitle": "",
          "company": "",
          "startDate": "",
          "endDate": "",
          "description": ""
        }
      ]
    },
    {
      "status": "",
      "name": "education",
      "content": [
        {
          "degree": "",
          "institution": "",
          "startDate": "",
          "endDate": "",
          "details": ""
        }
      ]
    },
    {
      "status": "",
      "name": "projects",
      "content": [
        {
          "title": "",
          "description": ""
        }
      ]
    }
  ]
}

module.exports = router;
