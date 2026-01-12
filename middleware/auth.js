import jwt from "jsonwebtoken";

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
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) throw new Error("Missing JWT_ACCESS_SECRET");
    const decoded = jwt.verify(token, accessSecret);
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessSecret) return next();
  try {
    const decoded = jwt.verify(token, accessSecret);
    req.user = { id: decoded.sub, email: decoded.email };
  } catch (err) {
    // ignore invalid token for optional auth
  }
  next();
}
