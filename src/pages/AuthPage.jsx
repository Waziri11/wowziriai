import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Form,
  Input,
  Select,
  Typography,
  message,
  Space,
} from "antd";
import wowziriLogo from "../assets/images/logo.png";

const { Title, Text } = Typography;

const passwordRegex = /^(?=.*\d)(?=.*[!@#$%^&*()_+\-[\]{};':"\\|,.<>/?]).{8,}$/;

export default function AuthPage({ mode = "login", themeMode, onThemeChange }) {
  const [form] = Form.useForm();
  const [authMode, setAuthMode] = useState(mode);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [verificationLink, setVerificationLink] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const isDark = themeMode === "dark";
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setAuthMode(mode);
    setVerificationEmailSent(false);
    setVerificationLink("");
    setError(null);
  }, [mode]);

  const palette = useMemo(
    () => ({
      text: isDark ? "#f8f9ff" : "#0f172a",
      hint: isDark ? "#8c94b3" : "#6b7280",
      accent: "#10a37f",
      border: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.12)",
      card: isDark ? "rgba(9,11,18,0.9)" : "rgba(255,255,255,0.9)",
      cardBorder: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
      shadow: isDark
        ? "0 30px 80px rgba(0,0,0,0.45)"
        : "0 30px 80px rgba(15,23,42,0.12)",
    }),
    [isDark],
  );

  const apiRequest = useCallback(async (path, { method = "POST", body } = {}) => {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || "Request failed");
      error.details = data;
      throw error;
    }
    return data;
  }, []);

  const goHome = useCallback(() => navigate("/", { replace: true }), [navigate]);

  const storeAccess = useCallback((token) => {
    if (!token) return;
    localStorage.setItem("wowziri_access", token);
  }, []);

  const handleAuthSubmit = useCallback(async () => {
    try {
      setError(null);
      const values = await form.validateFields();
      setLoading(true);
      if (authMode === "signup") {
        const data = await apiRequest("/api/auth/signup", { body: values });
        setPendingEmail(values.email);
        setVerificationEmailSent(true);
        setVerificationLink(data?.devLink || "");
        messageApi.success("Check your email for the verification link.");
      } else {
        const data = await apiRequest("/api/auth/login", { body: values });
        if (data.requiresVerification) {
          setPendingEmail(values.email);
          setVerificationEmailSent(true);
          setVerificationLink(data.devLink || "");
          messageApi.info("Please verify your email to finish logging in.");
        } else {
          storeAccess(data.accessToken);
          messageApi.success("Logged in");
          goHome();
        }
      }
    } catch (err) {
      console.error("Auth error", err);
      const apiMessage =
        err?.details?.errors?.[0]?.msg || err?.details?.error || err?.message || "Something went wrong";
      setError(apiMessage);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, authMode, form, goHome, messageApi, storeAccess]);

  const handleResend = useCallback(async () => {
    if (!pendingEmail) return;
    try {
      setError(null);
      const data = await apiRequest("/api/auth/request-email-verify", { body: { email: pendingEmail } });
      setVerificationEmailSent(true);
      if (data.devLink) setVerificationLink(data.devLink);
      messageApi.success("Verification email re-sent");
    } catch (err) {
      const apiMessage =
        err?.details?.errors?.[0]?.msg || err?.message || "Unable to resend code";
      setError(apiMessage);
    }
  }, [apiRequest, messageApi, pendingEmail]);

  const toggleMode = useCallback(() => {
    setAuthMode((prev) => (prev === "login" ? "signup" : "login"));
    setPendingEmail("");
    setVerificationEmailSent(false);
    setVerificationLink("");
    setError(null);
    form.resetFields();
    navigate(prev => `?`, { replace: true });
  }, [form, navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        position: "relative",
        color: palette.text,
      }}
    >
      {contextHolder}
      <div
        className="orb-surface"
        aria-hidden="true"
        style={{ zIndex: 0, filter: "saturate(125%)" }}
      >
        <div className="orb" />
        <div className="orb orb--b" />
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 520,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                border: `1px solid ${palette.border}`,
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.9)",
                display: "grid",
                placeItems: "center",
                boxShadow: isDark
                  ? "0 6px 18px rgba(0,0,0,0.35)"
                  : "0 6px 18px rgba(15,23,42,0.12)",
              }}
            >
              <img src={wowziriLogo} alt="Wowziri logo" style={{ width: 24, height: 24 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, color: palette.text }}>
                {authMode === "signup" ? "Create your account" : "Welcome back"}
              </Title>
              <Text style={{ color: palette.hint }}>
                {authMode === "signup"
                  ? "Join Wowziri and sync your chats."
                  : "Log in to continue your chats."}
              </Text>
            </div>
          </div>
          <Button size="small" onClick={() => onThemeChange(isDark ? "light" : "dark")}>
            {isDark ? "Light" : "Dark"}
          </Button>
        </div>

        <div
          style={{
            background: palette.card,
            border: `1px solid ${palette.cardBorder}`,
            borderRadius: 18,
            padding: 24,
            boxShadow: palette.shadow,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          {error && (
            <Alert
              type="error"
              message={error}
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}

          {!verificationEmailSent ? (
            <Form layout="vertical" form={form} onFinish={handleAuthSubmit}>
              {authMode === "signup" && (
                <>
                  <Form.Item
                    name="fullName"
                    label="Full name"
                    rules={[{ required: true, message: "Full name is required" }]}
                  >
                    <Input placeholder="Jane Doe" />
                  </Form.Item>
                  <Form.Item
                    name="gender"
                    label="Gender"
                    rules={[{ required: true, message: "Select gender" }]}
                  >
                    <Select
                      options={[
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
                      ]}
                      placeholder="Choose"
                    />
                  </Form.Item>
                  <Form.Item
                    name="phone"
                    label="Phone number"
                    rules={[{ required: true, message: "Phone is required" }]}
                  >
                    <Input placeholder="+255..." />
                  </Form.Item>
                </>
              )}

              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, type: "email", message: "Enter a valid email" }]}
              >
                <Input placeholder="you@example.com" />
              </Form.Item>

              <Form.Item
                name="password"
                label="Password"
                rules={[
                  { required: true, message: "Password is required" },
                  {
                    pattern: passwordRegex,
                    message: "Min 8 chars, include a number and a symbol",
                  },
                ]}
              >
                <Input.Password placeholder="Min 8 chars, include number & symbol" />
              </Form.Item>

              <div style={{ color: palette.hint, fontSize: 12, marginBottom: 8 }}>
                Password must include at least one number and one special symbol.
              </div>

              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{ background: palette.accent, borderColor: palette.accent }}
              >
                {authMode === "signup" ? "Create account" : "Log in"}
              </Button>

              <Space
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  color: palette.hint,
                }}
              >
                <span>
                  {authMode === "signup"
                    ? "Already have an account?"
                    : "Don't have an account?"}
                </span>
                <Button type="link" onClick={toggleMode}>
                  {authMode === "signup" ? "Log in" : "Sign up"}
                </Button>
              </Space>
            </Form>
          ) : (
            <div style={{ textAlign: "center" }}>
              <Alert
                type="info"
                message="Check your email to verify your account"
                description={
                  <div style={{ color: palette.hint }}>
                    We sent a secure link to <strong>{pendingEmail || "your email"}</strong>. Click it to verify and continue.
                    {verificationLink && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ marginBottom: 6 }}>Dev link (local only):</div>
                        <a href={verificationLink} style={{ wordBreak: "break-all" }}>
                          {verificationLink}
                        </a>
                      </div>
                    )}
                  </div>
                }
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  block
                  onClick={handleResend}
                  disabled={!pendingEmail}
                  style={{ background: palette.accent, borderColor: palette.accent }}
                >
                  Resend verification email
                </Button>
                <Button type="link" block onClick={toggleMode}>
                  {authMode === "signup" ? "Use another email" : "Back to login"}
                </Button>
              </Space>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: palette.hint,
            fontSize: 12,
          }}
        >
          <span>Made in Tanzania © 2025</span>
          <Space>
            <Link to="/">Back to chat</Link>
          </Space>
        </div>
      </div>
    </div>
  );
}
