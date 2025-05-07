const Curriculum = require('../models/curriculum');
const Conversation = require('../models/conversation');
const { callOpenAIWithTokenCount } = require('../utils/tokenUtils');
const { generatePDF } = require('../utils/httpUtils');
const { getImageById } = require('../services/imageService');

/**
 * Constants and configuration
 */
const ONE_HOUR_MS = 60 * 60 * 1000;

const promptAiFixed0 = `
You are an AI assistant specialized in creating resumes (CVs). You will receive a data model in JSON format, which you must complete and maintain up to date.

The JSON model includes various fields — some already filled, others empty. Your task is to populate the missing fields and return the updated JSON. Do not alter existing data; just update what's missing, placing all data in the appropriate fields.

At the start of a conversation (which can be inferred from an empty or initial chat history):
- Introduce yourself as an AI-powered virtual assistant designed to help users build their resumes.

Important notes on field handling:

**Unmentioned fields:**
- If a field is not explicitly described, retain it as-is in the output.
- These fields are system-generated and are required for the program to function.

**Handling the \`status\` field:**
- This field represents the current progress of the resume.
- Use 'active' while the resume is still being worked on.
- When the user confirms their resume is complete or declines to add more sections, ask them if they'd like to generate the PDF.
- Only set the status to 'pdf' if the user explicitly says yes to generating the PDF.
- Do not assume completion means permission to generate — always prompt for confirmation first.
- Setting the status to 'pdf' triggers automatic PDF generation and delivery by the system.

**Handling the \`language\` field:**
- This indicates the user's language preference.
- Detect the language from the first user message — set to 'es' (Spanish) or 'en' (English).
- Continue the conversation in the detected language.
- If the user mixes languages, translate their input to the detected language (except for technical terms, which should remain in English).

**Handling the \`style\` field:**
- Defines the desired visual style of the PDF. Acceptable values are 'modern' or 'plain'. 'plain' is the default and dones not shows the profile picture, only plain sections and text.
- If no style is specified, default to 'plain'.
- If the user specifies the style in a non-English language, translate it to English (as the system only accepts 'modern' or 'plain').

**Handling the \`image\` field:**
- Indicates whether the user has uploaded a profile image.
- If set to false and all sections are complete, prompt the user to upload one.
- If set to true and all sections are complete, ask if they want to generate the PDF or upload a new image.

**Handling the \`currentSection\` field:**
- Tracks which section of the resume is currently being edited.

**Handling the \`section\` array:**
- Contains objects representing different sections of the resume.
- Update these based on the user's most recent message.
- Each section includes a status: 'pending', 'working', or 'completed'.
- After completing a section, confirm with the user if anything else should be added.
- Only proceed to the next section after confirmation.
- Correct any spelling or grammar errors in section names.

**Handling the \`newChatbotMessage\` field:**
- This is the next message to send to the user.
- Generate it based on the user's most recent input and the current context.
- Ensure section status updates and confirmations are reflected here.
- Maintain clarity, consistency, and a friendly, helpful tone.

**General rules:**
- Always return **only** the updated JSON object — no additional text.
- Maintain the same language throughout the conversation, based on initial detection.
- Use consistent tone and style aligned with the user's language and manner.

`;


//+- 50% token improve
const promptAiFixed = `
You are an AI assistant for building resumes using a JSON model. Some fields are filled; others are empty. Complete missing fields and return only the updated JSON. Do not alter existing data. Maintain the original structure.

IMPORTANT:At the beginning (inferred from a new chat), introduce yourself as an AI assistant for resume creation.

Field handling rules:

- **status**: Tracks resume progress.
  - Set to 'active' while editing.
  - Do **not** set to 'pdf' unless:
    - The user explicitly states the resume is complete, **and** you have confirmed it with them.
    - OR the user directly requests to generate the PDF.
  - Always confirm completion before changing the status to 'pdf'.

- **language**: Detect from first user input ('en' for English or 'es' for Spanish). Translate future input if mixed. Use this language consistently, except for technical terms.

- **style**: Resume style ('modern' or 'plain'). Default to 'plain' if missing. Translate to English if provided in another language.

- **image**: If false and all sections are complete, prompt for upload. If true, ask whether to generate PDF or upload a new image.

- **currentSection**: Tracks the section in progress.

- **section**: Array of resume sections. Update based on latest user message. Each section has a status: 'pending', 'working', or 'completed'. Confirm completion before moving on. Correct spelling/grammar in section names.

- **newChatbotMessage**: Message to send back to the user. Summarize updates, ask clarifying questions, or move to the next step based on section progress. It is mandatory.

General rules:
- Keep all conversation in the detected language.
- Maintain a helpful, consistent tone.
- Return only the updated JSON — no extra text.
`;

