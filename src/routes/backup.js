const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const express = require("express");

const { db } = require("../db");
const { UPLOAD_DIR } = require("./uploads");

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireBackupToken(req, res, next) {
  const token = req.get("x-backup-token");
  if (!process.env.BACKUP_TOKEN || typeof token !== "string" || !timingSafeEqual(token, process.env.BACKUP_TOKEN)) {
    return res.status(401).json({ error: "invalid backup token" });
  }
  next();
}

const router = express.Router();

router.get("/", requireBackupToken, async (req, res) => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "backup-"));
  const dbSnapshotPath = path.join(workDir, "posts.db");
  const archivePath = path.join(workDir, "backup.tar.gz");

  try {
    await db.backup(dbSnapshotPath);

    const tarArgs = ["czf", archivePath, "-C", workDir, "posts.db"];
    if (fs.existsSync(UPLOAD_DIR) && fs.readdirSync(UPLOAD_DIR).length > 0) {
      tarArgs.push("-C", path.dirname(UPLOAD_DIR), path.basename(UPLOAD_DIR));
    }
    execFileSync("tar", tarArgs);

    res.set("Content-Type", "application/gzip");
    res.set("Content-Disposition", `attachment; filename="backup.tar.gz"`);
    fs.createReadStream(archivePath).pipe(res).on("close", () => {
      fs.rmSync(workDir, { recursive: true, force: true });
    });
  } catch (e) {
    fs.rmSync(workDir, { recursive: true, force: true });
    console.error(e);
    res.status(500).json({ error: "backup failed" });
  }
});

module.exports = router;
