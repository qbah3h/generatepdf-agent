const Curriculum = require('../models/curriculum');
const Conversation = require('../models/conversation');
// const PdfMetadata = require('../models/pdfMetadata');
const { callOpenAIWithTokenCount } = require('../utils/tokenUtils');
const { generatePDF } = require('../utils/httpUtils');
const { getImageById, deleteImage } = require('../services/imageService');

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
- Defines the desired visual style of the PDF. Acceptable values are 'modern' or 'plain'.
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

const promptAiFixed = `
You are an AI assistant for building resumes using a JSON model. Some fields are filled; others are empty. Complete missing fields and return only the updated JSON. Do not alter existing data. Maintain the original structure.

At the beginning (inferred from a new chat), introduce yourself as an AI assistant for resume creation.

Field handling rules:

- **status**: Tracks resume progress.
  - Set to 'active' while editing.
  - Do **not** set to 'pdf' unless:
    - The user explicitly states the resume is complete, **and** you have confirmed it with them.
    - OR the user directly requests to generate the PDF.
  - Always confirm completion before changing the status to 'pdf'.

- **language**: Detect from first user input ('en' or 'es'). Translate future input if mixed. Use this language consistently, except for technical terms.

- **style**: Resume style ('modern' or 'plain'). Default to 'plain' if missing. Translate to English if provided in another language.

- **image**: If false and all sections are complete, prompt for upload. If true, ask whether to generate PDF or upload a new image.

- **currentSection**: Tracks the section in progress.

- **section**: Array of resume sections. Update based on latest user message. Each section has a status: 'pending', 'working', or 'completed'. Confirm completion before moving on. Correct spelling/grammar in section names.

- **newChatbotMessage**: Message to send back to the user. Summarize updates, ask clarifying questions, or move to the next step based on section progress.

General rules:
- Keep all conversation in the detected language.
- Maintain a helpful, consistent tone.
- Return only the updated JSON — no extra text.
`;

/**
 * Main CV Agent orchestration logic, separated from route layer.
 */
