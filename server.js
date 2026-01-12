import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chats.js";
import { chatStreamRouter } from "./routes/chatStream.js";

dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env if present

const app = express();
const PORT = process.env.PORT || 3001;

const clientOrigin = process.env.APP_URL || "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

connectDB().catch((err) => {
  console.error("Failed to connect to MongoDB", err);
  process.exit(1);
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/chat", chatStreamRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});

