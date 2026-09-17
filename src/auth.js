const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const COOKIE_NAME = "session";
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

function setSessionCookie(res, payload) {
  const token = issueToken(payload);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function attachSession(req, res, next) {
  req.session = readSession(req);
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || req.session.role !== role) {
      return res.status(401).json({ error: `${role} authentication required` });
    }
    next();
  };
}

function requireAnyRole(req, res, next) {
  if (!req.session) {
    return res.status(401).json({ error: "authentication required" });
  }
  next();
}

module.exports = {
  checkPassword,
  setSessionCookie,
  clearSessionCookie,
  attachSession,
  requireRole,
  requireAnyRole,
};
