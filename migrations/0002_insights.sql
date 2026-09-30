-- Migration 0002: product-insights workspace (feedback → evidence → problem → experiment → decision)
-- Apply locally:  npx wrangler d1 migrations apply timewise --local
-- Live database:  only after approval (see PRODUCT_LOOP.md). Adds columns and tables; deletes nothing.

-- Where each feedback item came from. Only 'real' counts as evidence of user traction.
--   real        = submitted by a signed-in tester through the in-app form
--   observation = logged by an admin from an interview / usability session / conversation
--   test        = created while testing the site (not real user evidence)
--   automated   = created by automated test scripts
ALTER TABLE feedback ADD COLUMN source TEXT NOT NULL DEFAULT 'real'
  CHECK (source IN ('real', 'observation', 'test', 'automated'));

-- Optional admin-set context. NULL means "Unknown / Not enough evidence".
ALTER TABLE feedback ADD COLUMN journey_stage TEXT
  CHECK (journey_stage IS NULL OR journey_stage IN ('first_impression', 'onboarding', 'creating_schedule',
    'adding_commitments', 'planning', 'prioritizing', 'completing_work', 'adjusting_plans',
    'reviewing_progress', 'returning', 'other'));
ALTER TABLE feedback ADD COLUMN user_type TEXT CHECK (user_type IS NULL OR length(user_type) <= 60);

-- Underlying user problems that one or more feedback items point to.
CREATE TABLE IF NOT EXISTS problems (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  title                TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  theme                TEXT CHECK (theme IS NULL OR length(theme) <= 60),   -- free text: themes come from the evidence
  -- Problem statement
  ps_user              TEXT,   -- USER: who is experiencing it
  ps_situation         TEXT,   -- SITUATION: when it happens
  ps_problem           TEXT,   -- PROBLEM: what is difficult
  ps_impact            TEXT,   -- IMPACT: what happens because of it
  -- Observation vs interpretation (mandatory separation)
  known                TEXT,   -- What we know (direct evidence)
  interpretation       TEXT,   -- What we think
  unknowns             TEXT,   -- What we don't know yet
  -- Severity (descriptive labels, with reasoning; no numeric score)
  sev_frequency        TEXT NOT NULL DEFAULT 'unknown' CHECK (sev_frequency IN ('unknown', 'low', 'moderate', 'high')),
  sev_impact           TEXT NOT NULL DEFAULT 'unknown' CHECK (sev_impact IN ('unknown', 'low', 'moderate', 'high')),
  sev_reach            TEXT NOT NULL DEFAULT 'unknown' CHECK (sev_reach IN ('unknown', 'low', 'moderate', 'high')),
  sev_core             TEXT NOT NULL DEFAULT 'unknown' CHECK (sev_core IN ('unknown', 'low', 'moderate', 'high')),
  sev_confidence       TEXT NOT NULL DEFAULT 'unknown' CHECK (sev_confidence IN ('unknown', 'low', 'moderate', 'high')),
  severity_reasoning   TEXT,
  -- Opportunity
  user_need            TEXT,
  opportunity          TEXT,
  potential_solutions  TEXT,
  smallest_change      TEXT,
  risk                 TEXT,
  priority             TEXT NOT NULL DEFAULT 'unset' CHECK (priority IN ('unset', 'now', 'next', 'later', 'do_not_build')),
  status               TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'needs_research', 'planned',
                          'in_development', 'testing', 'validated', 'rejected', 'deferred')),
  created_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);

-- Which problem a feedback item is evidence for (optional).
ALTER TABLE feedback ADD COLUMN problem_id INTEGER REFERENCES problems(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_problem ON feedback(problem_id);
CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(source);

-- Small product experiments.
CREATE TABLE IF NOT EXISTS experiments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id        INTEGER REFERENCES problems(id) ON DELETE SET NULL,
  title             TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  hypothesis        TEXT,   -- We believe that…
  change_desc       TEXT,   -- We will…
  target_users      TEXT,   -- For…
  expected_behavior TEXT,   -- We expect users to…
  success_evidence  TEXT,   -- We will look for…
  failure_evidence  TEXT,   -- It may not be working if…
  next_decision     TEXT,   -- Depending on the evidence, we will…
  before_state      TEXT,   -- What was happening before
  after_state       TEXT,   -- What happened after
  actual_result     TEXT,
  started_on        TEXT CHECK (started_on IS NULL OR started_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  ended_on          TEXT CHECK (ended_on IS NULL OR ended_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  decision          TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'keep', 'iterate', 'revert', 'inconclusive')),
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Product decision log.
CREATE TABLE IF NOT EXISTS decisions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  title              TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),   -- Decision
  decided_on         TEXT CHECK (decided_on IS NULL OR decided_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  problem_id         INTEGER REFERENCES problems(id) ON DELETE SET NULL,
  experiment_id      INTEGER REFERENCES experiments(id) ON DELETE SET NULL,
  problem_text       TEXT,
  evidence           TEXT,
  interpretation     TEXT,
  options_considered TEXT,
  decision_made      TEXT,
  reason             TEXT,
  result             TEXT,
  learned            TEXT,
  next_decision      TEXT,
  created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Owner decision (2026-09-30): everything submitted before this migration came from the owner's own
-- testing of the live site, so it is labeled 'test' and excluded from real-user evidence. Nothing is deleted.
UPDATE feedback SET source = 'test';
