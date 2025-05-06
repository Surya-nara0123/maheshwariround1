import WAWebJS, { Client, Message, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import * as dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";

// Load environment variables
dotenv.config();

// Initialize Gemini API settings
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY not found in environment variables");
}

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Function to call Gemini API
async function callGeminiAPI(prompt: string): Promise<string> {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API Error:", errorData);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    // Extract text from the response
    if (
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0].text
    ) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Unexpected API response structure");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
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
    console.error("Error in summarization:", error);
    return "Sorry, I encountered an error while trying to summarize your text.";
  }
}

// Function to handle text translation
async function translateText(
  text: string,
  targetLanguage: string
): Promise<string> {
  try {
    const prompt = `Translate the following text to ${targetLanguage}:
    
    ${text}
    Don't add any other text. Just the translated text if possible else sorry couldn't translate
    `;

    return await callGeminiAPI(prompt);
  } catch (error) {
    console.error("Error in translation:", error);
    return `Sorry, I encountered an error while trying to translate to ${targetLanguage}.`;
  }
}

// Command handling
async function processMessage(message: string): Promise<string> {
  // Check for commands
  if (message.startsWith("/summarise")) {
    const textToSummarize = message.replace("/summarise", "").trim();
    if (!textToSummarize) {
      return "Please provide text to summarize after the /summarise command.";
    }
    return await summarizeText(textToSummarize);
  }

  if (message.startsWith("/translate-to-")) {
    const match = message.match(/^\/translate-to-([a-zA-Z]+)\s+(.+)$/);
    if (!match) {
      return "Please use the format: /translate-to-{language} {text to translate}";
    }
    const targetLanguage = match[1];
    const textToTranslate = match[2];
    return await translateText(textToTranslate, targetLanguage);
  }

  if (message.startsWith("/help")) {
    return "Available commands:\n- /summarise {text}: Summarize the provided text\n- /translate-to-{language} {text}: Translate text to the specified language\n- /help: Show this help message";
  }

  // Regular conversation
  return "I don't recognize that command. Type /help to see available commands.";
}

const SESSION_FILE_PATH = "./whatsapp-session.json";

// Load session from file if it exists
const loadSession = () => {
  if (fs.existsSync(SESSION_FILE_PATH)) {
    console.log("Loading session from file...");
    const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, "utf8"));
    return sessionData;
  }
  return null;
};

// Try to load existing session
const sessionData = loadSession();

// Initialize WhatsApp client with session data if available
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "authSession",
  }),
});

client.on("qr", (qr) => {
  // Generate and scan this code with your phone
  console.log("QR RECEIVED - scan with your phone:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp client is ready!");
});

client.on("message_create", async (msg: Message) => {
  // Ignore messages from groups or from yourself
  if (msg.to.includes("9940537699")) { // change number to you
    const res = await msg.getMentions();
    console.log(res)
  } else {
    try {
      console.log(`Received message from ${msg.from}: ${msg.body}`);

      // Don't respond to empty messages
      if (!msg.body.trim()) return;

      // Process the message
      const response = await processMessage(msg.body);

      // Reply to the message
      await msg.reply(response);
      console.log(
        `Sent response: ${response.substring(0, 50)}${
          response.length > 50 ? "..." : ""
        }`
      );
    } catch (error) {
      console.error("Error processing WhatsApp message:", error);
      await msg.reply(
        "Sorry, I encountered an error while processing your message."
      );
    }
  }
});

// Handle disconnects and other errors
client.on("disconnected", (reason) => {
  console.log("Client was disconnected:", reason);
  // You might want to attempt reconnection here
});

// Initialize the client
client.initialize();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await client.destroy();
  process.exit(0);
});
