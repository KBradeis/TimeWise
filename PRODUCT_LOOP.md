# TimeWise — Product Improvement Loop

> **Status:** live since 2026-09-30 (migration 0002 applied in the D1 Console, deployed with `wrangler deploy`,
> checked by the owner). All feedback sent before that date is labeled **Test**.

How TimeWise turns tester feedback into evidence-backed product decisions, and how to use the admin
dashboard (`/admin.html`) and Claude together to run the loop.

```
Tester → Experience → Feedback / Behavior → Observation → Problem → Pattern → Hypothesis
      → Small change → Experiment → Evidence → Decision → Next iteration
```

The goal is **not** "build as many features as possible." It's "keep making TimeWise more useful to the
students who depend on it," and only change things when evidence supports it.

---

## 1. Where evidence comes from

Every feedback item has a **source**. Only **Real** counts as evidence of what testers experience.

| Source | What it is | Counts in headline numbers? |
|---|---|---|
| **Real** | Sent by a signed-in tester through the 💬 Feedback form | ✅ Yes |
| **Observation** | Something you saw or heard in an interview, usability test, or conversation, logged by an admin with **+ Log an observation** | Shown separately |
| **Test** | Created while testing the site yourself | ❌ Never |
| **Automated** | Created by test scripts | ❌ Never |

- Everything sent before this system went live was your own testing, so it's labeled **Test**.
  Nothing was deleted.
- If you test the live site again, relabel your notes as **Test** in the inbox.
- **What visitors tried** counts are anonymous **browser IDs**, not people. One person on two devices
  counts twice, and a cleared browser counts again.
- **Tester codes** (like `T-3fa91`) are anonymous account codes. One code is one Google account, not a
  verified unique person. The inbox never shows names or emails. The **Testers** tab lists accounts
  only for account management.

## 2. The dashboard tabs

| Tab | Use it to… |
|---|---|
| **Overview** | See real feedback, open problems, what's awaiting validation, themes, where testers get stuck, and opportunities |
| **Feedback inbox** | Read feedback (filters default to **Real**), set status and private notes, relabel sources, set the journey stage, **link feedback to a problem**, log observations, and **copy selected items for AI analysis** |
| **Problems & queue** | Turn related feedback into one underlying problem, with a problem statement, *know / think / don't know*, severity, opportunity, priority, and status |
| **Experiments** | Track hypothesis → change → expected vs. actual result → decision |
| **Decision log** | Record decisions and the evidence behind them, so questions aren't revisited without new evidence |
| **Testers** | Account list (management only) |

**Journey stage:** if you haven't set one, the dashboard shows a best guess from the part of the site,
always marked **(inferred)**.

## 3. What each problem status means

| Status | Meaning |
|---|---|
| **New** | Logged; nobody has reviewed the evidence yet |
| **Investigating** | Actively reviewing the feedback and evidence |
| **Needs more research** | Not enough evidence to decide; needs interviews, a usability test, or more feedback |
| **Planned** | Decided to address it; work hasn't started |
| **In development** | The change is being built |
| **Testing** | The change is live and an experiment is collecting evidence |
| **Validated** | Evidence shows the change helped |
| **Rejected** | Decided not to address it; the reason is in the decision log |
| **Deferred** | A real problem, but not a priority now; revisit later |

**Priority:** Now · Next · Later · Do not build yet (or Not set).
**Severity** uses words, not scores: frequency, impact, reach, core-value relevance, and confidence, each
Unknown / Low / Moderate / High, plus a sentence of reasoning.

## 4. Running the loop with Claude ($0: no AI service is built into the site)

1. **Collect.** Share the site with testers. Log anything you observe in person as an **Observation**.
2. **Export.** In **Feedback inbox**, filter as needed, click **Select all shown**, then
   **Copy selected for AI analysis**. It copies each item in the Feedback Record Format:
   - Sources are labeled, and test items are marked as not evidence.
   - Anything not yet analyzed says *Unknown / Not enough evidence*.
   - No names or emails are included.
3. **Analyze.** Paste it to Claude with "Analyze this with the TimeWise feedback process." Claude answers
   in the agreed order: what users said, what's happening, the evidence, what we don't know, patterns,
   product implications, options, the smallest experiment, the priority, and a validation plan.
4. **Record.** Create or update **Problems** from the analysis, and link the feedback items to them.
   Evidence counts then update automatically.
5. **Experiment.** For a problem marked Now, add an **Experiment**: fill in the hypothesis, the change,
   and the success and failure evidence *before* shipping. Set the problem to **Testing** while it runs.
6. **Decide.** Fill in the before/after and the actual result, set the experiment decision (keep / iterate /
   revert / inconclusive), and log a **Decision**. Set the problem to **Validated**, **Rejected**, or back
   to **Investigating**.
7. **Repeat.** **Problems & queue → Copy all for AI analysis** exports problems, experiments, and decisions
   together, so the next analysis starts from what you've already learned.

## 5. Evidence rules

- One tester's opinion is a data point, not a requirement.
- A feature request is a clue to an underlying problem. Ask what they're trying to solve.
- Keep **what we know** (direct evidence) separate from **what we think** (interpretation).
- A result after a change is evidence, not proof. Note what else could explain it.
- Combine what testers **say** (feedback) with what they **do** (feature counts, observations).
- When there isn't enough evidence, mark the problem **Needs more research** and choose the lightest way
  to learn more: a short interview, a usability test, or a small experiment.

## 6. Privacy

- Feedback analysis uses anonymous codes; names and emails stay in the Testers tab only.
- Don't put names or identifying details in observations, notes, problems, or decisions.
- No new data is collected from testers by this system. It only organizes feedback they chose to send.

## 7. Technical notes

- Tables: `problems`, `experiments`, `decisions`, plus new `feedback` columns `source`, `problem_id`,
  `journey_stage`, and `user_type` (migration `migrations/0002_insights.sql`).
- API: `server/insights.js` (admin only; the role is checked on the server for every request). Every
  change is recorded in `audit_log`.
- Tests: `node tests/insights.test.mjs` (51 checks) and `node tests/accounts.test.mjs` (94 checks).
  With `node tests/local-server.mjs` running, `node tests/e2e-browser.cjs` runs 55 browser checks.
