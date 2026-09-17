const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const TOKEN_TTL = "7d";

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkPassword(role, password) {
  const expected =
    role === "writer" ? process.env.WRITER_PASSWORD : process.env.EDITOR_PASSWORD;
  if (!expected || typeof password !== "string") return false;
  return timingSafeEqual(password, expected);
}

function issueToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Sessions travel as a bearer token in the Authorization header, stored
// client-side in localStorage, rather than a cookie. Cookies set by a
// cross-origin API (frontend on GitHub Pages, backend on Fly.io) are
// "third-party" from the browser's point of view, and Safari/Brave on iOS
// block or expire those regardless of SameSite/Secure flags — a bearer
// token sidesteps that entirely.
function attachSession(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;

  req.writerSession = payload && payload.role === "writer" ? payload : null;
  req.editorSession = payload && payload.role === "editor" ? payload : null;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    const session = role === "writer" ? req.writerSession : req.editorSession;
    if (!session) {
      return res.status(401).json({ error: `${role} authentication required` });
    }
    req.session = session;
    next();
  };
}

function requireAnyRole(req, res, next) {
  const session = req.writerSession || req.editorSession;
  if (!session) {
    return res.status(401).json({ error: "authentication required" });
  }
  req.session = session;
  next();
}

module.exports = {
  checkPassword,
  issueToken,
  attachSession,
  requireRole,
  requireAnyRole,
};
