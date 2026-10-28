# Technical build plan

Stack (Observed): static HTML/CSS/JS at the repo root, served by a Cloudflare Worker ([worker.js](../../worker.js), [wrangler.json](../../wrangler.json)) with D1 (`timewise`). Pushing to GitHub `main` auto-deploys. No build step. Tests: `tests/*.test.mjs` (node) and `tests/e2e-*.cjs` (Playwright against `tests/local-server.mjs`).

Every ticket below is **$0**, uses the existing stack, and adds no third-party service. **None is approved yet** unless its status says otherwise. Rollback for every ticket is to revert its commit and push. TW-04 and TW-05 also leave unused nullable columns or rows behind, which is harmless.

## Done (approved)

| ID | What | Approval |
|---|---|---|
| TW-00 | How-to video + dialog on home ([index.html](../../index.html) lines 84, 224, 264; [styles.css](../../styles.css) end of file; `assets/video/`) | Owner-approved and live 2026-10-27 |
| TW-00a | Overlapping caption cues fixed in `assets/video/timewise-how-to.vtt` (no visible change; the burned-in captions were unaffected) | Minor correction, same behavior; included with this docs commit |
| TW-00b | `docs` added to [.assetsignore](../../.assetsignore) so these internal docs and CSVs are not served publicly | Routine; keeps current public behavior |
| TW-01 | Setup events `setup_classes_added`, `setup_google_clicked` added to worker.js `TRACKED_EVENTS` | Owner-approved 2026-10-28 (first release) |
| TW-02 | "Was this video clear? Tell us what was confusing" under the player; closes the video and opens the existing feedback form with "How-to video" preselected; only shown where feedback works | Owner-approved 2026-10-28 |
| TW-03 | Feedback "part of the site" list relabeled (Why TimeWise, Week, Look back, Replan) and extended (Today, Setting up my week, How-to video); stored keys unchanged; default on Try it is now Today; admin.js labels updated | Owner-approved 2026-10-28 (emoji left as is: not part of the approval) |
| TW-06 | `video_opened`, `video_half`, `video_completed`, `video_cta_clicked` (once per browser), privacy.html sentence + date, admin.js and results.html labels | Owner-approved 2026-10-28 |

First-release tests (2026-10-28, local test server): `accounts.test.mjs` 99/99, `insights.test.mjs` 51/51, `e2e-browser` 59/59 (one expectation updated: Try it now defaults feedback to Today), `e2e-today` 32/32, `e2e-week-tools` 29/29 on a fresh test database, `e2e-reality-merge` 16/16, new [`e2e-video-feedback`](../../tests/e2e-video-feedback.cjs) 21/21. `e2e-launch` fails its first check ("visit counted with its source") and then times out; it fails the same way on the code before this release, so it is an existing test issue, not caused by these changes.

## Proposed tickets

### TW-01 · P1 · Record the two setup events the client already sends · **Shipped in first release**
- **Problem/evidence:** script.js line 3581 sends `setup_classes_added` and line 3676 sends `setup_google_clicked`. Neither is in worker.js `TRACKED_EVENTS` (line 314), so `/api/track` returns 400 (line 243) and the data is lost.
- **Change:** add both names to `TRACKED_EVENTS`.
- **Files:** worker.js. **Reuse:** existing allowlist.
- **Privacy:** already covered by privacy.html ("which features a visitor used at least once").
- **Acceptance:** with the local server, both calls return 204 and rows appear in the `events` table; `node tests/accounts.test.mjs` still passes.
- **Effort:** 10 min. **Risk:** very low. **Metric:** setup funnel becomes visible.

