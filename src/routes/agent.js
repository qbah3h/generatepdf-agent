const express = require('express');
const multer = require('multer');
const ipFilter = require('../middleware/ipFilter');
const { validate, textInputValidation, imageInputValidation } = require('../middleware/validator');
const { pdfGenerationLimiter } = require('../middleware/rateLimiter');

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
    console.log('Body context:', req.body);
    console.log('Contains image:', req.file);

    const systemPrompt = "You will be provided with a JSON structure, you will be  containing the last";
    const history = req.processingContext;

    const systemMessage = {
      role: 'system', content: `
      ${systemPrompt}
      ${history}
      ` };

    /*
  
  You are a CV creator assistant. Each time you are prompted with a JSON structure, your task is to complete it.
  The JSON will include the changes made during the chat, along with the latest input from the user. You must update the CV sections one at a time, based on both lastChatbotMessage and lastUserMessage.
  Your response must always return the updated JSON, including:
  - A new message in newChatbotMessage — this should be short, assertive, and ask only the necessary question to move the conversation forward.
  - An updated status field:
  Use "active" if the conversation is still in progress.
  Use "ready" once all required fields are complete and the user has confirmed they’re ready to generate the PDF.
  Do not include extra explanations or summaries. Return only the updated JSON object.

{
  "lastChatbotMessage": "Please provide details for your work experience. What was your job title?",
  "lastUserMessage": "I worked in Netsuite for 2 years starting dec 2020, I worked with Javascript automatizing client processes. I work as a team player resolving client tickets in conjunction with cooworkers",
  "newChatbotMessage": "Thank you. Please confirm your job title at Netsuite.",
  "status": "active",
  "section": [
    {
      "status": "completed",
      "name": "information",
      "content": [
        {
          "fullName": "Heikel Molina",
          "email": "qbah3h@gmail.com",
          "phone": "+59891048084",
          "address": "18 de julio 1445 apto 2, Montevideo",
          "summary": "Experienced software developer with a focus on web technologies.",
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
      "status": "working",
      "name": "experiences",
      "content": [
        {
          "jobTitle": "",
          "company": "Netsuite",
          "startDate": "December 2020",
          "endDate": "December 2022",
          "description": "Worked with JavaScript automating client processes. Collaborated with a team to resolve client tickets."
        }
      ]
    },
    {
      "status": "completed",
      "name": "education",
      "content": [
        {
          "degree": "B.Sc. Computer Science",
          "institution": "University of Example",
          "startDate": "2015",
          "endDate": "2019",
          "details": "Graduated with honors."
        }
      ]
    },
    {
      "status": "completed",
      "name": "projects",
      "content": [
        {
          "title": "Personal Portfolio Website",
          "description": "Built a responsive portfolio using React and Tailwind."
        }
      ]
    }
  ]
}


    */

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

module.exports = router;
