# Backend Server

REST API backing the Typewriter and Editor Controller apps. Node.js + Express,
SQLite storage (via `better-sqlite3`).

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set WRITER_PASSWORD, EDITOR_PASSWORD, and a random JWT_SECRET
npm start
```

Runs on `http://localhost:4000` by default (set `PORT` in `.env` to change it).
The SQLite database file and uploaded images are created under `data/` on
first run (gitignored).

`ALLOWED_ORIGINS` in `.env` is a comma-separated list of frontend origins
allowed to call the API with cookies (CORS). Update it to match wherever the
Typewriter and Editor Controller are served from.

## Auth model

Two shared passwords, not individual accounts:

- **Writer**: logs in with `{ role: "writer", username, password }`. The
  `username` is the internal identity used for ownership — it's how the
  Editor Controller knows who to send a post back to, and how a writer's own
  posts get filtered. It's separate from `byline`, the public-facing credited
  author name set per-post in the compose UI (defaults to the username, but
  can be changed, e.g. for a pen name).
- **Editor**: logs in with `{ role: "editor", password }`. No username; editors
  can see and act on everything.

A successful login sets an `httpOnly` session cookie (a signed JWT, valid 7
days). All authenticated requests must be made with `credentials: "include"`
(or equivalent) so the cookie is sent.

## Post lifecycle

```
(writer uploads) → unpublished → (editor publishes) → published
                        ↑              │
                        │      (editor unpublishes)
                        │              ↓
                        │         unpublished
                        │
                (editor returns w/ comment)
                        ↓
                    returned → (writer resubmits) → unpublished
```

- `unpublished`: uploaded, waiting on editor review. Not publicly visible.
- `published`: live. Publicly visible.
- `returned`: sent back to the author with a comment explaining what to fix.
  Not publicly visible. The author can edit it and resubmit, which moves it
  back to `unpublished`.

## API reference

All request/response bodies are JSON unless noted. Authenticated endpoints
require the session cookie from `/api/auth/login`.

### Auth

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/api/auth/login` | — | `{ role, password, username? }` | `username` required when `role: "writer"` |
| POST | `/api/auth/logout` | — | — | Clears the session cookie |
| GET | `/api/auth/me` | any | — | Returns `{ role, username }` for the current session |

### Posts

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/api/posts` | none, or editor | — | Public callers get only `published` posts. Editors get everything; add `?status=unpublished` etc. to filter. |
| GET | `/api/posts/mine` | writer | — | All of the signed-in writer's own posts, any status. |
| GET | `/api/posts/:id` | none, or owner/editor | — | 404s (not 401) if you're not allowed to see it, so existence isn't leaked. |
| POST | `/api/posts` | writer | `{ title, byline?, image?, body }` | Creates a new post with `status: "unpublished"`, authored by the signed-in writer. `byline` defaults to the username if omitted. Slug is derived from the title. |
| PUT | `/api/posts/:id` | editor, or owning writer (if not yet published) | `{ title?, byline?, image?, body? }` | Partial update; only send the fields you're changing. |
| POST | `/api/posts/:id/publish` | editor | — | Sets `status: "published"`. |
| POST | `/api/posts/:id/unpublish` | editor | — | Sets `status: "unpublished"`. |
| POST | `/api/posts/:id/return` | editor | `{ comment }` | Sets `status: "returned"` with the given comment. |
| POST | `/api/posts/:id/resubmit` | owning writer | — | Only valid on a `returned` post; moves it back to `unpublished` and clears the comment. |

### Uploads

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/api/uploads` | writer or editor | multipart form, field name `image` | Accepts JPEG/PNG/WebP/GIF/SVG, 10MB max. Returns `{ url }`, a path under `/uploads/` that's served statically by this same server. |

### Misc

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Returns `{ ok: true }` if the server is up. |

## Notes for the frontends

- The **Typewriter** app is built (see `../Typewriter/`) and uses this API for
  auth, uploading, and syncing returned/published status. Its "multiple
  drafts stored locally" requirement is a frontend-only concern
  (`localStorage`) — this server only knows about posts once they're
  uploaded via `POST /api/posts`.
- The **Editor Controller** app is built (see `../Editor Controller/`) and
  uses the editor-only endpoints (`GET /api/posts?status=...`, `/publish`,
  `/unpublish`, `/return`) to review, edit, and publish everything.
- The public **Reader View** frontend (the existing static site) isn't wired
  up to this server yet — it still reads from its own local `posts/*.json`
  files. Pointing it at `GET /api/posts` instead is a follow-up step.
# Newspaper-Backend
# Newspaper-Backend
# Newspaper-Backend
# Newspaper-Backend
