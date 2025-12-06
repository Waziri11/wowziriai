import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { sendVerificationEmail } from "../utils/email.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const isProd = process.env.NODE_ENV === "production";
const appUrl = (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");

const accessSecret = process.env.JWT_ACCESS_SECRET || (!isProd ? "dev_access_secret" : undefined);
const refreshSecret = process.env.JWT_REFRESH_SECRET || (!isProd ? "dev_refresh_secret" : undefined);
const emailVerifySecret = process.env.JWT_EMAIL_VERIFY_SECRET || (!isProd ? "dev_email_verify_secret" : undefined);

if (!isProd && (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET)) {
  console.warn("[auth] Using dev JWT access/refresh secrets because env vars are missing. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET for consistency.");
}
if (!isProd && !process.env.JWT_EMAIL_VERIFY_SECRET) {
  console.warn("[auth] Using dev email verification secret because JWT_EMAIL_VERIFY_SECRET is missing.");
}

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

function issueEmailVerifyToken(user) {
  if (!emailVerifySecret) {
    throw new Error("Email verification secret is missing");
  }
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: "email-verify",
    },
    emailVerifySecret,
    { expiresIn: "1h" },
  );
}

async function sendVerificationLink(user) {
  const token = issueEmailVerifyToken(user);
  const issuedAt = new Date();
  user.emailVerifyIssuedAt = issuedAt;
  await user.save();

  const link = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  await sendVerificationEmail({
    to: user.email,
    fullName: user.fullName,
    link,
    expiresMinutes: 60,
    appName: "Wowziri",
  });

  return { token, link, issuedAt };
}

const passwordPolicyMessage = "Password must be at least 8 characters, include a number and a special symbol.";
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

    const { link, token } = await sendVerificationLink(user);

    const responseBody = {
      message: "Signup successful. Check your email for a verification link.",
      user: { id: user.id, email: user.email },
    };
    if (!isProd) responseBody.devLink = link || token;

    return res.status(201).json(responseBody);
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
        const { link, token } = await sendVerificationLink(user);
        const resp = { error: "Email not verified", requiresVerification: true };
        if (!isProd) resp.devLink = link || token;
        return res.status(403).json(resp);
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
  "/verify-email",
  [body("token").notEmpty().withMessage("Verification token is required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { token } = req.body;
    try {
      if (!emailVerifySecret) throw new Error("Email verification secret missing");
      const decoded = jwt.verify(token, emailVerifySecret);
      if (decoded.type !== "email-verify") {
        return res.status(400).json({ error: "Invalid verification token" });
      }

      const user = await User.findById(decoded.sub);
      if (!user || user.email !== decoded.email) {
        return res.status(400).json({ error: "Invalid verification token" });
      }

      if (user.emailVerifyIssuedAt) {
        const issuedAtMs = new Date(user.emailVerifyIssuedAt).getTime();
        const tokenIat = decoded.iat ? decoded.iat * 1000 : 0;
        if (tokenIat < issuedAtMs - 1000) {
          return res.status(400).json({ error: "Verification link has been superseded. Please use the latest email." });
        }
      }

      user.emailVerified = true;
      user.emailVerifyIssuedAt = null;
      user.otp = {};
      await user.save();

      const { accessToken, refreshToken } = issueTokens(user);
      setRefreshCookie(res, refreshToken);
      const payload = { accessToken, user: buildUserResponse(user) };
      if (!isProd) payload.devAccessToken = accessToken;
      return res.json(payload);
    } catch (err) {
      console.error("Verify email error", err);
      const message = isProd ? "Unable to verify email right now" : err?.message || "Unable to verify email right now";
      return res.status(400).json({ error: message });
    }
  },
);

router.post(
  "/request-email-verify",
  [body("email").isEmail().withMessage("Valid email is required").normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.emailVerified) return res.json({ message: "Email already verified" });
      const { link, token } = await sendVerificationLink(user);
      const resp = { message: "Verification link sent" };
      if (!isProd) resp.devLink = link || token;
      return res.json(resp);
    } catch (err) {
      console.error("Request verify link error", err);
      return res.status(500).json({ error: "Unable to send verification link right now" });
    }
  },
);

// Legacy route kept for backward compatibility; now sends verification link.
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
      if (user.emailVerified) return res.json({ message: "Email already verified" });
      const { link, token } = await sendVerificationLink(user);
      const resp = { message: "Verification link sent" };
      if (!isProd) resp.devLink = link || token;
      return res.json(resp);
    } catch (err) {
      console.error("Request OTP (link) error", err);
      return res.status(500).json({ error: "Unable to send verification link right now" });
    }
  },
);

router.post(
  "/interests",
  [requireAuth, body("interests").isArray().withMessage("Interests must be an array of strings")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const interests = (req.body.interests || []).map((i) => String(i || "").trim()).filter(Boolean);
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      user.interests = interests;
      await user.save();
      return res.json({ user: buildUserResponse(user) });
    } catch (err) {
      console.error("Interests error", err);
      return res.status(500).json({ error: "Unable to save interests right now" });
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

