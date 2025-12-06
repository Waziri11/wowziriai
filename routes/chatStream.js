import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { optionalAuth } from "../middleware/auth.js";

export const chatStreamRouter = express.Router();

chatStreamRouter.post("/", optionalAuth, async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Missing GEMINI_API_KEY environment variable");
    return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable." });
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Request body must include messages array." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const chatHistory = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;
    const chat = model.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessageStream(lastMessage);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of result.stream) {
      const text = chunk.text();
      const data = `0:"${text.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"\n`;
      res.write(data);
    }

    res.end();
  } catch (error) {
    console.error("❌ Wowziri API error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Something went wrong with Wowziri response.",
        details: error.message,
      });
    }
  }
});