### TW-02 · P1 · Feedback link inside the video dialog · **Shipped in first release**
- **Problem:** no feedback route near the tutorial.
- **Change:** under the player, add the line "Was this video clear? Tell us what was confusing." as a button that closes the video and opens the existing feedback dialog (`openFeedback`) with a new "How-to video" option preselected.
- **Files:** index.html (dialog markup + inline script); script.js (`FEEDBACK_FEATURES` line 2716, expose `openFeedback(feature)`); server/accounts.js `FEEDBACK_FEATURES` line 44 (add `how_to_video`). No schema change: the `feature` column has no CHECK constraint (migrations/0001_accounts.sql line 67).
- **Acceptance:** keyboard-reachable, at least 40 px tall; signed-out users get the existing sign-in prompt (or TW-04's form, if approved); the stored row has `feature = 'how_to_video'`.
- **Effort:** 1–2 h. **Risk:** low.

### TW-03 · P1 · Update "Which part of the site?" options · **Shipped in first release** (emoji question still open)
- **Problem:** labels don't match the site (The Idea page → Why TimeWise; Your week → Week; Plan vs. Reality → Look back), and Today, Setup and How-to video are missing.
- **Change:** relabel; add `today`, `setup`, `how_to_video`; keep old values valid on the server so existing rows still display. Optional: remove the emoji from the type choices (owner's call).
- **Files:** script.js line 2716; server/accounts.js line 44; admin.js labels if hard-coded.
- **Acceptance:** `tests/accounts.test.mjs` passes; the admin inbox shows old and new values.
- **Effort:** 1 h. **Risk:** low.

### TW-04 · P2 · Short anonymous feedback for signed-out visitors (**major: data handling and auth change**)
- **Problem:** feedback needs a Google account: 3 real items total, 0 since Oct 20, and 14 accounts against 203 browsers.
- **Change:** signed-out users see a short form (type + message + optional rating, no email) instead of only "Sign in". New route `POST /api/feedback/anonymous` (proposed) with a same-origin check, IP rate limit (for example 5/hour, reusing `allow()`), a honeypot field, and 1,000 characters max. Stored with `user_id` NULL and a new source value `anonymous`, shown separately from Real in the admin dashboard.
- **Files:** server/accounts.js (route + validation); server/insights.js `FEEDBACK_SOURCES`; a migration, because `source` has a CHECK constraint allowing only real/observation/test/automated (migrations/0002_insights.sql lines 10–11), and SQLite needs a table rebuild to change it (an alternative is storing anonymous items as `observation` with a marker, but that mixes evidence types); script.js `renderFeedbackSignedOut`; privacy.html (one paragraph).
- **Acceptance:** spam/limit tests; anonymous items never appear under "My account"; admin-only access unchanged.
- **Effort:** 4–6 h. **Risk:** medium (spam, data policy).

### TW-05 · P2 · Two optional questions: "keep using" (1–5) and "priority area" (**major: schema change**)
- **Change:** a migration adding nullable `keep_using INTEGER CHECK (1–5)` and `priority_area TEXT` to `feedback`; both optional in the form; rating relabeled with words.
- **Files:** `migrations/0004_feedback_questions.sql` (proposed); server/accounts.js `submitFeedback`; script.js `renderFeedbackForm`; admin.js inbox columns.
- **Effort:** 3–4 h. **Risk:** low–medium (migration run by the owner in the D1 console).

### TW-06 · P2 · Video engagement events (**new data collection**) · **Shipped in first release**
- **Change:** `video_opened`, `video_half`, `video_completed`, `video_cta_clicked` (see [data/event_dictionary.csv](data/event_dictionary.csv)); add to `TRACKED_EVENTS`; one sentence on privacy.html.
- **Files:** index.html inline script (call the global `track` if exposed, or post to `/api/track` directly); worker.js line 314; privacy.html.
- **Acceptance:** each fires at most once per browser at the exact trigger; no event fires on page load.
- **Effort:** 1–2 h. **Risk:** low.

### TW-07 · P3 · "Didn't happen" shouldn't scroll the page to Look back
- **Problem:** found while recording: on desktop, checking in on Today moves focus into the Look back form, so the page jumps.
- **Change:** don't move focus on Today check-ins, or use `focus({preventScroll: true})`.
- **Files:** script.js (the Today check-in handler; exact line to confirm). **Test:** add a scroll-position check to tests/e2e-today.cjs.
- **Effort:** 1 h. **Risk:** low.

### TW-08 · P3 · Link the video from Try it
- **Change:** in the sample-week note (try.html line 97), add "New here? Watch the 1:25 how-to," which opens the same dialog. The dialog markup would need to move into a shared include or be duplicated.
- **Effort:** 1–2 h.

### TW-09 · P3 · Public transcript in the dialog
- **Change:** a `<details>` "Read the transcript" under the player with the text from [transcript.md](transcript.md).
- **Effort:** 30 min.

## Test plan once tickets are approved

`node tests/accounts.test.mjs`, `node tests/insights.test.mjs`, and with the local server running `node tests/e2e-browser.cjs`, `node tests/e2e-today.cjs`, plus a manual pass on desktop and phone widths: keyboard only, the video dialog, the feedback dialog in signed-in and signed-out states, and error states (server down, rate limit).