/**
 * Retrieves or creates a conversation for the user
 * @param {string} userId - The user ID
 * @param {string} userMessage - The user's message
 * @param {Date} oneHourAgo - Timestamp for recent conversations
 * @returns {Object} The conversation object
 */
async function getOrCreateConversation(userId, userMessage, oneHourAgo) {
  const dbLookupStartTime = Date.now();
  let conversation = await Conversation.findOne({ userId, updatedAt: { $gte: oneHourAgo } });
  console.log(`DB lookup for conversation completed in ${Date.now() - dbLookupStartTime}ms`);
  
  if (!conversation) {
    conversation = await Conversation.create({
      userId,
      messages: [],
      status: 'active'
    });
  }
  
  // Add user message to conversation
  conversation.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date()
  });
  conversation.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  return conversation;
}

/**
 * Retrieves or creates a curriculum for the user
 * @param {string} userId - The user ID
 * @param {Date} oneHourAgo - Timestamp for recent curriculum
 * @returns {Object} The curriculum object
 */
async function getOrCreateCurriculum(userId, oneHourAgo) {
  const curriculumLookupStartTime = Date.now();
  let curriculum = await Curriculum.findOne({ from: userId, updatedAt: { $gte: oneHourAgo } }) || 
                   await Curriculum.createWithDefaultSections(userId);
  console.log(`DB lookup for curriculum completed in ${Date.now() - curriculumLookupStartTime}ms`);
  
  curriculum.newChatbotMessage = '';
  return curriculum;
}

/**
 * Retrieves the user's profile image
 * @param {string} userId - The user ID
 * @returns {Buffer|null} The profile image data or null if not found
 */
async function getUserProfileImage(userId) {
  try {
    const imageStartTime = Date.now();
    const imageData = await getImageById(userId);
    console.log(`Profile image retrieval completed in ${Date.now() - imageStartTime}ms`);
    return imageData.data;
  } catch (imageError) {
    console.log('No profile image found or error retrieving image:', imageError.message);
    return null; // Return null to allow the main flow to continue, not finish it abruptly
  }
}

/**
 * Prepares the AI prompt with curriculum data and conversation history
 * @param {Object} curriculum - The curriculum object
 * @param {Array} messages - The conversation messages
 * @returns {Array} Array of message objects for the AI
 */
function prepareAIPrompt(curriculum, messages) {
  const promptWithObject = `
  Here is the exact JSON schema you must work on and return when updated: ${JSON.stringify(curriculum)}
  `;
  const conversationHistory = `
  This is the coversation history: ${JSON.stringify(messages)}
  `;
  
  return [
    { role: 'system', content: promptAiFixed0 + promptWithObject + conversationHistory },
  ];
}

/**
 * Updates token usage metadata in the conversation
 * @param {Object} conversation - The conversation object
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 */
function updateTokenMetadata(conversation, inputTokens, outputTokens) {
  // Initialize metadata if it doesn't exist
  if (!conversation.metadata) {
    conversation.metadata = new Map();
  }
  
  // Initialize token counters if they don't exist
  if (!conversation.metadata.get('totalInputTokens')) {
    conversation.metadata.set('totalInputTokens', 0);
  }
  if (!conversation.metadata.get('totalOutputTokens')) {
    conversation.metadata.set('totalOutputTokens', 0);
  }
  
  // Update token counts
  conversation.metadata.set('totalInputTokens',
    parseInt(conversation.metadata.get('totalInputTokens')) + inputTokens);
  conversation.metadata.set('totalOutputTokens',
    parseInt(conversation.metadata.get('totalOutputTokens')) + outputTokens);
  
  // Store token counts for this specific interaction
  const interactionIndex = Math.floor(conversation.messages.length / 2);
  conversation.metadata.set(`interaction_${interactionIndex}_inputTokens`, inputTokens);
  conversation.metadata.set(`interaction_${interactionIndex}_outputTokens`, outputTokens);
  
  // Log token usage for monitoring
  console.log(`Token usage - Input: ${inputTokens}, Output: ${outputTokens}, Total for this interaction: ${inputTokens + outputTokens}`);
  console.log(`Cumulative token usage - Input: ${conversation.metadata.get('totalInputTokens')}, Output: ${conversation.metadata.get('totalOutputTokens')}, Total: ${parseInt(conversation.metadata.get('totalInputTokens')) + parseInt(conversation.metadata.get('totalOutputTokens'))}`);
}

