-- Migration 0001: user accounts, sessions, saved weeks, feedback, audit log, rate limits
-- Apply locally:     npx wrangler d1 migrations apply timewise --local
-- Apply to the live database ONLY after approval:
--                    npx wrangler d1 migrations apply timewise --remote
-- The existing early-access tables (signups, events) are only created if missing; existing data is untouched.

-- Existing early-access tables, normally created on first use by worker.js.
-- IF NOT EXISTS makes this a no-op on the live database, where they already exist;
-- it just ensures a fresh local/test database has them too. Same definitions as worker.js.
CREATE TABLE IF NOT EXISTS signups (
  visitor_id TEXT PRIMARY KEY,
  email TEXT,
  planning TEXT,
  struggle TEXT,
  weekly TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS events (
  visitor_id TEXT NOT NULL,
  event TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visitor_id, event)
);

-- One row per person who has signed in with Google.
-- `role` can only be changed by the site owner running SQL by hand (see ACCOUNTS_SETUP.md);
-- no code path in worker.js / server/accounts.js ever writes it.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,                       -- random UUID, never shown in URLs users can edit
  google_sub    TEXT NOT NULL UNIQUE,                   -- Google's stable account ID
  email         TEXT NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'user'   CHECK (role IN ('user', 'admin')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

-- Sign-in sessions. `id` is the SHA-256 hash of the random token in the visitor's
-- HttpOnly cookie, so a leaked database can't be used to sign in as anyone.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,                         -- unix seconds
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- A user's week on try.html: events, applied replans, and Plan vs. Reality check-ins.
-- One row per user per Monday–Sunday week.
CREATE TABLE IF NOT EXISTS saved_weeks (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start  TEXT NOT NULL CHECK (week_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  data        TEXT NOT NULL,                            -- JSON, validated by the server before saving
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, week_start)
);

-- Feedback from signed-in testers. If a user deletes their account, their feedback
-- is kept but no longer linked to them.
CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  category    TEXT NOT NULL CHECK (category IN ('worked_well', 'confusing', 'broken', 'idea')),
  feature     TEXT NOT NULL,
  page        TEXT NOT NULL,
  rating      INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  message     TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved')),
  admin_notes TEXT,                                     -- never returned to non-admins
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);

-- Minimal record of privileged / irreversible actions.
CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id TEXT,
  action        TEXT NOT NULL,
  target        TEXT,
  detail        TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Fixed-window request counters. D1 is one shared database, so these limits apply
-- across every Cloudflare location (each check costs one row write).
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
