import { useMemo, useState } from "react";
import { Layout, ConfigProvider, theme as antdTheme } from "antd";
import { Routes, Route, Navigate } from "react-router-dom";
import Chat from "./Chat.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";
import InterestsPage from "./pages/InterestsPage.jsx";

const { Content } = Layout;

export default function App() {
  const [themeMode, setThemeMode] = useState("dark");
  const isDark = themeMode === "dark";

  const themeConfig = useMemo(
    () => ({
      algorithm: isDark
        ? antdTheme.darkAlgorithm
        : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: "#10a37f",
        borderRadiusLG: 18,
        fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      },
    }),
    [isDark],
  );

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout
        style={{
          minHeight: "100vh",
          background: isDark ? "#05060a" : "#f3f4f8",
        }}
      >
        <Content style={{ padding: 0 }}>
          <Routes>
            <Route path="/" element={<Chat themeMode={themeMode} onThemeChange={setThemeMode} />} />
            <Route
              path="/auth/login"
              element={<AuthPage mode="login" themeMode={themeMode} onThemeChange={setThemeMode} />}
            />
            <Route
              path="/auth/signup"
              element={<AuthPage mode="signup" themeMode={themeMode} onThemeChange={setThemeMode} />}
            />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/interests" element={<InterestsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

