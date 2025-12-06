import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { sendOtpEmail } from "../utils/email.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;
const isProd = process.env.NODE_ENV === "production";

function issueTokens(user) {
  if (!accessSecret || !refreshSecret) {
    throw new Error("JWT secrets are missing");
  }

  const payload = { sub: user.id, email: user.email };
  const accessToken = jwt.sign(payload, accessSecret, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ ...payload, type: "refresh" }, refreshSecret, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
  });
}

function buildUserResponse(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    gender: user.gender,
    email: user.email,
    phone: user.phone,
    interests: user.interests,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function setOtp(user) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(code, 10);
  const now = Date.now();
  user.otp = {
    codeHash,
    expiresAt: new Date(now + 5 * 60 * 1000),
    resendAvailableAt: new Date(now + 45 * 1000),
  };
  await user.save();
  // Do not block signup if email transport is missing in dev; log fallback is inside sendOtpEmail.
  await sendOtpEmail({ to: user.email, code });
}

const passwordPolicyMessage = "Password must be at least 8 characters, include a number and a special symbol.";
// Dash must be escaped/placed safely to avoid range errors
const passwordRegex = /^(?=.*\d)(?=.*[!@#$%^&*()_+\-[\]{};':"\\|,.<>/?]).{8,}$/;

const signupValidators = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("gender").isIn(["male", "female"]).withMessage("Gender must be male or female"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("phone").trim().notEmpty().withMessage("Phone is required"),
  body("password").matches(passwordRegex).withMessage(passwordPolicyMessage),
];

router.post("/signup", signupValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { fullName, gender, email, phone, password, interests = [] } = req.body;

  try {
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(409).json({ error: "Email or phone already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      fullName,
      gender,
      email,
      phone,
      passwordHash,
      interests,
      emailVerified: false,
    });

    await setOtp(user);

    return res.status(201).json({
      message: "Signup successful, verification code sent to email.",
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    console.error("Signup error", err);
    const message = isProd ? "Unable to sign up right now" : err?.message || "Unable to sign up right now";
    return res.status(500).json({ error: message });
  }
});

router.post(
  "/login",
  [body("email").isEmail(), body("password").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      if (!user.emailVerified) {
        await setOtp(user);
        return res.status(403).json({ error: "Email not verified", requiresVerification: true });
      }

      const { accessToken, refreshToken } = issueTokens(user);
      setRefreshCookie(res, refreshToken);
      return res.json({ accessToken, user: buildUserResponse(user) });
    } catch (err) {
      console.error("Login error", err);
      const message = isProd ? "Unable to login right now" : err?.message || "Unable to login right now";
      return res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/verify-otp",
  [body("email").isEmail(), body("code").isLength({ min: 6, max: 6 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, code } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: "User not found" });

      const { otp } = user;
      if (!otp?.codeHash || !otp.expiresAt) {
        return res.status(400).json({ error: "No active verification code" });
      }
      if (new Date(otp.expiresAt).getTime() < Date.now()) {
        return res.status(400).json({ error: "Verification code expired" });
      }

      const matches = await bcrypt.compare(code, otp.codeHash);
      if (!matches) {
        return res.status(400).json({ error: "Invalid verification code" });
      }

      user.emailVerified = true;
      user.otp = {};
      await user.save();

      const { accessToken, refreshToken } = issueTokens(user);
      setRefreshCookie(res, refreshToken);
      return res.json({ accessToken, user: buildUserResponse(user) });
    } catch (err) {
      console.error("Verify OTP error", err);
      const message = isProd ? "Unable to verify code right now" : err?.message || "Unable to verify code right now";
      return res.status(500).json({ error: message });
    }
  },
);

router.post(
  "/request-otp",
  [body("email").isEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: "User not found" });
      const resendAt = user.otp?.resendAvailableAt ? new Date(user.otp.resendAvailableAt).getTime() : 0;
      if (resendAt && resendAt > Date.now()) {
        const waitMs = resendAt - Date.now();
        return res.status(429).json({ error: `Please wait ${Math.ceil(waitMs / 1000)} seconds before resending` });
      }
      await setOtp(user);
      return res.json({ message: "Verification code sent" });
    } catch (err) {
      console.error("Request OTP error", err);
      return res.status(500).json({ error: "Unable to send code right now" });
    }
  },
);

router.post("/refresh", async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ error: "No refresh token" });
  try {
    if (!refreshSecret || !accessSecret) throw new Error("Missing JWT secrets");
    const decoded = jwt.verify(token, refreshSecret);
    if (decoded.type !== "refresh") throw new Error("Invalid token type");

    const user = await User.findById(decoded.sub);
    if (!user) return res.status(401).json({ error: "Invalid refresh token" });

    const { accessToken, refreshToken } = issueTokens(user);
    setRefreshCookie(res, refreshToken);
    return res.json({ accessToken, user: buildUserResponse(user) });
  } catch (err) {
    console.error("Refresh error", err.message);
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.post("/logout", (_req, res) => {
  clearRefreshCookie(res);
  return res.json({ message: "Logged out" });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user: buildUserResponse(user) });
  } catch (err) {
    console.error("Me error", err);
    return res.status(500).json({ error: "Unable to fetch user" });
  }
});

export default router;

