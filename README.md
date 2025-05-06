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

- **AI-Powered Conversation**: Uses OpenAI's GPT-4o-mini model to guide users through the CV creation process
- **PDF Generation**: Converts structured CV data into professional PDF documents
- **Profile Image Support**: Allows users to upload and include profile images in their CVs
- **Conversation Management**: Tracks and maintains conversation history
- **Multiple Languages**: Supports both English and Spanish conversations
- **Multiple CV Styles**: Offers different resume styles (modern, plain)
- **Stateful Processing**: Maintains the state of the CV creation process
- **IP Filtering**: Includes middleware for IP-based access control
- **Error Recovery**: Implements robust error handling with simplified fallback responses

## Architecture

The application follows a modular architecture:

```
src/
├── config/          # Configuration files and database connection
├── middleware/      # Custom middleware (IP filtering, orchestration)
├── models/          # Database models (Curriculum, Conversation)
├── routes/          # API routes
├── services/        # Business logic
│   ├── cvAgentService.js  # Main CV generation orchestration
│   ├── imageService.js    # Image handling functionality
├── utils/           # Helper functions
│   ├── httpUtils.js      # PDF generation HTTP requests
│   ├── tokenUtils.js     # OpenAI token counting
│   ├── fileStorage.js    # File storage utilities
└── app.js           # Main application file
```

## API Endpoints

- **POST /api/agent/text**: Process text-based CV information
- **POST /api/agent/image**: Upload and process profile images

## Technical Stack

- **Backend**: Node.js with Express
- **AI**: OpenAI GPT-4o-mini model
- **Database**: MongoDB for storing conversations and CV data
- **File Handling**: Multer for image uploads
- **Security**: IP filtering middleware
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

## How It Works

1. The user sends a message to the `/api/agent/text` endpoint or uploads an image to `/api/agent/image`
2. The orchestrateProcessing middleware handles the request and passes it to the cvAgent service
3. The cvAgent service retrieves or creates conversation and curriculum records for the user
4. The message is processed by the OpenAI GPT-4o-mini model with a specialized prompt
5. The AI generates a response and updates the curriculum data
6. If the curriculum status is set to 'pdf', the system generates a PDF using the external service
7. The response (and PDF if generated) is returned to the user

## Error Handling

The system implements robust error recovery:
1. If the main AI processing fails, it attempts to recover with a simplified prompt
2. Token usage is carefully tracked and monitored
3. Asynchronous data saving prevents blocking the main response flow

## External PDF Service

The application integrates with an external PDF generation service at `http://167.114.145.216:8090/api/cv/generate` that:
- Expects POST requests with Content-Type: application/json
- Requires Accept: application/json
- Accepts JSON curriculum data following a specific structure
- Optionally accepts profile images
- Returns PDF content as an arraybuffer
- Response should be served with Content-Type: application/pdf