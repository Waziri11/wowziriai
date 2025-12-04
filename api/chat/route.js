const HF_MODEL_ID = "deepseek-ai/DeepSeek-V3.2-Exp";
const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";
const encoder = new TextEncoder();

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  const hfToken = process.env.VITE_HF_TOKEN;

  if (!hfToken) {
    return new Response(
      JSON.stringify({
        error: "Missing VITE_HF_TOKEN environment variable.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let messages;
  try {
    ({ messages } = await req.json());
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "Request body must include a messages array." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const payload = {
    model: HF_MODEL_ID,
    messages,
    max_tokens: 800,
    temperature: 0.7,
    top_p: 0.9,
    stream: true,
  };

  try {
    const hfResponse = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });

    if (!hfResponse.ok) {
      const errorBody = await hfResponse.text();
      console.error(
        "[HF] API error:",
        hfResponse.status,
        hfResponse.statusText,
        errorBody,
      );
      return new Response(
        JSON.stringify({
          error:
            "DeepSeek is unavailable right now. Please try again in a moment.",
          details: errorBody,
        }),
        { status: hfResponse.status, headers: { "Content-Type": "application/json" } },
      );
    }

    const contentType = hfResponse.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream") && hfResponse.body) {
      const transformed = transformHFStream(hfResponse.body);
      return new Response(transformed, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    const data = await hfResponse.json();
    const text = extractText(data);
    const stream = streamTextAsSSE(text);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[HF] Proxy error:", error);
    return new Response(
      JSON.stringify({
        error: "Wowziri could not reach DeepSeek right now.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

function extractText(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (payload.choices && payload.choices.length > 0) {
    const choice = payload.choices[0];
    if (choice.message?.content) return choice.message.content;
    if (choice.delta?.content) return choice.delta.content;
  }
  if (payload.generated_text) return payload.generated_text;
  if (payload.output) return payload.output;
  return JSON.stringify(payload);
}

function transformHFStream(webStream) {
  const reader = webStream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let closed = false;

  const emitEvent = (raw, controller) => {
    if (!raw) return false;
    const normalized = raw
      .split("\n")
      .map((line) => line.replace(/^data:\s?/, ""))
      .join("")
      .trim();
    if (!normalized) return false;
    if (normalized === "[DONE]") {
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
      return true;
    }
    try {
      const parsed = JSON.parse(normalized);
      const content =
        parsed.choices?.[0]?.delta?.content ??
        parsed.choices?.[0]?.message?.content ??
        parsed.generated_text ??
        parsed.output ??
        "";
      if (content) {
        const payload = JSON.stringify({
          choices: [{ delta: { content } }],
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }
    } catch (err) {
      console.error("[HF] Failed to parse SSE chunk", err, normalized);
    }
    return false;
  };

  const drainBuffer = (controller, flush = false) => {
    while (!closed) {
      const idx = buffer.indexOf("\n\n");
      if (idx === -1) {
        if (flush && buffer.trim()) {
          closed = emitEvent(buffer.trim(), controller);
          buffer = "";
        }
        break;
      }
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      closed = emitEvent(rawEvent, controller);
      if (closed) break;
    }
  };

  return new ReadableStream({
    async pull(controller) {
      if (closed) {
        controller.close();
        return;
      }
      const { value, done } = await reader.read();
      if (done) {
        drainBuffer(controller, true);
        if (!closed) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          closed = true;
        }
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      drainBuffer(controller, false);
    },
    cancel() {
      reader.cancel();
      closed = true;
    },
  });
}

function streamTextAsSSE(text = "") {
  const safeText = text || "";
  const chunkSize = 80;
  return new ReadableStream({
    start(controller) {
      let index = 0;
      let closed = false;
      let timeoutId = null;
      const pushChunk = () => {
        if (index >= safeText.length) {
          if (!closed) {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            closed = true;
          }
          return;
        }
        const chunk = safeText.slice(index, index + chunkSize);
        index += chunk.length;
        const payload = JSON.stringify({
          choices: [{ delta: { content: chunk } }],
        });
        if (!closed) {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          timeoutId = setTimeout(() => {
            timeoutId = null;
            pushChunk();
          }, 0);
        }
      };
      pushChunk();
    },
    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      closed = true;
    },
  });
}
