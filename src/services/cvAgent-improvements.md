# CV Agent Implementation Recommendations

This document outlines recommended improvements for the `cvAgent` function and related code in the PDF generation service. These recommendations aim to enhance code quality, maintainability, performance, and security.

## Error Handling Improvements

### 1. Structured Error Handling
- Implement custom error types for different failure scenarios:
  ```javascript
  class ApiError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
    }
  }
  
  class ParsingError extends Error {
    constructor(message, rawData) {
      super(message);
      this.name = 'ParsingError';
      this.rawData = rawData;
    }
  }
  ```
- Add specific error handling for each error type with appropriate recovery strategies

### 2. Complete Error Handling Flow
- Implement proper error handling for PDF generation failures
- Add user-friendly error messages and error codes
- Ensure all errors are properly logged with context information
- Implement graceful degradation when services are unavailable

## Code Structure and Organization

### 1. Function Size and Responsibility
Break down the large `cvAgent` function into smaller, focused functions:

```javascript
async function cvAgent(req) {
  const { from, userMessage } = req.body;
  
  // Get or create conversation and curriculum
  const { conversation, curriculum } = await getOrCreateUserData(from, userMessage);
  
  // Process profile image if available
  await handleProfileImage(from, curriculum);
  
  // Process AI interaction
  const aiResult = await processAIInteraction(conversation, curriculum);
  
  // Handle PDF generation if needed
  if (curriculum.status === 'pdf') {
    await handlePDFGeneration(conversation, curriculum);
  }
  
  // Save updated data
  await saveUserData(conversation, curriculum);
  
  return createResponse(curriculum);
}
```

### 2. Separation of Concerns
- Move token tracking logic to a separate utility function
- Extract the retry mechanism into a reusable wrapper function:
  ```javascript
  async function withRetry(operation, maxRetries = 5) {
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        retryCount++;
        console.log(`Retry ${retryCount}/${maxRetries} failed: ${error.message}`);
        // Implement exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      }
    }
    
    throw lastError;
  }
  ```

## Performance and Efficiency

### 1. Database Optimization
- Use Promise.all for parallel database operations:
  ```javascript
  const [conversation, curriculum] = await Promise.all([
    Conversation.findOne({ userId: from, updatedAt: { $gte: oneHourAgo } }),
    Curriculum.findOne({ from, updatedAt: { $gte: oneHourAgo } })
  ]);
  ```
- Consider implementing caching for frequently accessed data
- Use more efficient query patterns (indexes, projections)

### 2. Async/Await Usage
- Identify opportunities for parallel processing
- Avoid unnecessary sequential operations
- Use Promise.all where appropriate for independent operations

## Security Considerations

### 1. Input Validation
- Add validation for user input before processing:
  ```javascript
  function validateUserInput(userMessage) {
    if (!userMessage || typeof userMessage !== 'string') {
      throw new Error('Invalid user message');
    }
    
    if (userMessage.length > 2000) {
      throw new Error('User message exceeds maximum length');
    }
    
    return userMessage.trim();
  }
  ```
- Sanitize data before storing in the database or sending to external services

### 2. JSON Parsing Safety
- Implement safer JSON parsing with proper error handling:
  ```javascript
  function safeJSONParse(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new ParsingError(`Failed to parse JSON: ${error.message}`, jsonString);
    }
  }
  ```
- Add validation for parsed data structure

## Maintainability and Scalability

### 1. Configuration Management
- Move hardcoded values to configuration files:
  ```javascript
  // config.js
  module.exports = {
    ai: {
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      maxRetries: parseInt(process.env.AI_MAX_RETRIES || '5'),
      timeout: parseInt(process.env.AI_TIMEOUT || '30000')
    },
    conversation: {
      expirationHours: parseInt(process.env.CONVERSATION_EXPIRATION_HOURS || '1')
    }
  };
  ```
- Use environment variables for sensitive or environment-specific settings

### 2. Logging Improvements
- Implement structured logging instead of console.log:
  ```javascript
  const logger = require('./logger');
  
  logger.info('Processing request', { userId: from, messageLength: userMessage.length });
  logger.error('Failed to generate PDF', { error: error.message, userId: from });
  ```
- Add request IDs for tracing requests through the system

### 3. Documentation
- Add JSDoc comments for all functions:
  ```javascript
  /**
   * Processes a user message and generates an AI response
   * @param {Object} conversation - The conversation object from the database
   * @param {Object} curriculum - The curriculum object from the database
   * @returns {Object} - The AI response object
   * @throws {ApiError} - If the AI service fails
   * @throws {ParsingError} - If the AI response cannot be parsed
   */
  async function processAIInteraction(conversation, curriculum) {
    // Implementation
  }
  ```
- Document the expected data structures and flow

## PDF Generation Specific Improvements

### 1. Service Integration
- Ensure proper Content-Type headers are set for the PDF service:
  ```javascript
  const response = await axios.post(
    `${process.env.SERVICE_URL}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json'
      },
      responseType: 'arraybuffer'
    }
  );
  ```
- Implement proper error handling for PDF service connection issues

### 2. Data Validation
- Validate curriculum data against the expected schema before sending to the PDF service:
  ```javascript
  function validateCurriculumData(data) {
    const requiredFields = ['fullName', 'email', 'phone', 'address', 'summary'];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    return data;
  }
  ```
- Ensure all required fields are present and properly formatted

### 3. Resource Management
- Implement proper cleanup of temporary resources (like profile images)
- Consider implementing a timeout for the PDF generation service:
  ```javascript
  const response = await axios.post(
    `${process.env.SERVICE_URL}`,
    formData,
    {
      headers: { /* ... */ },
      responseType: 'arraybuffer',
      timeout: 30000 // 30 seconds timeout
    }
  );
  ```

## Testing Recommendations

### 1. Unit Tests
- Add unit tests for individual functions:
  ```javascript
  // tests/unit/cvAgentService.test.js
  describe('processAIInteraction', () => {
    it('should process AI interaction successfully', async () => {
      // Test implementation
    });
    
    it('should handle AI service failures', async () => {
      // Test implementation
    });
  });
  ```
- Mock external dependencies (OpenAI, database, PDF service)

### 2. Integration Tests
- Test the full flow from user input to PDF generation
- Test error scenarios and recovery mechanisms
- Implement end-to-end tests for critical paths

## Implementation Plan

1. Refactor the code structure first (break down large functions)
2. Implement error handling improvements
3. Add configuration management
4. Optimize database operations
5. Enhance security measures
6. Improve logging and documentation
7. Add tests for each component
8. Implement PDF generation specific improvements
