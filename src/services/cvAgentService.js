const Curriculum = require('../models/curriculum');
const Conversation = require('../models/conversation');
const { callOpenAIWithTokenCount } = require('../utils/tokenUtils');

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
Use "ready" once all required fields are complete and the user has confirmed they’re ready to generate the PDF.
Do not include extra explanations or summaries. Return only the updated JSON object as it will be used as a function input.
Respect the original structure.
Update only one section at a time. For example, ask for the full name, then update the information section with it. The next iteration will be based on the updated JSON.
Use lastChatbotMessage + userMessage as your state of the conversation history. It should drive what gets asked or updated next.
Always return a full updated JSON with the new message and any changed fields only.
Only update chatbotMessage and section if the user has provided a valid input. Do not update any other field`;

  const { from, text } = req.body;

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
    curriculum.prevChatbotMessage = conversation.messages[conversation.messages.length - 1].content;
  }

  curriculum.newChatbotMessage = '';

  conversation.messages.push({
    role: 'user',
    content: text,
    timestamp: new Date()
  });
  conversation.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const inputMessages = [
    { role: 'system', content: systemPrompt + curriculum },
  ];
  console.log('Input messages:', inputMessages);

  const { response, inputTokens, outputTokens } = await callOpenAIWithTokenCount({
    model: 'gpt-4o',
    messages: inputMessages
  });

  const aiResponseText = response.choices[0].message.content;
  console.log('Raw AI response:', aiResponseText);

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

  conversation.messages.push({
    role: 'assistant',
    content: aiResponse.newChatbotMessage,
    timestamp: new Date()
  });
  await conversation.save();

  return aiResponse.newChatbotMessage;
}

module.exports = { cvAgent };