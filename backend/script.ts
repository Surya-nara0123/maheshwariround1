import WAWebJS, { Client, Message, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import * as dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables
dotenv.config();

// Initialize Gemini API settings
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY not found in environment variables");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const summarizeParagraphFunctionDeclaration = {
  name: "summarize_paragraph",
  description: "Summarizes the given paragraph of text.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      paragraph: {
        type: Type.STRING,
        description: "The paragraph of text to summarize.",
      },
    },
    required: ["paragraph"],
  },
};

const translateSentenceFunctionDeclaration = {
  name: "translate_sentence",
  description: "Translates a sentence from one language to another.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      sentence: {
        type: Type.STRING,
        description: "The sentence to translate.",
      },
      target_language: {
        type: Type.STRING,
        description:
          'The language to translate the sentence into (e.g., "Spanish", "fr", "de").',
      },
    },
    required: ["sentence", "target_language"],
  },
};

async function summarizeParagraph(paragraph: string): Promise<string> {
  try {
    console.log("Summarizing paragraph")
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Please provide a concise summary of the following paragraph: "${paragraph}"`,
      config: {
        candidateCount: 2,
      },
    });
    return response.text!;
  } catch (error) {
    console.error("Error summarizing paragraph:", error);
    return "Sorry, I couldn't summarize that paragraph due to an error.";
  }
}

// Function to translate a sentence
async function translateSentence(
  sentence: string,
  targetLanguage: string
): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Translate, blindly with any assumption you need and only one sentence and one answer, the following sentence to ${targetLanguage}: "${sentence}"`,
      config: {
        candidateCount: 2,
      },
    });
    return response.text!;
  } catch (error) {
    console.error("Error translating sentence:", error);
    return `Sorry, I couldn't translate that sentence to ${targetLanguage} due to an error.`;
  }
}

// Get the Chromium executable path from environment variable or use default based on platform
const getChromiumPath = () => {
  // If explicitly set in env vars, use that
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  // Docker environment usually has Chromium at /usr/bin/chromium
  if (process.env.DOCKER_CONTAINER === 'true') {
    return '/usr/bin/chromium';
  }
  
  // Common paths by platform
  switch (process.platform) {
    case 'linux':
      return '/usr/bin/chromium-browser';
    case 'darwin': // macOS
      return '/Applications/Chromium.app/Contents/MacOS/Chromium';
    default:
      return undefined; // Let Puppeteer use its default
  }
};

// Initialize WhatsApp client with session data if available
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "authSession" }),
  puppeteer: {
    executablePath: getChromiumPath(),
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
    headless: true,
  },
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
  //handle messages only from me
  if (msg.fromMe && !msg.from.includes("g.us") && !(msg.body == "Hello")) {
    // for simplicity and to avoid unnesseary calls to the server...
    if (msg.body.includes("@ai")) {
      // msg.reply("Hello Bitch");
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: msg.body.replace("@ai", ""),
        config: {
          tools: [
            {
              functionDeclarations: [
                summarizeParagraphFunctionDeclaration,
                translateSentenceFunctionDeclaration,
              ],
            },
          ],
        },
      });

      console.log("Gemini response:", response.functionCalls);

      if (!response.functionCalls) {
        await msg.reply("Sorry That is not a recognised command");
      } else {
        const functionCall = response.functionCalls[0];
        const functionName = functionCall.name;

        // Handle each function type
        switch (functionName) {
          case "summarize_paragraph": {
            const args =
              typeof functionCall.args === "string"
                ? JSON.parse(functionCall.args)
                : functionCall.args || {};
            const paragraph = args.paragraph;
            const summary = await summarizeParagraph(paragraph);
            await msg.reply(`📝 Summary: ${summary}`);
            break;
          }
          case "translate_sentence": {
            const args =
              typeof functionCall.args === "string"
                ? JSON.parse(functionCall.args)
                : functionCall.args || {};
            const sentence = args.sentence;
            const targetLanguage = args.target_language;
            const translation = await translateSentence(
              sentence,
              targetLanguage
            );
            await msg.reply(
              `🌐 Translation (${targetLanguage}): ${translation}`
            );
            break;
          }
          default:
            await msg.reply("Sorry, I don't know how to handle that request.");
            break;
        }
      }
      console.log(response.candidates!);
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