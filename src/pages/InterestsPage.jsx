import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Typography, Space, message } from "antd";
import { useEffect } from "react";

const { Title, Paragraph } = Typography;

const PRESET_INTERESTS = [
  "AI & Machine Learning",
  "Productivity",
  "Design & UX",
  "Marketing",
  "Data & Analytics",
  "Engineering",
  "Startups",
  "Education",
  "Health & Wellness",
  "Finance & Investing",
  "Writing",
  "Research",
];

export default function InterestsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const tok = localStorage.getItem("wowziri_access") || "";
    if (!tok) {
      setError("Session expired. Please log in again.");
      const t = setTimeout(() => navigate("/auth/login", { replace: true }), 400);
      return () => clearTimeout(t);
    }
  }, [navigate]);

  const palette = useMemo(
    () => ({
      text: "#f8f9ff",
      hint: "#8c94b3",
      accent: "#10a37f",
      card: "#0b1220",
      border: "rgba(255,255,255,0.08)",
    }),
    [],
  );

  const toggleInterest = useCallback((value) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    try {
      setError("");
      if (selected.length === 0) {
        setError("Pick at least one interest.");
        return;
      }
      setLoading(true);
      const submitOnce = async (retrying = false) => {
        const token = localStorage.getItem("wowziri_access") || "";
        if (!token) {
          setError("Session expired. Please log in again.");
          setTimeout(() => navigate("/auth/login", { replace: true }), 600);
          return;
        }
        const res = await fetch("/api/auth/interests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({ interests: selected }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && !retrying) {
          // Try to refresh once
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
          });
          const refreshData = await refreshRes.json().catch(() => ({}));
          if (refreshRes.ok && refreshData.accessToken) {
            localStorage.setItem("wowziri_access", refreshData.accessToken);
            return submitOnce(true);
          }
        }
        if (!res.ok) {
          const msg = data?.error || `Request failed (${res.status})`;
          throw new Error(msg);
        }
        message.success("Interests saved");
        navigate("/", { replace: true });
      };
      await submitOnce(false);
    } catch (err) {
      if (/unauthorized/i.test(err.message) || err?.message === "Unauthorized") {
        setError("Session expired. Please log in again.");
        setTimeout(() => navigate("/auth/login", { replace: true }), 800);
      } else {
        setError(err.message || "Unable to save interests");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, selected]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#05060a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: palette.card,
          border: `1px solid ${palette.border}`,
          borderRadius: 18,
          padding: 28,
          color: palette.text,
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <Title level={3} style={{ color: palette.text, marginBottom: 8 }}>
          Tell us your interests
        </Title>
        <Paragraph style={{ color: palette.hint }}>
          This helps tailor your Wowziri experience.
        </Paragraph>

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
          {PRESET_INTERESTS.map((item) => {
            const active = selected.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleInterest(item)}
                style={{
                  borderRadius: 12,
                  padding: "12px 14px",
                  textAlign: "left",
                  border: active ? "1px solid #10a37f" : `1px solid ${palette.border}`,
                  background: active ? "rgba(16,163,127,0.12)" : palette.card,
                  color: palette.text,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: active ? "0 8px 24px rgba(16,163,127,0.18)" : "none",
                }}
              >
                {item}
              </button>
            );
          })}
        </div>

        <Space direction="vertical" style={{ width: "100%", marginTop: 20 }}>
          <Button
            type="primary"
            block
            size="large"
            loading={loading}
            onClick={handleSubmit}
            style={{ background: palette.accent, borderColor: palette.accent }}
          >
            Save and continue
          </Button>
          <Button block onClick={() => navigate("/", { replace: true })}>
            Skip for now
          </Button>
        </Space>
      </div>
    </div>
  );
}
