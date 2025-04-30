const Curriculum = require('../models/curriculum');
const Conversation = require('../models/conversation');
// const PdfMetadata = require('../models/pdfMetadata');
const { callOpenAIWithTokenCount } = require('../utils/tokenUtils');
const { generatePDF } = require('../utils/httpUtils');
const { getImageById, deleteImage } = require('../services/imageService');

const promptAiFixed = `
You are an assistant for creating resumes (CVs).
You will have access to a data model in JSON format, and your responsibility is to complete and keep it updated.

In the JSON, fields of the model are included — some with information, and others without.
Your job is to fill in the missing information and return the updated JSON, keeping both the existing and the new information placed into the appropriate fields.

At the beginning of the conversation (infered because the chat history indicates the user just started the conversation):
- Introduce yourself as a virtual assistant powered by artificial intelligence for helping create resumes.

Handling the status:
- If the user confirms they have completed their curriculum, update the status to 'pdf'.
- Only when the status is in 'pdf' the curriculum will be generated and sent to the user (this is automatically done by the system).
- If, based on context, the status was set to 'pdf', ask the user if they would like a different style.

Description of JSON Fields (as a guide):

- from: user creating the curriculum. //automatically filled
- language: user's language.
  - You must detect this in the first interaction and set it to 'es' (Spanish) or 'en' (English).
  - After detecting the language, keep all further information in that language.
  - If some user messages mix languages, translate into the identified language, except for technical terms (which may stay in English).
- newChatbotMessage: you must create a new prompt/message suggesting to the user what information to enter next or to provide they with context about the status of the process. This field's content is what will be returned to the user. //to be updated by you
- status: indicates the overall status of the resume. 
  - 'active': still working on it.
  - 'pdf': once the status is set to 'pdf' the system automatically will generate the pdf and send it to the user. Whenever the user states they want to generate the pdf, set the status to 'pdf'.

- style: indicates the desired style of the PDF. //to be updated by you
  - Options: 'modern', 'plain'.
  - If no style is provided, use the default style (plain).
  - Take into account that the user may specify the style in a language other than English, but this section value must be in English, as the function only accepts 'modern' or 'plain'.

- image: indicates if the user has uploaded a profile image. //the system will automatically update this when the user uploads a new picture.
  - If false when all sections are complete, ask the user to upload one.
  - If true and all sections are complete, ask the user if they want to generate the PDF or upload a new image.

- currentSection: the current section being worked on. //to be updated by you
  - Use this to track where you are.

- section: array of objects containing curriculum information. //to be updated by you
  - Update this array based on user input (from the conversation history, the last message should give you the needed information).
  - Each section has a status field ('completed', 'working', 'pending'), which you must update.
  - After completing a section, confirm with the user if anything else should be added before moving to the next.
  - Once a section is confirmed as complete, move on to another section.
  - Check the spelling of the section values, as the user may make spelling or grammatical errors.

Important rules:
- Always return only the updated JSON object — it will be passed to a function.
- Keep the entire conversation in the same language detected from the first user interaction (language field).
`;


/**
 * Main CV Agent orchestration logic, separated from route layer.
 */
async function cvAgent(req) {
  console.log(`---------- cvAgent ---------- request.body ${JSON.stringify(req.body)}`)
  const { from, userMessage } = req.body;

  const twelveHoursAgo = new Date();
  twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 1);

  let conversation = await Conversation.findOne({ userId: from, updatedAt: { $gte: twelveHoursAgo } });
  if (!conversation) {
    conversation = await Conversation.create({
      userId: from,
      messages: [],
      status: 'active'
    });
  }

  let curriculum = await Curriculum.findOne({ from, updatedAt: { $gte: twelveHoursAgo } }) || await Curriculum.createWithDefaultSections(from);
  // curriculum.userMessage = userMessage;

  // if (conversation.messages.length > 0) {
  //   curriculum.prevChatbotMessage = conversation.messages[conversation.messages.length - 1].content;
  // }

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
    const imageData = await getImageById(from);
    profileImage = imageData.data;
  } catch (imageError) {
    console.log('No profile image found or error retrieving image:', imageError.message);
    // Continue without image if not found or error occurs
  }

  if (profileImage) {
    curriculum.image = true;
  }

  const promptWithObject = `Here is the exact JSON schema you must work on and return when updated: ${JSON.stringify(curriculum)}`;
  const conversationHistory = `This is the coversation history: ${JSON.stringify(conversation.messages)}`;

  const inputMessages = [
    { role: 'system', content: promptAiFixed + promptWithObject + conversationHistory },
  ];
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

  const aiResponseText = response.choices[0].message.content;
  console.log('Raw AI response:', aiResponseText);

  // to clean the response as it conaing no JSON data
  let cleaned = aiResponseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '');
  }

  const aiResponse = JSON.parse(cleaned);
  Object.assign(curriculum, aiResponse);

  let pdfData = null;
  if (curriculum.status === 'pdf') {

    conversation.status = 'pdf';
    try {
      // Generate PDF when conversation is completed

      pdfData = await generatePDF(curriculum, profileImage);
      curriculum.status = 'completed';
      
      // Delete the image from the filesystem
      // if (profileImage) {
      //   await deleteImage(from);
      // }

    } catch (error) {
      console.error('Error generating PDF:', error);
      // Continue with the conversation even if PDF generation fails
    }
  }

  // create similar to set the status to PDF
  if (curriculum.status === 'completed') {
    conversation.status = 'archived';
  }

  conversation.messages.push({
    role: 'assistant',
    content: curriculum.newChatbotMessage,
    timestamp: new Date()
  });
  await conversation.save();
  await curriculum.save();

  // Return both the chatbot message and PDF data (if generated)
  return {
    message: curriculum.newChatbotMessage,
    pdfData: pdfData,
    status: curriculum.status
  };
}

module.exports = { cvAgent };