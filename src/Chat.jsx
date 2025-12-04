import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "ai/react";
import { Input, Typography, Tooltip, message } from "antd";
import {
  AudioOutlined,
  SendOutlined,
  LoadingOutlined,
  BulbOutlined,
  MoonOutlined,
  SoundOutlined,
  AudioMutedOutlined,
} from "@ant-design/icons";
import wowziriLogo from "./assets/images/logo.png";

const { Text, Title } = Typography;
const { TextArea } = Input;

const TYPE_SCALE = {
  headline: "clamp(28px, 6vw, 42px)",
  subhead: "clamp(16px, 2.5vw, 18px)",
  bubble: 18,
  body: 18,
  small: 13,
};

const conversationWidth = 820;

export default function Chat({ themeMode, onThemeChange }) {
  const {
    messages,
    input,
    setInput,
    append,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useChat({
    api: "/api/chat",
    onError: (err) => {
      setErrorMeta({
        id: Date.now(),
        message:
          err?.message || "Wowziri hit a snag replying. Please try again.",
      });
    },
  });

  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [errorMeta, setErrorMeta] = useState(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const transcriptRef = useRef("");
  const recognitionRef = useRef(null);
  const composerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [messageApi, contextHolder] = message.useMessage();

  const demoPrompts = useMemo(
    () => [
      "Summarize my meeting notes into bullet points.",
      "Give me 3 brand naming options for a coffee shop.",
      "Explain quantum computing like I'm 12.",
    ],
    [],
  );

  const isBrowser = typeof window !== "undefined";
  const SpeechRecognition = useMemo(() => {
    if (!isBrowser) return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, [isBrowser]);
  const supportsSpeech = Boolean(SpeechRecognition);
  const isDark = themeMode === "dark";

  const palette = useMemo(
    () => ({
      text: isDark ? "#f8f9ff" : "#0f172a",
      hint: isDark ? "#8c94b3" : "#6b7280",
      accent: "#10a37f",
      border: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.12)",
      composer: isDark ? "rgba(6,7,15,0.92)" : "#ffffff",
      icon: isDark ? "#9aa3ba" : "#4b5567",
      userBubble: isDark ? "rgba(18, 63, 52, 0.75)" : "#d7f5ea",
      botBubble: isDark ? "rgba(7,8,14,0.75)" : "#f3f4f9",
      userBorder: isDark ? "rgba(16,163,127,0.6)" : "rgba(16,163,127,0.4)",
    }),
    [isDark],
  );

  useEffect(() => {
    if (!isBrowser) return undefined;
    const body = document.body;
    if (isDark) {
      body.classList.remove("light-mode");
    } else {
      body.classList.add("light-mode");
    }
    return () => body.classList.remove("light-mode");
  }, [isDark, isBrowser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPromptIndex((prev) => (prev + 1) % demoPrompts.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [demoPrompts.length]);

  useEffect(() => {
    if (
      !isBrowser ||
      !voiceEnabled ||
      typeof window.speechSynthesis === "undefined" ||
      typeof window.SpeechSynthesisUtterance === "undefined"
    ) {
      return undefined;
    }
    const assistantMessage = [...messages]
      .reverse()
      .find((msg) => msg.role === "assistant");
    if (!assistantMessage) return undefined;
    const utterance = new window.SpeechSynthesisUtterance(
      assistantMessage.content,
    );
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [messages, voiceEnabled, isBrowser]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (
      errorMeta &&
      messages.length > 0 &&
      messages[messages.length - 1].role === "assistant"
    ) {
      setErrorMeta(null);
    }
  }, [messages, errorMeta]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (!supportsSpeech) {
      messageApi.warning("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    transcriptRef.current = "";
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsRecording(true);
    recognition.onerror = (event) => {
      setIsRecording(false);
      messageApi.error(`Voice input error: ${event.error}`);
    };
    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          transcriptRef.current += `${transcript} `;
        } else {
          interimTranscript += transcript;
        }
      }
      const combined = `${transcriptRef.current} ${interimTranscript}`.trim();
      setInput(combined);
    };
    recognition.onend = async () => {
      setIsRecording(false);
      recognitionRef.current = null;
      const finalText = transcriptRef.current.trim();
      if (!finalText) return;
      setInput("");
      await append({
        role: "user",
        content: finalText,
      });
    };

    recognition.start();
  }, [
    SpeechRecognition,
    append,
    isRecording,
    messageApi,
    setInput,
    stopRecording,
    supportsSpeech,
  ]);

  const handleThemeToggle = () => {
    onThemeChange(isDark ? "light" : "dark");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      composerRef.current?.requestSubmit();
    }
  };

  const waitingForAssistant =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "user";

  const renderMessage = (messageItem, index) => {
    const isUser = messageItem.role === "user";
    return (
      <div
        key={`${messageItem.id}_${index}`}
        style={{
          display: "flex",
          justifyContent: isUser ? "flex-end" : "flex-start",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isUser ? "1fr auto" : "auto 1fr",
            gap: 16,
            maxWidth: "90%",
            alignItems: "flex-start",
          }}
        >
          {!isUser && (
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${palette.border}`,
                display: "grid",
                placeItems: "center",
              }}
            >
              <img
                src={wowziriLogo}
                alt="Wowziri avatar"
                style={{ width: 28, height: 28 }}
              />
            </div>
          )}
          <div
            style={{
              background: isUser ? palette.userBubble : palette.botBubble,
              border: `1px solid ${
                isUser ? palette.userBorder : palette.border
              }`,
              borderRadius: 24,
              padding: "18px 24px",
              color: palette.text,
              fontSize: TYPE_SCALE.bubble,
              lineHeight: 1.65,
              minWidth: 200,
              whiteSpace: "pre-wrap",
            }}
          >
            <Text
              strong
              style={{
                fontSize: 15,
                color: palette.accent,
                display: "block",
                marginBottom: 6,
              }}
            >
              {isUser ? "You" : "Wowziri"}
            </Text>
            {messageItem.content}
          </div>
          {isUser && (
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: "rgba(16,163,127,0.14)",
                border: `1px solid ${palette.userBorder}`,
                display: "grid",
                placeItems: "center",
                color: palette.accent,
                fontWeight: 600,
              }}
            >
              Y
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderThinkingBubble = () => (
    <div
      key="wowziri-thinking"
      style={{
        display: "flex",
        justifyContent: "flex-start",
      }}
    >
      <div
        style={{
          background: palette.botBubble,
          border: `1px solid ${palette.border}`,
          borderRadius: 24,
          padding: "18px 24px",
          color: palette.hint,
          fontSize: TYPE_SCALE.body,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <LoadingOutlined spin />
        <span>Thinking...</span>
      </div>
    </div>
  );

  const renderErrorBubble = () => {
    if (!errorMeta) return null;
    return (
      <div
        key={`error-${errorMeta.id}`}
        style={{ display: "flex", justifyContent: "flex-start" }}
      >
        <div
          style={{
            background: "rgba(255, 97, 91, 0.12)",
            border: "1px solid rgba(255, 97, 91, 0.35)",
            borderRadius: 24,
            padding: "18px 24px",
            color: "#ff6f61",
            fontSize: TYPE_SCALE.body,
            maxWidth: "85%",
          }}
        >
          <Text strong style={{ display: "block", marginBottom: 6 }}>
            Wowziri
          </Text>
          {errorMeta.message}
        </div>
      </div>
    );
  };

  const iconButtonBase = {
    width: 48,
    height: 48,
    borderRadius: 16,
    border: `1px solid ${palette.border}`,
    background: isDark ? "rgba(7,8,14,0.75)" : "rgba(255,255,255,0.9)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    color: palette.icon,
    transition: "all 0.2s ease",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px 40px",
        color: palette.text,
      }}
    >
      {contextHolder}
      <div
        style={{
          width: "100%",
          maxWidth: conversationWidth,
          display: "flex",
          flexDirection: "column",
          gap: 28,
          flex: 1,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                border: `1px solid ${palette.border}`,
                background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                display: "grid",
                placeItems: "center",
                boxShadow: isDark
                  ? "0 10px 26px rgba(0,0,0,0.5)"
                  : "0 10px 28px rgba(15,23,42,0.12)",
              }}
            >
              <img
                src={wowziriLogo}
                alt="Wowziri logo"
                style={{ width: 36, height: 36 }}
              />
            </div>
            <div>
              <Title
                level={2}
                style={{
                  margin: 0,
                  fontSize: "clamp(22px, 3.2vw, 32px)",
                  color: palette.text,
                  fontWeight: 600,
                }}
              >
                Wowziri
              </Title>
              <Text style={{ color: palette.hint, fontSize: TYPE_SCALE.subhead }}>
                Voice-first AI conversations, powered by DeepSeek
              </Text>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Tooltip
              title={voiceEnabled ? "Disable voice output" : "Enable voice output"}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={() => setVoiceEnabled((prev) => !prev)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setVoiceEnabled((prev) => !prev);
                }}
                style={{
                  ...iconButtonBase,
                  color: voiceEnabled ? palette.accent : palette.icon,
                  borderColor: voiceEnabled ? palette.accent : palette.border,
                }}
              >
                {voiceEnabled ? <SoundOutlined /> : <AudioMutedOutlined />}
              </span>
            </Tooltip>
            <Tooltip
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={handleThemeToggle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleThemeToggle();
                }}
                style={iconButtonBase}
              >
                {isDark ? <MoonOutlined /> : <BulbOutlined />}
              </span>
            </Tooltip>
          </div>
        </header>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            paddingBottom: 16,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  margin: "auto",
                  textAlign: "center",
                  maxWidth: 560,
                  padding: "60px 24px",
                }}
              >
                <Title
                  level={2}
                  style={{
                    color: palette.text,
                    fontSize: "clamp(26px, 5vw, 40px)",
                    marginBottom: 12,
                  }}
                >
                  Ask anything..
                </Title>
               
                <div
                  style={{
                    marginTop: 28,
                    position: "relative",
                    height: 32,
                    overflow: "hidden",
                  }}
                >
                  {demoPrompts.map((prompt, idx) => (
                    <Text
                      key={prompt}
                      style={{
                        position: idx === promptIndex ? "relative" : "absolute",
                        inset: 0,
                        opacity: promptIndex === idx ? 1 : 0,
                        transform:
                          promptIndex === idx ? "translateY(0)" : "translateY(12px)",
                        transition: "opacity 0.6s ease, transform 0.6s ease",
                        color: "white",
                        fontSize: TYPE_SCALE.subhead,
                      }}
                    >
                      {prompt}
                    </Text>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map(renderMessage)}
                {waitingForAssistant && renderThinkingBubble()}
                {renderErrorBubble()}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            ref={composerRef}
            onSubmit={handleSubmit}
            style={{ marginTop: "auto" }}
          >
            <div
              style={{
                position: "relative",
                background: palette.composer,
                borderRadius: 34,
                border: `1px solid ${palette.border}`,
                padding: "16px 120px 18px 22px",
                backdropFilter: "blur(18px)",
                boxShadow: isDark
                  ? "0 30px 60px rgba(0,0,0,0.45)"
                  : "0 30px 60px rgba(15,23,42,0.12)",
              }}
            >
              <TextArea
                value={input}
                placeholder="Message Wowziri..."
                autoSize={{ minRows: 1, maxRows: 5 }}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                variant="borderless"
                disabled={isLoading}
                style={{
                  background: "transparent",
                  color: palette.text,
                  fontSize: TYPE_SCALE.body,
                  paddingRight: 96,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 24,
                  bottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                <Tooltip
                  title={
                    isRecording ? "Stop recording" : "Voice input (push to talk)"
                  }
                >
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={startRecording}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") startRecording();
                    }}
                    style={{
                      cursor: "pointer",
                      fontSize: 20,
                      color: isRecording ? "#ff6f61" : palette.icon,
                      transition: "color 0.2s ease",
                    }}
                  >
                    <AudioOutlined />
                  </span>
                </Tooltip>
                <Tooltip title="Send message">
                  {isLoading ? (
                    <LoadingOutlined style={{ fontSize: 20, color: palette.icon }} />
                  ) : (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => composerRef.current?.requestSubmit()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          composerRef.current?.requestSubmit();
                        }
                      }}
                      style={{
                        cursor: "pointer",
                        fontSize: 20,
                        color: palette.accent,
                        display: "inline-flex",
                      }}
                    >
                      <SendOutlined />
                    </span>
                  )}
                </Tooltip>
              </div>
            </div>
            <div
              style={{
                marginTop: 12,
                textAlign: "center",
                color: palette.hint,
                fontSize: TYPE_SCALE.small,
              }}
            >
              Wowziri may produce inaccurate information. Verify important facts.
            </div>
            {!supportsSpeech && (
              <Text
                style={{
                  marginTop: 10,
                  display: "block",
                  color: palette.hint,
                }}
              >
                Voice input isn’t supported in this browser. Try Chrome desktop.
              </Text>
            )}
            {isRecording && (
              <Text style={{ marginTop: 10, display: "block", color: "#ff6f61" }}>
                🎤 Listening…
              </Text>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

