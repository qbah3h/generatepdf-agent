const { cvAgent } = require('../services/cvAgentService');

/**
 * Orchestration middleware for processing text/image endpoints.
 */
async function orchestrateProcessing(req, res, next) {
  try {
    const endpoint = req.path.substring(1);
    req.processingContext = {
      endpoint,
      timestamp: new Date().toISOString(),
    };
    
    // Get the response from cvAgent which now includes message and pdfData
    const agentResponse = await cvAgent(req);
    
    req.processedResult = agentResponse;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = orchestrateProcessing;