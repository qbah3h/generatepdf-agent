const Curriculum = require('../models/curriculum');
const Conversation = require('../models/conversation');
const PdfMetadata = require('../models/pdfMetadata');
const { callOpenAIWithTokenCount } = require('../utils/tokenUtils');
const { generatePDF } = require('../utils/httpUtils');
const { getImageById, deleteImage } = require('../services/imageService');

/**
 * Main CV Agent orchestration logic, separated from route layer.
 */
async function cvAgent(req) {
  const systemPrompt = `You are a CV creator assistant. Each time you are prompted with a JSON structure, your task is to complete it.
The JSON will include the changes made during the chat, along with the latest input from the user. You must update the CV sections one at a time, based on both lastChatbotMessage and lastUserMessage.
Your response must always return the updated JSON, including:
- A new message in chatbotMessage — this should be short, assertive, and ask only the necessary question to move the conversation forward.
- An updated status field:
Use "active" if the conversation is still in progress.
Use "pdf" once all required fields are complete and the user has confirmed they’re ready to generate the PDF.
Do not include extra explanations or summaries. Return only the updated JSON object as it will be used as a function input.
Respect the original structure.
Update only one section at a time. For example, ask for the full name, then update the information section with it. The next iteration will be based on the updated JSON.
Use lastChatbotMessage + userMessage as your state of the conversation history. It should drive what gets asked or updated next.
Always return a full updated JSON with the new message and any changed fields only.
Only update chatbotMessage and section if the user has provided a valid input. Do not update any other field.
You can ask for more than one field at a time on the same section.
Use the same language as the userMessage.
Update each section status accordingly 'completed', 'working', 'pending'
Update currentSection depending on the current section you are working on.
If at the begining of the prompt of the user, you receive a "sudo" keyword, you should perform the requested as the developers are making some kind of test`;

console.log(`cvAgent --- Response ${JSON.stringify(req.body)}`)
  const { from, userMessage } = req.body;

  let conversation = await Conversation.findOne({ userId: from, status: 'active' });
  if (!conversation) {
    conversation = await Conversation.create({
      userId: from,
      messages: [],
      status: 'active'
    });
  }

  let curriculum = await Curriculum.findOne({ status: 'active', from }) || await Curriculum.createWithDefaultSections(from);
  curriculum.userMessage = userMessage;

  if (conversation.messages.length > 0) {
    curriculum.prevChatbotMessage = conversation.messages[conversation.messages.length - 1].content;
  }

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

  if(profileImage) {
    curriculum.image = true;
  }
  
  const inputMessages = [
    { role: 'system', content: systemPrompt + "Here is the exact CV schema you must follow: " + JSON.stringify(curriculum) + " Only these fields may be present; do NOT add anything else." },
  ];
  console.log('Input messages:', inputMessages);

  const { response, inputTokens, outputTokens } = await callOpenAIWithTokenCount({
    model: 'gpt-4o-mini', //'gpt-4o',
    messages: inputMessages
  });

  const aiResponseText = response.choices[0].message.content;
  console.log('Raw AI response:', aiResponseText);

  // to clean the response as it conaing no JSON data
  let cleaned = aiResponseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '');
  }

  const aiResponse = JSON.parse(cleaned);
  Object.assign(curriculum, aiResponse);
  await curriculum.save();

  let pdfData = null;
  if (aiResponse.status === 'pdf') {    
    try {
      // Generate PDF when conversation is completed
      pdfData = await generatePDF(curriculum, profileImage);

      // Delete the image from the filesystem
      if(profileImage) {
        await deleteImage(from);
      }
      
      // Save PDF metadata
      await PdfMetadata.create({
        userId: from,
        conversationId: conversation._id,
        filename: `${from}_cv.pdf`,
        template: 'default',
        data: curriculum,
        status: 'generated'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Continue with the conversation even if PDF generation fails
    }
  }

  //review why it is not working
  // create similar to set the status to PDF
  if (aiResponse.status === 'completed') {
    conversation.status = 'completed';
  }

  conversation.messages.push({
    role: 'assistant',
    content: aiResponse.newChatbotMessage,
    timestamp: new Date()
  });
  await conversation.save();

  // Return both the chatbot message and PDF data (if generated)
  return {
    message: aiResponse.newChatbotMessage,
    pdfData: pdfData,
    status: aiResponse.status
  };
}

module.exports = { cvAgent };