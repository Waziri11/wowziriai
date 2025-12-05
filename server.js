import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  console.log("🚀 API Handler called!");
  console.log("📍 Request URL:", req.url);
  console.log("🔧 Request method:", req.method);
  console.log("🌍 Environment check - Has GEMINI_API_KEY:", !!process.env.GEMINI_API_KEY);
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Missing GEMINI_API_KEY environment variable");
    return res.status(500).json({ 
      error: "Missing GEMINI_API_KEY environment variable." 
    });
  }

  try {
    console.log("📦 Parsing request body...");
    const { messages } = req.body;
    console.log("✅ Messages received:", messages?.length, "messages");

    if (!messages || !Array.isArray(messages)) {
      console.error("❌ Invalid messages format");
      return res.status(400).json({ 
        error: "Request body must include messages array." 
      });
    }

    console.log("🤖 Initializing Gemini AI...");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    console.log("✅ Gemini model initialized (gemini-2.5-flash)");

    // Convert OpenAI message format to Gemini format
    console.log("🔄 Converting message format...");
    const chatHistory = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;
    console.log("💬 Last message:", lastMessage.substring(0, 50) + "...");

    console.log("🚀 Starting chat with history length:", chatHistory.length);
    const chat = model.startChat({
      history: chatHistory,
    });

    console.log("📡 Sending message stream...");
    const result = await chat.sendMessageStream(lastMessage);
    console.log("✅ Stream started successfully");

    // Set streaming headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let chunkCount = 0;
    console.log("🌊 Starting to stream chunks...");
    
    for await (const chunk of result.stream) {
      const text = chunk.text();
      chunkCount++;
      console.log(`📨 Chunk ${chunkCount}:`, text.substring(0, 30) + "...");
      
      // Format as Server-Sent Events compatible with AI SDK
      const data = `0:"${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`;
      res.write(data);
    }
    
    console.log("✅ Stream completed! Total chunks:", chunkCount);
    res.end();
    
  } catch (error) {
    console.error("❌ Wowziri API error:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: "Something went wrong with Wowziri response.", 
        details: error.message 
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}/api/chat`);
});

