import OpenAI from "openai";

export const config = {
  runtime: "edge",
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing OPENAI_API_KEY environment variable." }),
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      stream: true,
    });

    return new Response(response.toReadableStream(), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
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

