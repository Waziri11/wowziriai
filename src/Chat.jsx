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
  PlusOutlined,
  DeleteOutlined,
  MessageOutlined,
  MenuOutlined,
  CloseOutlined,
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

// Helper function to generate chat title from first message
const generateChatTitle = (firstMessage) => {
  if (!firstMessage) return "New Chat";
  const words = firstMessage.split(" ");
  return words.slice(0, 5).join(" ") + (words.length > 5 ? "..." : "");
};

export default function Chat({ themeMode, onThemeChange }) {
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem("wowziri_chats");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.length > 0 ? parsed : [];
      } catch (e) {
        console.error("Error loading chats:", e);
      }
    }
    // Start with no chats - will be created on first message
    return [];
  });

  const [currentChatId, setCurrentChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detect screen size for responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const currentChat = useMemo(() => 
    chats.find(chat => chat.id === currentChatId) || null,
    [chats, currentChatId]
  );

  // Save chats to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("wowziri_chats", JSON.stringify(chats));
  }, [chats]);

  const {
    messages,
    input,
    setInput,
    setMessages,
    append,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
  } = useChat({
    api: "/api/chat",
    initialMessages: currentChat?.messages || [],
    onFinish: (message) => {
      console.log("✅ Message finished:", message);
      setErrorMeta(null);
    },
    onError: (err) => {
      console.error("❌ Chat error:", err);
      console.error("Error message:", err?.message);
      console.error("Error details:", err);
      
      let userMessage = "Wowziri encountered an issue. Please try again.";
      
      try {
        let errorStr = "";
        
        if (err?.message) {
          try {
            const errorObj = JSON.parse(err.message);
            errorStr = errorObj.details || errorObj.error || err.message;
          } catch {
            errorStr = err.message;
          }
        }
        
        errorStr = String(errorStr || "");
        
        if (errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("Too Many Requests")) {
          userMessage = "We're getting too many requests right now. Please wait a moment and try again.";
        } else if (errorStr.includes("404") || errorStr.includes("Not Found") || errorStr.includes("not found")) {
          userMessage = "The AI model is currently unavailable. Please try again or contact support.";
        } else if (errorStr.includes("500") || errorStr.includes("Internal Server Error")) {
          userMessage = "Something went wrong on our end. Please try again in a moment.";
        } else if (errorStr.includes("network") || errorStr.includes("fetch") || errorStr.includes("Failed to fetch")) {
          userMessage = "Network connection issue. Please check your internet and try again.";
        } else if (errorStr.includes("API key") || errorStr.includes("authentication") || errorStr.includes("GEMINI_API_KEY")) {
          userMessage = "Authentication issue detected. Please contact support.";
        }
      } catch (parseError) {
        console.error("Error parsing error message:", parseError);
        userMessage = "Wowziri encountered an unexpected issue. Please try again.";
      }
      
      setErrorMeta({
        id: Date.now(),
        message: userMessage,
      });
    },
    onResponse: (response) => {
      console.log("✅ Got response from API");
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);
      
      if (response.ok) {
        setErrorMeta(null);
      }
    },
  });

  // Custom submit handler to create chat on first message
  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    
    // If no current chat exists, create one
    if (!currentChatId && input.trim()) {
      const newChat = {
        id: Date.now().toString(),
        title: "New Chat",
        messages: [],
        createdAt: new Date().toISOString(),
      };
      setChats(prev => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
    }
    
    // Call original submit
    originalHandleSubmit(e);
  }, [currentChatId, input, originalHandleSubmit]);

  // Sync messages to current chat
  useEffect(() => {
    if (messages.length > 0) {
      setChats(prevChats => prevChats.map(chat => 
        chat.id === currentChatId 
          ? { 
              ...chat, 
              messages,
              title: chat.messages.length === 0 && messages.length > 0
                ? generateChatTitle(messages[0].content)
                : chat.title
            }
          : chat
      ));
    }
  }, [messages, currentChatId]);

  // Load messages when switching chats
  useEffect(() => {
    const chat = chats.find(c => c.id === currentChatId);
    if (chat) {
      setMessages(chat.messages || []);
    }
  }, [currentChatId, setMessages]);

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
      sidebar: isDark ? "rgba(6,7,15,0.95)" : "#f9fafb",
      sidebarHover: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
      newChatBtn: isDark 
        ? "linear-gradient(135deg, rgba(6, 20, 16, 0.8), rgba(16, 163, 127, 0.15))"
        : "linear-gradient(135deg, rgba(16, 163, 127, 0.1), rgba(6, 20, 16, 0.05))",
      newChatBorder: isDark ? "rgba(16, 163, 127, 0.3)" : "rgba(16, 163, 127, 0.25)",
    }),
    [isDark],
  );

  // Chat management functions
  const createNewChat = useCallback(() => {
    const newChat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setMessages([]);
  }, [setMessages]);

  const deleteChat = useCallback((chatId) => {
    setChats(prev => {
      const filtered = prev.filter(c => c.id !== chatId);
      // If deleting current chat, switch to another or clear
      if (chatId === currentChatId) {
        if (filtered.length > 0) {
          setCurrentChatId(filtered[0].id);
        } else {
          setCurrentChatId(null);
          setMessages([]);
        }
      }
      return filtered;
    });
  }, [currentChatId, setMessages]);

  const switchChat = useCallback((chatId) => {
    setCurrentChatId(chatId);
  }, []);

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
    try {
      if (
        errorMeta &&
        messages.length > 0 &&
        messages[messages.length - 1]?.role === "assistant"
      ) {
        setErrorMeta(null);
      }
    } catch (error) {
      console.error("Error in useEffect:", error);
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
            gap: isMobile ? 10 : 16,
            maxWidth: isMobile ? "95%" : "90%",
            alignItems: "flex-start",
          }}
        >
          {!isUser && (
            <div
              style={{
                width: isMobile ? 32 : 42,
                height: isMobile ? 32 : 42,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${palette.border}`,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <img
                src={wowziriLogo}
                alt="Wowziri avatar"
                style={{ width: isMobile ? 20 : 28, height: isMobile ? 20 : 28 }}
              />
            </div>
          )}
          <div
            style={{
              background: isUser ? palette.userBubble : palette.botBubble,
              border: `1px solid ${
                isUser ? palette.userBorder : palette.border
              }`,
              borderRadius: isMobile ? 18 : 24,
              padding: isMobile ? "14px 18px" : "18px 24px",
              color: palette.text,
              fontSize: isMobile ? 16 : TYPE_SCALE.bubble,
              lineHeight: 1.65,
              minWidth: isMobile ? 100 : 200,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <Text
              strong
              style={{
                fontSize: isMobile ? 13 : 15,
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
                width: isMobile ? 32 : 42,
                height: isMobile ? 32 : 42,
                borderRadius: "50%",
                background: "rgba(16,163,127,0.14)",
                border: `1px solid ${palette.userBorder}`,
                display: "grid",
                placeItems: "center",
                color: palette.accent,
                fontWeight: 600,
                fontSize: isMobile ? 14 : 16,
                flexShrink: 0,
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
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 16,
          maxWidth: "90%",
          alignItems: "flex-start",
        }}
      >
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
            gap: 8,
            minWidth: 80,
          }}
        >
          <style>{`
            @keyframes dotFlashing {
              0%, 80%, 100% {
                opacity: 0.3;
              }
              40% {
                opacity: 1;
              }
            }
            .dot {
              animation: dotFlashing 1.4s infinite;
            }
            .dot:nth-child(2) {
              animation-delay: 0.2s;
            }
            .dot:nth-child(3) {
              animation-delay: 0.4s;
            }
          `}</style>
          <span className="dot" style={{ fontSize: 24, lineHeight: 0.5 }}>•</span>
          <span className="dot" style={{ fontSize: 24, lineHeight: 0.5 }}>•</span>
          <span className="dot" style={{ fontSize: 24, lineHeight: 0.5 }}>•</span>
        </div>
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
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 16,
            maxWidth: "90%",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "rgba(255, 97, 91, 0.12)",
              border: "1px solid rgba(255, 97, 91, 0.35)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <img
              src={wowziriLogo}
              alt="Wowziri avatar"
              style={{ width: 28, height: 28, opacity: 0.7 }}
            />
          </div>
          <div
            style={{
              background: "rgba(255, 97, 91, 0.12)",
              border: "1px solid rgba(255, 97, 91, 0.35)",
              borderRadius: 24,
              padding: "18px 24px",
              color: "#ff6f61",
              fontSize: TYPE_SCALE.body,
              lineHeight: 1.65,
              minWidth: 200,
            }}
          >
            <Text
              strong
              style={{
                fontSize: 15,
                color: "#ff6f61",
                display: "block",
                marginBottom: 6,
              }}
            >
              Wowziri
            </Text>
            {errorMeta.message}
          </div>
        </div>
      </div>
    );
  };

  const iconButtonBase = useMemo(() => ({
    width: isMobile ? 38 : 48,
    height: isMobile ? 38 : 48,
    borderRadius: 16,
    border: `1px solid ${palette.border}`,
    background: isDark ? "rgba(7,8,14,0.75)" : "rgba(255,255,255,0.9)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    color: palette.icon,
    transition: "all 0.2s ease",
    fontSize: isMobile ? 16 : 18,
  }), [isMobile, palette, isDark]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        color: palette.text,
        position: "relative",
      }}
    >
      {contextHolder}
      
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 998,
            backdropFilter: "blur(2px)",
          }}
        />
      )}
      
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? (isMobile ? "85%" : 300) : 0,
          maxWidth: isMobile ? 320 : "none",
          background: palette.sidebar,
          borderRight: `1px solid ${palette.border}`,
          display: "flex",
          flexDirection: "column",
          transition: "width 0.3s ease, transform 0.3s ease",
          overflow: "hidden",
          position: isMobile ? "fixed" : "relative",
          height: isMobile ? "100vh" : "auto",
          zIndex: 999,
          left: 0,
          top: 0,
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Logo and Title in Sidebar */}
        <div style={{ padding: "20px 16px 16px 16px", borderBottom: `1px solid ${palette.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  border: `1px solid ${palette.border}`,
                  background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: isDark
                    ? "0 4px 12px rgba(0,0,0,0.3)"
                    : "0 4px 12px rgba(15,23,42,0.08)",
                }}
              >
                <img
                  src={wowziriLogo}
                  alt="Wowziri logo"
                  style={{ width: 28, height: 28 }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Title
                  level={3}
                  style={{
                    margin: 0,
                    fontSize: 20,
                    color: palette.text,
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  Wowziri
                </Title>
                <Text style={{ color: palette.hint, fontSize: 12, lineHeight: 1.3 }}>
                  AI-powered assistant
                </Text>
              </div>
            </div>
            
            {/* Close button in sidebar */}
            <Tooltip title="Close sidebar">
              <span
                role="button"
                tabIndex={0}
                onClick={() => setSidebarOpen(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setSidebarOpen(false);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  border: `1px solid ${palette.border}`,
                  background: isDark ? "rgba(7,8,14,0.75)" : "rgba(255,255,255,0.9)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  color: palette.icon,
                  transition: "all 0.2s ease",
                  flexShrink: 0,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = palette.sidebarHover;
                  e.currentTarget.style.borderColor = palette.accent;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = isDark ? "rgba(7,8,14,0.75)" : "rgba(255,255,255,0.9)";
                  e.currentTarget.style.borderColor = palette.border;
                }}
              >
                <CloseOutlined style={{ fontSize: 14 }} />
              </span>
            </Tooltip>
          </div>
          
          {/* New Chat Button with Glass Effect */}
          <button
            onClick={createNewChat}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: palette.newChatBtn,
              color: palette.text,
              border: `1px solid ${palette.newChatBorder}`,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 500,
              transition: "all 0.2s ease",
              backdropFilter: "blur(10px)",
              boxShadow: isDark 
                ? "0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                : "0 4px 12px rgba(16,163,127,0.1), inset 0 1px 0 rgba(255,255,255,0.5)",
            }}
            onMouseOver={(e) => {
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow = isDark 
                ? "0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)"
                : "0 6px 16px rgba(16,163,127,0.15), inset 0 1px 0 rgba(255,255,255,0.7)";
            }}
            onMouseOut={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = isDark 
                ? "0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                : "0 4px 12px rgba(16,163,127,0.1), inset 0 1px 0 rgba(255,255,255,0.5)";
            }}
          >
            <PlusOutlined style={{ color: palette.accent }} />
            <span style={{ color: palette.text }}>New Chat</span>
          </button>
        </div>

        {/* Chat List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px",
          }}
        >
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                switchChat(chat.id);
                if (isMobile) setSidebarOpen(false);
              }}
              style={{
                padding: "12px 14px",
                margin: "4px 0",
                borderRadius: 12,
                background: chat.id === currentChatId ? palette.sidebarHover : "transparent",
                border: `1px solid ${chat.id === currentChatId ? palette.border : "transparent"}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                transition: "all 0.2s ease",
              }}
              onMouseOver={(e) => {
                if (chat.id !== currentChatId) {
                  e.currentTarget.style.background = palette.sidebarHover;
                }
              }}
              onMouseOut={(e) => {
                if (chat.id !== currentChatId) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <MessageOutlined style={{ color: palette.icon, fontSize: 16, flexShrink: 0 }} />
                <Text
                  style={{
                    color: palette.text,
                    fontSize: 14,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {chat.title}
                </Text>
              </div>
              <DeleteOutlined
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(chat.id);
                }}
                style={{
                  color: palette.hint,
                  fontSize: 14,
                  padding: 4,
                  transition: "color 0.2s ease",
                  flexShrink: 0,
                }}
                onMouseOver={(e) => e.target.style.color = "#ff6f61"}
                onMouseOut={(e) => e.target.style.color = palette.hint}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: isMobile ? "16px 12px 20px" : "32px 16px 40px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: conversationWidth,
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 16 : 28,
            flex: 1,
            minHeight: 0,
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
              {!sidebarOpen && (
                <Tooltip title="Open sidebar">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setSidebarOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setSidebarOpen(true);
                    }}
                    style={{
                      ...iconButtonBase,
                      width: isMobile ? 38 : 42,
                      height: isMobile ? 38 : 42,
                    }}
                  >
                    <MenuOutlined />
                  </span>
                </Tooltip>
              )}
              
              {/* Show mini logo/title when sidebar is closed */}
              {!sidebarOpen && (
                <>
                  <div
                    style={{
                      width: isMobile ? 36 : 42,
                      height: isMobile ? 36 : 42,
                      borderRadius: "50%",
                      border: `1px solid ${palette.border}`,
                      background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      boxShadow: isDark
                        ? "0 4px 12px rgba(0,0,0,0.3)"
                        : "0 4px 12px rgba(15,23,42,0.08)",
                    }}
                  >
                    <img
                      src={wowziriLogo}
                      alt="Wowziri logo"
                      style={{ width: isMobile ? 24 : 28, height: isMobile ? 24 : 28 }}
                    />
                  </div>
                  {!isMobile && (
                    <div>
                      <Title
                        level={3}
                        style={{
                          margin: 0,
                          fontSize: 18,
                          color: palette.text,
                          fontWeight: 600,
                          lineHeight: 1.2,
                        }}
                      >
                        Wowziri
                      </Title>
                      <Text style={{ color: palette.hint, fontSize: 11 }}>
                        AI Assistant
                      </Text>
                    </div>
                  )}
                </>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 6 : 10,
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
                gap: isMobile ? 12 : 18,
                overflowY: "auto",
                paddingRight: isMobile ? 0 : 4,
                minHeight: 0,
              }}
            >
              {messages.length === 0 ? (
                <div
                  style={{
                    margin: "auto",
                    textAlign: "center",
                    maxWidth: 560,
                    padding: isMobile ? "40px 16px" : "60px 24px",
                  }}
                >
                  <Title
                    level={2}
                    style={{
                      color: palette.text,
                      fontSize: isMobile ? "clamp(22px, 6vw, 28px)" : "clamp(26px, 5vw, 40px)",
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
                  borderRadius: isMobile ? 24 : 34,
                  border: `1px solid ${palette.border}`,
                  padding: isMobile ? "12px 90px 14px 16px" : "16px 120px 18px 22px",
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
                    fontSize: isMobile ? 16 : TYPE_SCALE.body,
                    paddingRight: isMobile ? 70 : 96,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    right: isMobile ? 16 : 24,
                    bottom: isMobile ? 14 : 16,
                    display: "flex",
                    alignItems: "center",
                    gap: isMobile ? 12 : 18,
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
               Matumizi ya AI kupita kiasi ni hatari kwa afya yako
              </div>
              <div
                style={{
                  marginTop: 16,
                  textAlign: "center",
                  color: palette.hint,
                  fontSize: TYPE_SCALE.small,
                }}
              >
                Made in Tanzania &copy; 2025
              </div>
              {!supportsSpeech && (
                <Text
                  style={{
                    marginTop: 10,
                    display: "block",
                    color: palette.hint,
                  }}
                >
                  Voice input isn't supported in this browser. Try Chrome desktop.
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
    </div>
  );
}