/**
 * Processes the AI response and updates the curriculum
 * @param {string} aiResponseText - The raw AI response text
 * @returns {Object} The parsed AI response
 */
function processAIResponse(aiResponseText) {
  console.log('Raw AI response:', aiResponseText);
  
  // Clean the response as it may contain markdown formatting
  let cleaned = aiResponseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '');
  }
  
  // Try to parse the JSON response
  return JSON.parse(cleaned);
}

/**
 * Handles PDF generation when curriculum status is 'pdf'
 * @param {Object} curriculum - The curriculum object
 * @param {Buffer} profileImage - The user's profile image
 * @param {Object} conversation - The conversation object
 * @returns {Object|null} PDF data and message if generated, null otherwise
 */
async function handlePDFGeneration(curriculum, profileImage, conversation) {
  if (curriculum.status !== 'pdf') {
    return null;
  }
  
  conversation.status = 'pdf';
  
  try {
    // Generate PDF when conversation is completed
    const pdfStartTime = Date.now();
    const pdfResult = await generatePDF(curriculum, profileImage);
    const pdfData = pdfResult.pdfBuffer;
    const pdfFilename = pdfResult.filename;
    
    console.log(`PDF generated successfully in ${Date.now() - pdfStartTime}ms`);
    curriculum.status = 'completed';
    
    // Generate a dynamic message using OpenAI instead of hardcoded text
    const systemPromptPdfGenerating = `The resume has been finalized and the PDF was sent. 
      Your task is to generate a brief and friendly message. 
      The message should inform the user that the PDF was sent. 
      Also, ask if they would like to regenerate the PDF with a different style ('modern' or 'plain').
      Respond with only the message content as a string.
      I am providing with the last messages from the conversation to help you understand the context, keep tone, style.
      ${JSON.stringify(conversation.messages.slice(-5))}`;
    
    const aiCallStartTime = Date.now();

    // construct a valid Token count for each interaction in a separated model pero suer
    const { response } = await callOpenAIWithTokenCount({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPromptPdfGenerating }
      ]
    });
    
    const generatingPdfMessage = response.choices[0].message.content;
    console.log(`Generated PDF message in ${Date.now() - aiCallStartTime}ms:`, generatingPdfMessage);
    
    // Add the message to the conversation
    conversation.messages.push({
      role: 'assistant',
      content: generatingPdfMessage,
      timestamp: new Date()
    });
    
    // Save data asynchronously
    saveDataAsync(conversation, curriculum);
    
    return {
      message: generatingPdfMessage,
      pdfData,
      pdfFilename,
      status: curriculum.status
    };
  } catch (error) {
    console.error('Error generating PDF:', error);
    return null; // Continue with the conversation even if PDF generation fails
  }
}

/**
 * Saves conversation and curriculum data asynchronously
 * @param {Object} conversation - The conversation object
 * @param {Object} curriculum - The curriculum object
 */
function saveDataAsync(conversation, curriculum) {
  const dbSaveStartTime = Date.now();
  
  // Start save operations without awaiting them
  conversation.save()
    .then(() => console.log('Conversation saved successfully in background thread'))
    .catch(err => console.error('Error saving conversation in background:', err));
  
  curriculum.save()
    .then(() => console.log('Curriculum saved successfully in background thread'))
    .catch(err => console.error('Error saving curriculum in background:', err));
  
  console.log(`Database save initiated in ${Date.now() - dbSaveStartTime}ms`);
}

/**
 * Handles error recovery with a simplified prompt
 * @param {Object} conversation - The conversation object
 * @param {Date} startTime - The start time of the process
 * @returns {Object} A simplified response
 */
