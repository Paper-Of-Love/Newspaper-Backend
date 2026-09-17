const express = require("express");
const { db, uniqueSlug } = require("../db");
const { requireRole } = require("../auth");

const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

function serializePost(post) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    author: post.author,
    byline: post.byline,
    image: post.image,
    body: post.body,
    status: post.status,
    comment: post.comment,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    publishedAt: post.published_at,
  };
}

function getPostOr404(req, res) {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) {
    res.status(404).json({ error: "post not found" });
    return null;
  }
  return post;
}

function canView(post, req) {
  if (post.status === "published") return true;
  if (req.editorSession) return true;
  if (req.writerSession && req.writerSession.username === post.author) return true;
  return false;
}

// GET /api/posts — public list (published only), or full list for an editor.
router.get("/", (req, res) => {
  if (req.editorSession) {
    const { status } = req.query;
    const rows = status
      ? db.prepare("SELECT * FROM posts WHERE status = ? ORDER BY updated_at DESC").all(status)
      : db.prepare("SELECT * FROM posts ORDER BY updated_at DESC").all();
    return res.json(rows.map(serializePost));
  }
  const rows = db
    .prepare("SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC")
    .all();
  res.json(rows.map(serializePost));
});

// GET /api/posts/mine — writer's own posts, any status.
router.get("/mine", requireRole("writer"), (req, res) => {
  const rows = db
    .prepare("SELECT * FROM posts WHERE author = ? ORDER BY updated_at DESC")
    .all(req.session.username);
  res.json(rows.map(serializePost));
});

// GET /api/posts/:id
router.get("/:id", (req, res) => {
  const post = getPostOr404(req, res);
  if (!post) return;
  if (!canView(post, req)) {
    return res.status(404).json({ error: "post not found" });
  }
  res.json(serializePost(post));
});

// POST /api/posts — writer uploads a new draft as unpublished.
router.post("/", requireRole("writer"), (req, res) => {
  const { title, byline, image, body } = req.body || {};
  if (!title || !title.trim() || !body || !body.trim()) {
    return res.status(400).json({ error: "title and body are required" });
  }
  const slug = uniqueSlug(title);
  const timestamp = nowIso();
  const result = db
    .prepare(
      `INSERT INTO posts (slug, title, author, byline, image, body, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'unpublished', ?, ?)`
    )
    .run(
      slug,
      title.trim(),
      req.session.username,
      byline || req.session.username,
      image || null,
      body,
      timestamp,
      timestamp
    );
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(serializePost(post));
});

// PUT /api/posts/:id — edit content. Editors can edit anything; writers only
// their own posts that aren't published yet.
router.put("/:id", (req, res) => {
  const post = getPostOr404(req, res);
  if (!post) return;

  const isEditor = !!req.editorSession;
  const isOwnerBeforePublish =
    req.writerSession &&
    req.writerSession.username === post.author &&
    post.status !== "published";

  if (!isEditor && !isOwnerBeforePublish) {
    return res.status(401).json({ error: "not authorized to edit this post" });
  }

  const { title, byline, image, body } = req.body || {};
  const nextTitle = title !== undefined ? title : post.title;
  const nextByline = byline !== undefined ? byline : post.byline;
  const nextImage = image !== undefined ? image : post.image;
  const nextBody = body !== undefined ? body : post.body;

  db.prepare(
    "UPDATE posts SET title = ?, byline = ?, image = ?, body = ?, updated_at = ? WHERE id = ?"
  ).run(nextTitle, nextByline, nextImage, nextBody, nowIso(), post.id);

  const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(post.id);
  res.json(serializePost(updated));
});

// POST /api/posts/:id/publish — editor only.
router.post("/:id/publish", requireRole("editor"), (req, res) => {
  const post = getPostOr404(req, res);
  if (!post) return;
  const timestamp = nowIso();
  db.prepare(
    "UPDATE posts SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?"
  ).run(timestamp, timestamp, post.id);
  const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(post.id);
  res.json(serializePost(updated));
});

// POST /api/posts/:id/unpublish — editor only.
router.post("/:id/unpublish", requireRole("editor"), (req, res) => {
  const post = getPostOr404(req, res);
  if (!post) return;
  db.prepare("UPDATE posts SET status = 'unpublished', updated_at = ? WHERE id = ?").run(
    nowIso(),
    post.id
  );
  const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(post.id);
  res.json(serializePost(updated));
});

// POST /api/posts/:id/return — editor sends a post back to its author with a comment.
router.post("/:id/return", requireRole("editor"), (req, res) => {
  const post = getPostOr404(req, res);
  if (!post) return;
  const { comment } = req.body || {};
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: "comment is required" });
  }
  db.prepare(
    "UPDATE posts SET status = 'returned', comment = ?, updated_at = ? WHERE id = ?"
  ).run(comment.trim(), nowIso(), post.id);
  const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(post.id);
  res.json(serializePost(updated));
});

// POST /api/posts/:id/resubmit — writer resubmits a returned post for review.
router.post("/:id/resubmit", requireRole("writer"), (req, res) => {
  const post = getPostOr404(req, res);
  if (!post) return;
  if (post.author !== req.session.username) {
    return res.status(401).json({ error: "not authorized to resubmit this post" });
  }
  if (post.status !== "returned") {
    return res.status(400).json({ error: "only returned posts can be resubmitted" });
  }
  db.prepare(
    "UPDATE posts SET status = 'unpublished', comment = NULL, updated_at = ? WHERE id = ?"
  ).run(nowIso(), post.id);
  const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(post.id);
  res.json(serializePost(updated));
});

module.exports = router;
