// chatbot-websocket.ts
import * as http from 'http';
import * as WebSocket from 'ws';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

// Initialize Gemini API settings
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY not found in environment variables');
}

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Create HTTP server
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Command handling
async function processMessage(message: string): Promise<string> {
  // Check for commands
  if (message.startsWith('/summarise')) {
    const textToSummarize = message.replace('/summarise', '').trim();
    if (!textToSummarize) {
      return "Please provide text to summarize after the /summarise command.";
    }
    return await summarizeText(textToSummarize);
  } 
  
  if (message.startsWith('/translate-to-')) {
    const match = message.match(/^\/translate-to-([a-zA-Z]+)\s+(.+)$/);
    if (!match) {
      return "Please use the format: /translate-to-{language} {text to translate}";
    }
    const targetLanguage = match[1];
    const textToTranslate = match[2];
    return await translateText(textToTranslate, targetLanguage);
  }
  
  if (message.startsWith('/')) {
    return "I don't recognize that command. Available commands are /summarise and /translate-to-{language}.";
  }
  
  // Regular conversation
  return await getGeminiResponse(message);
}

// Function to call Gemini API
async function callGeminiAPI(prompt: string): Promise<string> {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract text from the response
    if (data && 
        data.candidates && 
        data.candidates[0] && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts[0].text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Unexpected API response structure');
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

// Function to handle text summarization
async function summarizeText(text: string): Promise<string> {
  try {
    const prompt = `Please summarize the following text concisely:
    
    ${text}`;
    
    return await callGeminiAPI(prompt);
  } catch (error) {
    console.error('Error in summarization:', error);
    return "Sorry, I encountered an error while trying to summarize your text.";
  }
}

// Function to handle text translation
async function translateText(text: string, targetLanguage: string): Promise<string> {
  try {
    const prompt = `Translate the following text to ${targetLanguage}:
    
    ${text}`;
    
    return await callGeminiAPI(prompt);
  } catch (error) {
    console.error('Error in translation:', error);
    return `Sorry, I encountered an error while trying to translate to ${targetLanguage}.`;
  }
}

// Function to get regular response from Gemini
async function getGeminiResponse(message: string): Promise<string> {
  try {
    return await callGeminiAPI(message);
  } catch (error) {
    console.error('Error getting response from Gemini:', error);
    return "Sorry, I encountered an error while processing your message.";
  }
}

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    content: 'Welcome to the chatbot! You can use /summarise to summarize text or /translate-to-{language} to translate text.'
  }));

  // Message handling
  ws.on('message', async (data: WebSocket.Data) => {
    try {
      const messageData = JSON.parse(data.toString());
      const userMessage = messageData.content;
      
      console.log('Received message:', userMessage);
      
      // Process the message
      const response = await processMessage(userMessage);
      
      // Send response back to client
      ws.send(JSON.stringify({
        type: 'bot',
        content: response
      }));
      
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        content: 'An error occurred while processing your message.'
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});