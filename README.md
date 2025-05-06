*(this code contains 2 different implementation 1 that plugins([script.ts](backend/script.ts)) to whatsapp and the other that consumes a websocket server([index.ts](backend/index.ts)))
# AI Chatbot with WhatsApp & WebSocket Integration

A versatile chatbot application built with Next.js that integrates with WhatsApp and offers real-time chat via WebSocket. The bot leverages Google's Gemini AI to provide intelligent responses, text summarization, and translation functionality.

## Features

- **WhatsApp Integration**: Connect with users directly through WhatsApp
- **WebSocket Server**: Real-time chat capabilities for web applications
- **AI-Powered Responses**: Utilizes Google's Gemini AI for intelligent conversations
- **Command System**: Built-in commands for specific functionalities:
  - `/summarise`: Condenses long text into concise summaries
  - `/translate-to-{language}`: Translates text to specified languages
  - `/help`: Displays available commands (WhatsApp only)

## Tech Stack

- **Frontend**: Next.js
- **Backend**: Node.js with TypeScript
- **AI Integration**: Google Gemini 2.0 Flash API
- **Communication**: 
  - WhatsApp Web.js for WhatsApp connectivity
  - WebSocket for real-time web chat

## Setup Instructions

### Prerequisites
- Node.js and npm installed
- Google Gemini API key
- WhatsApp account (for WhatsApp integration)

### Environment Variables
Create a `.env` file with:
```
GEMINI_API_KEY=your_gemini_api_key_here
PORT=8080 # Optional, defaults to 8080 for WebSocket server
```

### Installation
1. Clone the repository
2. Install dependencies:
   ```
   cd backend
   npm install
   ```
3. Start the WhatsApp bot:
   ```
   npm run waclient
   ```
4. Start the WebSocket server:
   ```
   npm run webhook
   ```
5. Start the Next.js frontend:
   ```
   cd frontend
   npm run dev
   ```

## WhatsApp Setup
On first run, scan the displayed QR code with your WhatsApp to enable the connection.

## WebSocket API

### Client Connection
Connect to the WebSocket server at `ws://localhost:8080`

### Message Format
Send messages as JSON:
```json
{
  "content": "Your message or command here"
}
```

### Response Format
Responses are returned as JSON:
```json
{
  "type": "bot",
  "content": "Response content here"
}
```