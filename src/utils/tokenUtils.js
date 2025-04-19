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

async function callOpenAIWithTokenCount({ model, messages }) {
  // Count input tokens (all message contents)
  const inputText = messages.map(m => m.content).join(' ');
  const inputTokens = countTokens(inputText);

  const openai = require('../config/openai');
  const response = await openai.chat.completions.create({
    model,
    messages
  });

  // Output tokens (estimate or extract from response if available)
  const outputTokens = countTokens(response.choices[0].message.content);
  return { response, inputTokens, outputTokens };
}

module.exports = { getEncoder, countTokens, callOpenAIWithTokenCount };