# generatepdf-agent — Conversational AI Resume Builder

The AI engine behind the resume assistant. This Node.js/Express service manages conversational interactions with users, guides them through resume creation section by section, and orchestrates PDF generation through the companion Java service.

## How It Works

```
User Message
      |
      v
  [Express Router + IP Filter]
      |
      v
  [Orchestration Middleware]
      |
      v
  [cvAgentService]
      |
      +---> getOrCreateConversation()   --- MongoDB lookup/create
      +---> getOrCreateCurriculum()     --- Curriculum with default sections
      +---> getUserProfileImage()       --- Image retrieval
      +---> prepareAIPrompt()           --- System prompt + curriculum JSON + history
      +---> OpenAI GPT-4o-mini          --- AI processes and returns updated JSON
      +---> processAIResponse()         --- Parse and validate AI output
      +---> handlePDFGeneration()       --- Trigger PDF service when ready
      +---> saveDataAsync()             --- Non-blocking persistence
      |
      v
  Response (message + optional PDF)
```

## Key Design Patterns

- **Middleware Pipeline**: IP filtering → rate limiting → orchestration → response
- **Functional Decomposition**: Each step of the CV agent is an isolated, testable function
- **State Machine**: Curriculum sections track status (`pending` → `working` → `completed`)
- **Factory Pattern**: `Curriculum.createWithDefaultSections()` for consistent initialization
- **Async Fire-and-Forget**: Database saves are non-blocking to minimize response latency
- **Error Recovery**: Graceful degradation with simplified prompts on failure

## Project Structure

```
src/
├── config/
│   ├── database.js              # MongoDB connection
│   └── openai.js                # OpenAI client setup
├── middleware/
│   ├── ipFilter.js              # IP-based access control
│   ├── rateLimiter.js           # Rate limiting
│   └── orchestrateProcessing.js # Request orchestration
├── models/
│   ├── curriculum.js            # Mongoose schema with sub-schemas and factory method
│   ├── conversation.js          # Conversation history model
│   └── image.js                 # Profile image model
├── routes/
│   └── agent.js                 # Express routes (text + image endpoints)
├── services/
│   ├── cvAgentService.js        # Core AI orchestration logic
│   └── imageService.js          # Image CRUD operations
├── utils/
│   ├── httpUtils.js             # PDF service HTTP client + data formatting
│   ├── tokenUtils.js            # OpenAI token counting wrapper
│   └── fileStorage.js           # Multer file storage configuration
└── app.js                       # Express application entry point
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agent/text` | Send a message to the CV building conversation |
| `POST` | `/api/agent/image` | Upload a profile image for the resume |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Runtime** | Node.js 14+ |
| **Framework** | Express |
| **AI** | OpenAI GPT-4o-mini |
| **Database** | MongoDB (Mongoose ODM) |
| **File Uploads** | Multer |
| **Security** | Helmet, CORS, IP filtering |
| **Process Manager** | PM2 (ecosystem.config.js) |

## Setup

```bash
npm install
cp .env.example .env  # Configure environment variables
npm run dev            # Development mode
npm start              # Production mode
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `SERVICE_URL` | PDF service URL (`http://localhost:8090/api/cv/generate`) |
| `ALLOWED_IPS` | Comma-separated allowed client IPs |