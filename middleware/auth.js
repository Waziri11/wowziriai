import jwt from "jsonwebtoken";

const isProd = process.env.NODE_ENV === "production";
const accessSecret = process.env.JWT_ACCESS_SECRET || (!isProd ? "dev_access_secret" : undefined);
if (!isProd && !process.env.JWT_ACCESS_SECRET) {
  console.warn("[auth] Using dev access secret because JWT_ACCESS_SECRET is missing.");
}

function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return null;
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    if (!isProd) {
      console.warn("[auth] Missing Authorization header");
    }
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (!accessSecret) throw new Error("Missing JWT_ACCESS_SECRET");
    const decoded = jwt.verify(token, accessSecret);
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch (err) {
    if (!isProd) {
      console.warn("[auth] Token verification failed:", err.message || err);
    }
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  if (!accessSecret) return next();
  try {
    const decoded = jwt.verify(token, accessSecret);
    req.user = { id: decoded.sub, email: decoded.email };
  } catch (err) {
    // ignore invalid token for optional auth
  }
  next();
}
