import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "ai/react";
import { Input, Typography, message, Tooltip, Tag } from "antd";
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

const { Title, Text } = Typography;
const { TextArea } = Input;
const TYPE_SCALE = {
  headline: "clamp(34px, 5.4vw, 52px)",
  subhead: "clamp(16px, 2vw, 20px)",
  bubble: 18,
  body: 18,
  small: 14,
};

export default function Chat({ themeMode, onThemeChange }) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    append,
  } = useChat({
    api: "/api/chat",
  });

  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const messagesEndRef = useRef(null);
  const composerRef = useRef(null);
  const [messageApi, contextHolder] = message.useMessage();

  const isBrowser = typeof window !== "undefined";
  const SpeechRecognition = useMemo(() => {
    if (!isBrowser) return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, [isBrowser]);
  const supportsSpeech = Boolean(SpeechRecognition);
  const isDark = themeMode === "dark";

  const palette = useMemo(
    () => ({
      border: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.12)",
      userBubble: isDark ? "rgba(32,87,69,0.35)" : "#daf5ec",
      botBubble: isDark ? "rgba(18,19,28,0.85)" : "#f4f5fb",
      text: isDark ? "#f8f9ff" : "#0f172a",
      icon: isDark ? "#9aa3ba" : "#4b5567",
      accent: "#10a37f",
      composer: isDark ? "rgba(5,6,12,0.92)" : "#ffffff",
      hint: isDark ? "#7c849c" : "#6b7280",
    }),
    [isDark],
  );

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (!supportsSpeech) {
      messageApi.warning(
        "Speech recognition is not supported in this browser yet.",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    transcriptRef.current = "";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
    };

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
      if (finalText.length > 0) {
        setInput("");
        await append({
          role: "user",
          content: finalText,
        });
      }
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

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      composerRef.current?.requestSubmit();
    }
  };

  const handleThemeToggle = () => {
    onThemeChange(isDark ? "light" : "dark");
  };

  const renderMessage = (messageItem, index) => {
    const isUser = messageItem.role === "user";
    return (
      <div
        key={`${messageItem.id}-${index}`}
        style={{
          padding: "24px 32px",
          borderRadius: 22,
          background: isUser ? palette.userBubble : palette.botBubble,
          border: `1px solid ${palette.border}`,
          color: palette.text,
        }}
      >
        <Text strong style={{ color: palette.accent, fontSize: 16 }}>
          {isUser ? "You" : "Wowziri"}
        </Text>
        <div
          style={{
            marginTop: 10,
            whiteSpace: "pre-wrap",
            fontSize: TYPE_SCALE.bubble,
            lineHeight: 1.65,
          }}
        >
          {messageItem.content}
        </div>
      </div>
    );
  };

  const iconButtonBase = {
    width: 52,
    height: 52,
    borderRadius: 18,
    border: `1px solid ${palette.border}`,
    background: isDark ? "rgba(10,11,20,0.7)" : "rgba(255,255,255,0.9)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    color: palette.icon,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "48px clamp(20px, 5vw, 96px)",
        display: "flex",
        flexDirection: "column",
        gap: 32,
        color: palette.text,
      }}
    >
      {contextHolder}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 78,
              height: 78,
              borderRadius: "50%",
              border: `1px solid ${palette.border}`,
              background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
              display: "grid",
              placeItems: "center",
              boxShadow: isDark
                ? "0 12px 40px rgba(0,0,0,0.6)"
                : "0 12px 40px rgba(15,23,42,0.12)",
            }}
          >
            <img
              src={wowziriLogo}
              alt="Wowziri logo"
              style={{ width: 54, height: 54 }}
            />
          </div>
          <div>
            <Title
              level={2}
              style={{
                margin: 0,
                color: palette.text,
                fontWeight: 600,
                fontSize: TYPE_SCALE.headline,
              }}
            >
              Wowziri
            </Title>
            <Text style={{ color: palette.hint, fontSize: TYPE_SCALE.subhead }}>
              Conversational AI with realtime voice controls
            </Text>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
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
                borderColor: voiceEnabled ? palette.accent : palette.border,
                color: voiceEnabled ? palette.accent : palette.icon,
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
          borderTop: `1px solid ${palette.border}`,
          paddingTop: 24,
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            paddingBottom: 24,
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                margin: "auto",
                textAlign: "center",
                maxWidth: 480,
              }}
            >
              <Tag
                color="green"
                style={{ marginBottom: 16, padding: "6px 16px", fontSize: 16 }}
              >
                Wowziri is listening
              </Tag>
              <Title
                level={2}
                style={{
                  color: palette.text,
                  marginBottom: 12,
                  fontSize: "clamp(24px, 4vw, 34px)",
                }}
              >
                Ask anything. Use your voice or keyboard.
              </Title>
              <Text style={{ color: palette.hint, fontSize: TYPE_SCALE.subhead }}>
                Start with prompts like “Summarize my notes” or “Plan a creative
                weekend”.
              </Text>
            </div>
          ) : (
            messages.map(renderMessage)
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
              borderRadius: 32,
              border: `1px solid ${palette.border}`,
              padding: "16px 72px 16px 24px",
              backdropFilter: "blur(18px)",
            }}
          >
            <TextArea
              value={input}
              placeholder="Message Wowziri..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              bordered={false}
              disabled={isLoading}
              style={{
                background: "transparent",
                color: palette.text,
                fontSize: TYPE_SCALE.body,
                paddingRight: 80,
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 24,
                bottom: 14,
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
                  <LoadingOutlined style={{ fontSize: 18, color: palette.icon }} />
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
                      transition: "transform 0.2s ease",
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
              marginTop: 10,
              textAlign: "center",
              color: palette.hint,
              fontSize: TYPE_SCALE.small,
            }}
          >
            Wowziri may generate inaccurate information. Check critical facts.
          </div>
          {!supportsSpeech && (
            <Text style={{ marginTop: 12, display: "block", color: palette.hint }}>
              Voice input isn’t supported in this browser. Try Chrome desktop.
            </Text>
          )}
          {isRecording && (
            <Text style={{ marginTop: 12, display: "block", color: "#ff6f61" }}>
              🎤 Listening…
            </Text>
          )}
        </form>
      </div>
    </div>
  );
}

