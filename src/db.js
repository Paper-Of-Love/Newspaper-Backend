const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "posts.db");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    byline TEXT,
    image TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpublished'
      CHECK (status IN ('unpublished', 'published', 'returned')),
    comment TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT
  )
`);

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueSlug(title) {
  const base = slugify(title) || "post";
  let candidate = base;
  let n = 2;
  const exists = db.prepare("SELECT 1 FROM posts WHERE slug = ?");
  while (exists.get(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

module.exports = { db, uniqueSlug, slugify };
