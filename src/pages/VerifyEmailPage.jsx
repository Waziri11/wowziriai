import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Space, Spin, Typography } from "antd";

const { Title, Paragraph, Text } = Typography;

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("pending"); // pending | success | error
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const navigate = useNavigate();

  const token = useMemo(() => searchParams.get("token"), [searchParams]);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus("error");
        setError("Missing verification token.");
        return;
      }
      try {
        setStatus("pending");
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.accessToken) {
          throw new Error(data.error || "Unable to verify email");
        }
        localStorage.setItem("wowziri_access", data.accessToken);
        setStatus("success");
        setInfo("Email verified! Redirecting to interests...");
        setTimeout(() => navigate("/interests", { replace: true }), 1200);
      } catch (err) {
        setStatus("error");
        setError(err.message || "Unable to verify email");
      }
    };
    verify();
  }, [navigate, token]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#0b1220",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          padding: 28,
          color: "#f8f9ff",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <Title level={3} style={{ color: "#f8f9ff", marginBottom: 12 }}>
          Verify your email
        </Title>
        <Paragraph style={{ color: "#cbd5e1", marginBottom: 20 }}>
          We’re confirming your address. This helps keep your account secure.
        </Paragraph>

        {status === "pending" && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Spin />
            <Text style={{ color: "#cbd5e1" }}>Verifying...</Text>
          </Space>
        )}

        {status === "success" && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Alert message={info || "Email verified"} type="success" showIcon />
            <Button onClick={() => navigate("/interests", { replace: true })} type="primary" block>
              Continue to interests
            </Button>
            <Button onClick={() => navigate("/", { replace: true })} block>
              Skip interests
            </Button>
          </Space>
        )}

        {status === "error" && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Alert message={error || "Unable to verify"} type="error" showIcon />
            <Button type="primary" onClick={() => navigate("/auth/login")} block>
              Back to login
            </Button>
          </Space>
        )}
      </div>
    </div>
  );
}