async function cvAgent(req) {
  const startTime = Date.now();
  console.log(`---------- cvAgent START [${new Date().toISOString()}] ---------- request.body ${JSON.stringify(req.body)}`)
  const { from, userMessage } = req.body;

  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const dbLookupStartTime = Date.now();
  let conversation = await Conversation.findOne({ userId: from, updatedAt: { $gte: oneHourAgo } });
  console.log(`DB lookup for conversation completed in ${Date.now() - dbLookupStartTime}ms`);
  if (!conversation) {
    conversation = await Conversation.create({
      userId: from,
      messages: [],
      status: 'active'
    });
  }

  const curriculumLookupStartTime = Date.now();
  let curriculum = await Curriculum.findOne({ from, updatedAt: { $gte: oneHourAgo } }) || await Curriculum.createWithDefaultSections(from);
  console.log(`DB lookup for curriculum completed in ${Date.now() - curriculumLookupStartTime}ms`);

  curriculum.newChatbotMessage = '';

  conversation.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date()
  });
  conversation.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Try to get profile image for the user
  let profileImage = null;
  try {
    const imageStartTime = Date.now();
    const imageData = await getImageById(from);
    profileImage = imageData.data;
    console.log(`Profile image retrieval completed in ${Date.now() - imageStartTime}ms`);
  } catch (imageError) {
    console.log('No profile image found or error retrieving image:', imageError.message);
    // Continue without image if not found or error occurs
  }

  if (profileImage) {
    curriculum.image = true;
  }

  const promptWithObject = `Here is the exact JSON schema you must work on and return when updated: ${JSON.stringify(curriculum)}`;
  const conversationHistory = `This is the coversation history: ${JSON.stringify(conversation.messages)}`;

  let inputMessages = [
    { role: 'system', content: promptAiFixed + promptWithObject + conversationHistory },
  ];

  // Add retry logic for AI calls
  let aiResponse = null;
  let retryCount = 0;
  const MAX_RETRIES = 5;
  let errorOccurred = false;

  const aiLoopStartTime = Date.now();
  while (aiResponse === null && retryCount < MAX_RETRIES) {
    try {
      // First attempt or retry with the same prompt
      const aiCallStartTime = Date.now();
      if (retryCount === MAX_RETRIES - 1) {
        console.log(`Retrying AI call for ${retryCount} time. Previous errors: ${errorOccurred}`);

        const action = `You are an assistant for creating resumes (CVs).
        Only update the sections values, and the nextChatbotMessage field. Do not update any other field.
        Given the JSON object and the conversation history, fill the JSON with the apropiate information.
        The JSON may contain sections that are not complete, so you must check them and fill them with the apropiate information if needed.
        Return the updated JSON object. It will be used as an input for a javascript function.`;
        inputMessages = [
          { role: 'system', content: action + promptWithObject + conversationHistory },
        ];
      }

      console.log('Input messages:', inputMessages);

      const { response, inputTokens, outputTokens } = await callOpenAIWithTokenCount({
        model: 'gpt-4o-mini', //'gpt-4o',
        messages: inputMessages
      });

      // Store token counts in conversation metadata
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
      console.log(`OpenAI API call completed in ${Date.now() - aiCallStartTime}ms`);

      const aiResponseText = response.choices[0].message.content;
      console.log('Raw AI response:', aiResponseText);

      // Clean the response as it may contain markdown formatting
      let cleaned = aiResponseText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '');
      }

      // Try to parse the JSON response
      aiResponse = JSON.parse(cleaned);

      // Apply the AI response to the curriculum
      Object.assign(curriculum, aiResponse);

      let pdfData = null;
      let pdfFilename = null;
      if (curriculum.status === 'pdf') {

        conversation.status = 'pdf';
        try {
          // Generate PDF when conversation is completed
          const pdfStartTime = Date.now();
          const pdfResult = await generatePDF(curriculum, profileImage);
          pdfData = pdfResult.pdfBuffer;
          pdfFilename = pdfResult.filename;

          console.log(`PDF generated successfully with filename: ${pdfFilename} in ${Date.now() - pdfStartTime}ms`);
          curriculum.status = 'completed';

          // Delete the image from the filesystem
          // if (profileImage) {
          //   await deleteImage(from);
          // }

          const systemPromptPdfGenerating = `The resume has been finalized and the PDF is being generated. 
          Your task is to generate a brief and friendly message in the same language as the user (detected from previous messages). 
          The message should inform the user that the PDF is being generated and sent. 
          Also, ask if they would like to regenerate the PDF with a different style ('plain' or 'modern').
          Respond with only the message content as a string.
          I am providing with the last messages from the conversation to help you understand the context.
          ${JSON.stringify(conversation.messages.slice(-5))}`;
          
          inputMessages = [
            { role: 'system', content: systemPromptPdfGenerating },
          ];
          
          const aiCallStartTime = Date.now();
          const { response, inputTokens, outputTokens } = await callOpenAIWithTokenCount({
            model: 'gpt-4o-mini', //'gpt-4o',
            messages: inputMessages
          });

          const generatingPdfMessage = response.choices[0].message.content;

          console.log(`Successfully got response with simplified prompt in ${Date.now() - aiCallStartTime}ms`, generatingPdfMessage);

          conversation.messages.push({
            role: 'assistant',
            content: generatingPdfMessage,
            timestamp: new Date()
          });

          conversation.status = 'archived';

          const fallbackDbSaveStartTime = Date.now();
          await conversation.save();
          await curriculum.save();
          console.log(`Database save completed in ${Date.now() - fallbackDbSaveStartTime}ms`);

          return {
            message: generatingPdfMessage,
            pdfData: pdfData,
            pdfFilename: pdfFilename,
            status: curriculum.status
          };

        } catch (error) {
          console.error('Error generating PDF:', error);
          // Continue with the conversation even if PDF generation fails
        }
      }

      conversation.messages.push({
        role: 'assistant',
        content: curriculum.newChatbotMessage,
        timestamp: new Date()
      });
      const dbSaveStartTime = Date.now();
      await conversation.save();
      await curriculum.save();
      console.log(`Database save completed in ${Date.now() - dbSaveStartTime}ms`);

      // If we had an error before but succeeded now, log the recovery
      if (errorOccurred) {
        console.log(`Successfully recovered from previous error on retry ${retryCount}`);
      }

      console.log(`AI processing loop completed in ${Date.now() - aiLoopStartTime}ms`);

      // Return the chatbot message, PDF data, and filename (if generated)
      const totalExecutionTime = Date.now() - startTime;
      console.log(`---------- cvAgent END [${new Date().toISOString()}] ---------- Total execution time: ${totalExecutionTime}ms`);
      return {
        message: curriculum.newChatbotMessage,
        pdfData: pdfData,
        pdfFilename: pdfFilename,
        status: curriculum.status
      };

    } catch (error) {
      retryCount++;
      errorOccurred = true;
      console.error(`Error on AI call attempt ${retryCount}:`, error.message);

      // If this is the last retry, modify the approach
      if (retryCount === 1 && curriculum.status === 'pdf') {
        console.log('Using simplified prompt for first retry attempt at pdf status');

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
          const fallbackDbSaveStartTime = Date.now();
          await conversation.save();
          console.log(`Fallback database save completed in ${Date.now() - fallbackDbSaveStartTime}ms`);

          // Return the chatbot message, PDF data, and filename (if generated)
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

          // Create a minimal valid response as fallback

          console.log('Using fallback response');
          return;
        }
      } else if (retryCount < MAX_RETRIES - 1) {
        // Wait before retrying (exponential backoff)
        const waitTime = Math.pow(2, retryCount) * 1000;
        console.log(`Waiting ${waitTime}ms before retry ${retryCount + 1}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}

// Add a final fallback return with timing in case all retries fail
module.exports = { cvAgent };