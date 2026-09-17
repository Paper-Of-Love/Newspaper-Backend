const express = require("express");
const { checkPassword, issueToken } = require("../auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const { role, password, username } = req.body || {};

  if (role !== "writer" && role !== "editor") {
    return res.status(400).json({ error: "role must be 'writer' or 'editor'" });
  }
  if (role === "writer" && (!username || !username.trim())) {
    return res.status(400).json({ error: "username is required for writers" });
  }
  if (!checkPassword(role, password)) {
    return res.status(401).json({ error: "incorrect password" });
  }

  const payload = { role };
  if (role === "writer") payload.username = username.trim();

  const token = issueToken(payload);
  res.json({ ok: true, token, role: payload.role, username: payload.username || null });
});

router.post("/logout", (req, res) => {
  // Stateless JWTs aren't server-invalidated; the client just discards its
  // stored token. Kept as a route for symmetry / future blacklisting.
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const { role } = req.query;
  const session =
    role === "writer" ? req.writerSession : role === "editor" ? req.editorSession : req.writerSession || req.editorSession;
  if (!session) return res.status(401).json({ error: "not signed in" });
  res.json({ role: session.role, username: session.username || null });
});

module.exports = router;
