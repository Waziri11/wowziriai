import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (!process.env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing GEMINI_API_KEY environment variable." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Request body must include messages array." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert OpenAI message format to Gemini format
    const chatHistory = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;

    const chat = model.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessageStream(lastMessage);

    // Create a readable stream compatible with Vercel AI SDK
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            // Format as Server-Sent Events compatible with AI SDK
            const data = `0:"${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`;
            controller.enqueue(encoder.encode(data));
          }
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Wowziri API error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong with Wowziri response." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

