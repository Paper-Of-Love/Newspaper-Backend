const express = require("express");
const { checkPassword, setSessionCookie, clearSessionCookie } = require("../auth");

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

  setSessionCookie(res, payload);
  res.json({ ok: true, role: payload.role, username: payload.username || null });
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  if (!req.session) return res.status(401).json({ error: "not signed in" });
  res.json({ role: req.session.role, username: req.session.username || null });
});

module.exports = router;
