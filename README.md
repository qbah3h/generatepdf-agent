# CV Generator AI Agent

An intelligent agent service that helps users create professional CVs/resumes through a conversational interface and generates PDF documents.

## Overview

This service combines AI-powered conversation with PDF generation capabilities to help users create professional resumes. The system:

1. Engages users in a conversation to gather CV/resume information
2. Uses OpenAI's GPT models to structure and enhance the provided information
3. Generates a professional PDF resume using an external PDF generation service
4. Supports profile image uploads for the resume
5. Tracks conversation history and maintains user data

## Features

- **AI-Powered Conversation**: Uses OpenAI's GPT models to guide users through the CV creation process
- **PDF Generation**: Converts structured CV data into professional PDF documents
- **Profile Image Support**: Allows users to upload and include profile images in their CVs
- **Conversation Management**: Tracks and maintains conversation history
- **Multiple Languages**: Supports both English and Spanish conversations
- **Multiple CV Styles**: Offers different resume styles (modern, plain)
- **Stateful Processing**: Maintains the state of the CV creation process
- **IP Filtering**: Includes middleware for IP-based access control

## Architecture

The application follows a modular architecture:

```
src/
├── config/          # Configuration files and database connection
├── controllers/     # Request handlers
├── middleware/      # Custom middleware (validation, IP filtering, etc.)
├── models/          # Database models (Curriculum, Conversation)
├── routes/          # API routes
├── services/        # Business logic
│   ├── cvAgentService/  # Main CV generation orchestration
│   ├── imageService/    # Image handling functionality
├── utils/           # Helper functions
│   ├── httpUtils/       # PDF generation HTTP requests
│   ├── tokenUtils/      # OpenAI token counting
│   ├── fileStorage/     # File storage utilities
└── app.js           # Main application file
```

## API Endpoints

- **POST /api/agent/text**: Process text-based CV information
- **POST /api/agent/image**: Upload and process profile images

## Technical Stack

- **Backend**: Node.js with Express
- **AI**: OpenAI GPT models
- **Database**: MongoDB for storing conversations and CV data
- **File Handling**: Multer for image uploads
- **Security**: Helmet for HTTP security headers, IP filtering
- **PDF Generation**: External PDF generation service

## Setup

### Prerequisites

- Node.js (v14+)
- MongoDB
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/qbah3h/generatepdf-agent.git
   cd generatepdf-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/cv-generator
   OPENAI_API_KEY=your_openai_api_key
   SERVICE_URL=http://167.114.145.216:8090/api/cv/generate
   ALLOWED_IPS=127.0.0.1,::1
   ```

4. Run the application:
   - Development mode:
     ```bash
     npm run dev
     ```
   - Production mode:
     ```bash
     npm start
     ```

## CI/CD Pipeline

This project uses GitHub Actions for CI/CD to automatically deploy to a VPS server with PM2:

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
   - `VPS_SSH_KEY`: Private SSH key for authentication
   - `VPS_PORT`: SSH port (usually 22)
   - `PROJECT_PATH`: Absolute path to your project directory on the VPS

3. Set up SSH key-based authentication on your VPS
4. Push to the main branch to trigger the deployment

## How It Works

1. The user sends a message to the `/api/agent/text` endpoint
2. The system retrieves or creates a conversation and curriculum record for the user
3. The message is processed by the OpenAI model with a specialized prompt
4. The AI generates a response and updates the curriculum data
5. If the curriculum status is set to 'pdf', the system generates a PDF using the external service
6. The response (and PDF if generated) is returned to the user

## External Services

The application integrates with an external PDF generation service at `http://167.114.145.216:8090/api/cv/generate` that:
- Accepts POST requests with JSON curriculum data
- Optionally accepts profile images
- Returns PDF content as an array buffer