const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { requireAnyRole } = require("../auth");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "data", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED_TYPES.has(file.mimetype));
  },
});

const router = express.Router();

router.post("/", requireAnyRole, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "no valid image file provided" });
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

module.exports = { router, UPLOAD_DIR };
