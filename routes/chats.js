import express from "express";
import { body, validationResult } from "express-validator";
import Chat from "../models/Chat.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const messageValidator = body("messages").isArray().withMessage("Messages must be an array");

router.get("/", requireAuth, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.id }).sort({ updatedAt: -1 }).limit(50);
    return res.json({ chats });
  } catch (err) {
    console.error("Get chats error", err);
    return res.status(500).json({ error: "Unable to load chats" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user.id });
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    return res.json({ chat });
  } catch (err) {
    console.error("Get chat error", err);
    return res.status(500).json({ error: "Unable to load chat" });
  }
});

router.post(
  "/",
  requireAuth,
  [body("title").optional().isString(), messageValidator.optional()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { title = "New Chat", messages = [] } = req.body;
    try {
      const chat = await Chat.create({
        userId: req.user.id,
        title,
        messages,
      });
      return res.status(201).json({ chat });
    } catch (err) {
      console.error("Create chat error", err);
      return res.status(500).json({ error: "Unable to save chat" });
    }
  },
);

router.put(
  "/:id",
  requireAuth,
  [body("title").optional().isString(), messageValidator.optional()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { title, messages } = req.body;
    try {
      const update = {};
      if (title) update.title = title;
      if (Array.isArray(messages)) update.messages = messages;
      update.updatedAt = new Date();
      const chat = await Chat.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.id },
        { $set: update },
        { new: true },
      );
      if (!chat) return res.status(404).json({ error: "Chat not found" });
      return res.json({ chat });
    } catch (err) {
      console.error("Update chat error", err);
      return res.status(500).json({ error: "Unable to update chat" });
    }
  },
);

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await Chat.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Chat not found" });
    return res.json({ message: "Chat deleted" });
  } catch (err) {
    console.error("Delete chat error", err);
    return res.status(500).json({ error: "Unable to delete chat" });
  }
});

export default router;

