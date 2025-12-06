import rateLimit from "express-rate-limit";

export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = "Too many requests" } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message,
  });
}
