<!-- TEST 5 -->
# GeneratePDF Agent Service

An AI agent service that exposes a REST API endpoint for PDF generation.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the application in development mode:
   ```bash
   npm run dev
   ```

3. Run the application in production mode:
   ```bash
   npm start
   ```

## CI/CD Pipeline Setup

This project uses GitHub Actions for CI/CD to automatically deploy to a VPS server with PM2. Follow these steps to set up the deployment pipeline:

1. On your VPS server, install Node.js, Git, and PM2:
   ```bash
   # Update package lists
   sudo apt update
   
   # Install Node.js and npm
   sudo apt install nodejs npm
   
   # Install PM2 globally
   sudo npm install -g pm2
   ```

2. Create the following secrets in your GitHub repository (Settings > Secrets and variables > Actions):
   - `VPS_HOST`: Your VPS server IP address or domain name
   - `VPS_USERNAME`: SSH username for your VPS
   - `VPS_SSH_KEY`: Private SSH key for authentication (the content of your private key file)
   - `VPS_PORT`: SSH port (usually 22)
   - `PROJECT_PATH`: Absolute path to your project directory on the VPS

3. Set up SSH key-based authentication on your VPS:
   - Generate an SSH key pair if you don't have one
   - Add the public key to your VPS's `~/.ssh/authorized_keys` file
   - Use the private key as the `VPS_SSH_KEY` secret in GitHub

4. Push to the main branch to trigger the deployment:
   ```bash
   git push origin main
   ```

The workflow will:
- Pull the latest code from the main branch
- Install dependencies
- Start or reload the application using PM2

Based on your current codebase and requirements, here are the next steps I recommend:

Database Integration
Set up a MongoDB or PostgreSQL database to store:
User conversations/history
User preferences and settings
Generated PDF metadata
Create schemas for conversation history and user data
API Structure Enhancement
Implement proper middleware for:
Authentication/Authorization
Request validation
Error handling
Create separate route handlers and controllers
Add request rate limiting
LLM Integration
Add OpenAI/other LLM provider integration
Create a service layer to handle LLM interactions
Implement prompt engineering and context management
Add fallback mechanisms for API failures
File Structure Reorganization
CopyInsert
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Custom middleware
├── models/         # Database models
├── routes/         # API routes
├── services/       # Business logic
│   ├── llm/       # LLM integration
│   ├── pdf/       # PDF generation
│   └── chat/      # Chat history management
├── utils/          # Helper functions
└── app.js         # Main application file
Conversation Management
Implement conversation threading
Add context management for LLM
Store conversation history with metadata
Add ability to reference previous conversations
Error Handling & Logging
Implement structured logging
Add error monitoring (e.g., Sentry)
Create proper error responses
Would you like me to help you implement any of these components? We can start with:

Setting up the database structure
Reorganizing the code structure
Implementing the LLM integration