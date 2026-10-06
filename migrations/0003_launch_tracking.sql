-- Launch tracking (Oct 2026): what's needed to measure the "50 users by Oct 20" goal.
-- Run once in the Cloudflare dashboard → D1 → timewise → Console. Safe to run twice:
-- the CREATE statements skip tables that exist (the two ALTERs will say "duplicate column"
-- the second time, which is harmless).

-- One row per signed-in user per day they opened TimeWise → "returned" = 2+ days.
CREATE TABLE IF NOT EXISTS user_days (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,                       -- YYYY-MM-DD (UTC)
  PRIMARY KEY (user_id, day)
);

-- One row per anonymous browser ID per day: where the visit came from (?from= tag)
-- and roughly how long the page was open and visible (60-second steps, capped at 4 hours).
-- No names, emails, or IP addresses.
CREATE TABLE IF NOT EXISTS visit_days (
  visitor_id TEXT NOT NULL,
  day        TEXT NOT NULL,                    -- YYYY-MM-DD (UTC)
  source     TEXT,                             -- e.g. team, class, friend, academic
  seconds    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (visitor_id, day)
);
CREATE INDEX IF NOT EXISTS idx_visit_days_day ON visit_days(day);

-- Which link a user first came from, and whether they said it's OK to email them once for feedback.
ALTER TABLE users ADD COLUMN source TEXT;
ALTER TABLE users ADD COLUMN contact_ok INTEGER NOT NULL DEFAULT 0;