async function handleErrorRecovery(conversation, startTime) {
  console.log('Using simplified prompt for error');
  
  try {
    // Use a simplified prompt that focuses on just returning valid JSON
    const simplifiedMessages = [
      {
        role: 'system',
        content: `You are an assistant for creating resumes (CVs).
            Now the main flow is having issues and the user is expecting a curriculum in PDF format will be generated.
            The idea is to craft a message to let the user know we are having issues and the pdf will be sent when ready.
            I am providing with the last messages from the conversation so you can get the tone and style.
            ${JSON.stringify(conversation.messages.slice(-5))}`
      }
    ];
    
    const simplifiedAiStartTime = Date.now();
    
    // construct a valid Token count for each interaction in a separated model pero suer
    const { response } = await callOpenAIWithTokenCount({
      model: 'gpt-4o-mini',
      messages: simplifiedMessages
    });
    
    const simpleResponseText = response.choices[0].message.content;
    
    console.log(`Successfully got response with simplified prompt in ${Date.now() - simplifiedAiStartTime}ms`, simpleResponseText);
    
    conversation.messages.push({
      role: 'assistant',
      content: simpleResponseText,
      timestamp: new Date()
    });
    
    // Save conversation asynchronously
    conversation.save()
      .then(() => console.log('Conversation saved successfully in background thread'))
      .catch(err => console.error('Error saving conversation in background:', err));
    
    const totalExecutionTime = Date.now() - startTime;
    console.log(`---------- cvAgent END [${new Date().toISOString()}] ---------- Total execution time: ${totalExecutionTime}ms`);
    
    return {
      message: simpleResponseText,
      pdfData: null,
      pdfFilename: null,
      status: "retry"
    };
  } catch (finalError) {
    console.error('Final retry attempt failed:', finalError.message);
    console.log('Using fallback response');
    return null;
  }
}

/**
 * Main CV Agent orchestration logic, separated from route layer.
 */
async function cvAgent(req) {
  const startTime = Date.now();
  console.log(`---------- cvAgent START [${new Date().toISOString()}] ---------- request.body ${JSON.stringify(req.body)}`);
  const { from, userMessage } = req.body;

  // Calculate one hour ago for recent conversations/curriculum
  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);

  try {
    // Step 1: Get or create conversation and curriculum
    const conversation = await getOrCreateConversation(from, userMessage, oneHourAgo);
    const curriculum = await getOrCreateCurriculum(from, oneHourAgo);
    
    // Step 2: Get profile image if available
    const profileImage = await getUserProfileImage(from);
    if (profileImage) {
      curriculum.image = true;
    }
    
    // Step 3: Prepare AI prompt and call OpenAI
    const inputMessages = prepareAIPrompt(curriculum, conversation.messages);
    const aiLoopStartTime = Date.now();
    const aiCallStartTime = Date.now();
    
    console.log('Input messages:', inputMessages);
    
    // construct a valid Token count for each interaction in a separated model pero suer
    const { response, inputTokens, outputTokens } = await callOpenAIWithTokenCount({
      model: 'gpt-4o-mini', //'gpt-4o',
      messages: inputMessages
    });
    
    console.log(`OpenAI API call completed in ${Date.now() - aiCallStartTime}ms`);
    
    // Step 4: Update token usage metadata
    updateTokenMetadata(conversation, inputTokens, outputTokens);
    
    // Step 5: Process AI response
    const aiResponse = processAIResponse(response.choices[0].message.content);
    
    // Step 6: Update curriculum with AI response
    Object.assign(curriculum, aiResponse);
    
    // Step 7: Handle PDF generation if needed
    const pdfResult = await handlePDFGeneration(curriculum, profileImage, conversation);
    if (pdfResult) {
      return pdfResult;
    }
    
    // Step 8: Add assistant message to conversation
    conversation.messages.push({
      role: 'assistant',
      content: curriculum.newChatbotMessage,
      timestamp: new Date()
    });
    
    // Step 9: Save data asynchronously
    saveDataAsync(conversation, curriculum);
    
    console.log(`AI processing loop completed in ${Date.now() - aiLoopStartTime}ms`);
    
    // Step 10: Return response
    const totalExecutionTime = Date.now() - startTime;
    console.log(`---------- cvAgent END [${new Date().toISOString()}] ---------- Total execution time: ${totalExecutionTime}ms`);
    
    return {
      message: curriculum.newChatbotMessage,
      pdfData: null,
      pdfFilename: null,
      status: curriculum.status
    };
  } catch (error) {
    console.error(`Error:`, error.message);
    return await handleErrorRecovery(await getOrCreateConversation(from, userMessage, oneHourAgo), startTime);
  }
}

module.exports = { cvAgent };