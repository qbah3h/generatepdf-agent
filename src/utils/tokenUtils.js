async function callOpenAIWithTokenCount({ model, messages }) {
  const openai = require('../config/openai');
  const response = await openai.chat.completions.create({
    model,
    messages
  });
  
  // Use token counts from the API response instead of tiktoken
  const outputTokens = response.usage.completion_tokens;
  const inputTokens = response.usage.prompt_tokens;
  return { response, inputTokens, outputTokens };
}

module.exports = { callOpenAIWithTokenCount };