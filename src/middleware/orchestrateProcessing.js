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
    
    // Check if PDF was generated (conversation completed)
    if (agentResponse && agentResponse.pdfData) {
      // Serve the PDF directly
      res.setHeader('Content-Type', 'application/pdf');
      
      // Use the filename from the response if available, otherwise fallback to default
      const filename = agentResponse.pdfFilename || `${req.body.from}_cv.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); 
      console.log(`Serving PDF with filename: ${filename}`);
      // return res.send(agentResponse.pdfData);
    }
    
    // If no PDF was generated, continue with the normal flow
    req.processedResult = agentResponse;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = orchestrateProcessing;