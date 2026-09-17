require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const { attachSession } = require("./src/auth");
const authRoutes = require("./src/routes/auth");
const postRoutes = require("./src/routes/posts");
const { router: uploadRoutes, UPLOAD_DIR } = require("./src/routes/uploads");
const backupRoutes = require("./src/routes/backup");

for (const key of ["WRITER_PASSWORD", "EDITOR_PASSWORD", "JWT_SECRET", "BACKUP_TOKEN"]) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    console.error("Copy .env.example to .env and fill in real values.");
    process.exit(1);
  }
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(attachSession);

app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/admin/backup", backupRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});
