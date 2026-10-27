# Product audit: TimeWise today

Run date: 2026-10-27. Static inspection of the repository at commit `7826753` (the how-to video commit), plus read-only, aggregate-only queries of the production D1 database (no names, emails or message text read). Nothing was installed, migrated or deployed for this audit.

Evidence labels used in every file in this folder: **Observed in repository**, **Owner-confirmed**, **Documented intention**, **Planned**, **Externally observed**, **Inferred**, **Hypothesis**, **Unavailable/unverified**.

## 1. What TimeWise does today

TimeWise is a website for students "whose weeks don't go as planned." It shows what's next today, flags overlaps and packed days, and replans the rest of a day when the student falls behind ([index.html](../../index.html) hero, line 74 onward). It is a student project for BUS 131A ([about.html](../../about.html) "Where it stands").

| Finding | Evidence location | Status | Confidence | User consequence | Production verification needed |
|---|---|---|---|---|---|
| Today view: next block, now line, free time, heads-ups (overlaps, packed day, missed block) | [script.js](../../script.js) section 18 (`renderToday`, ~line 3708); [tests/e2e-today.cjs](../../tests/e2e-today.cjs) | Observed in repository; tested by e2e script | High | Answers "what's next and how much time is left" | Seen live in the Oct 27 recording |
| Check-ins: Done / Didn't happen, and a no-guilt offer to put a missed block back | script.js `TODAY_STATUS` (~line 4040); e2e-today.cjs "Mark complete, miss a task, recover" | Observed; tested | High | Recovery without blame | Seen live |
| Replan ("I'm running behind"): fixed blocks stay, movable ones shift, overflow goes to tomorrow | [try.html](../../try.html) line 94 (`todayBehindBtn`), line 290 (`replanExampleBtn`); script.js `replan_used` / `replan_applied` | Observed | High | The core differentiator | Seen live |
| Look back: mark what happened, get one pattern and one next step | try.html line 371; script.js `reflection_viewed` | Observed | High | Reflection without a score | Seen live |
| Week from typing, Google Calendar (read-only, in browser), Notion (via server, not stored), .ics file import | [README.md](../../README.md) "Calendar linking"; [privacy.html](../../privacy.html) | Observed | High | Uses the calendar students already have | Google flow shows an "unverified app" warning (try.html setup copy) |
| First-run setup ("Start my week"): sign in, connect calendar or type up to 3 classes, then Today | try.html line 103; script.js `startSetup` line 3474, `renderSetup` line 3596 | Observed; owner-confirmed live 2026-10-27 | High | The step where half of signed-in users stalled | Live |
| Google sign-in saves the week; session cookie up to 30 days | [server/accounts.js](../../server/accounts.js); privacy.html | Observed | High | Needed to keep a week | Live |
| Practice quiz (10 questions, score, streak, XP) | [practice.html](../../practice.html) | Observed | High | Uses a score, which conflicts with "never a score" in [DESIGN.md](../../DESIGN.md) | — |
| How-to video (1:25, burned-in captions + .vtt) in a dialog from the home hero | [index.html](../../index.html) lines 84, 224, 264; `assets/video/` | Observed; owner-approved and live 2026-10-27 | High | First tutorial on the site | Verified live in a browser 2026-10-27 |
| Not built: phone app with reminders, assignment suggestions, recurring events inside TimeWise, sync back to calendars | about.html lines 150–156 | Documented as not built | High | Must not appear in the tutorial | — |

## 2. Primary journey and the task to demonstrate

Home → **Start my week** → setup (add your week) → **Today** each morning → **I'm running behind** when the day slips → **Look back** at night.

The most useful task to demonstrate is **Replan the rest of a day**, preceded by a quick "add your week" step. Reasons:
- Replan is what makes TimeWise different from a calendar (about.html "Fixing the day matters more than planning the week").
- Adding a week is where users stall: on 2026-10-20, 7 of 14 signed-in users had added no events (project doc `timewise-traction-baseline.md`, Oct 20 snapshot).
- Calendar connections were the top source of users' own events on Oct 20 (Google Calendar 25, typed 24).

## 3. Value proposition, voice, and visual identity

- **Value proposition (Observed):** "For weeks that don't go as planned." (index.html line 74.)
- **Principles (Observed, DESIGN.md):** plans fall apart and that's normal; one coral thing at a time; answer what's next / time left / what needs attention; no guilt; write like a friend who's good at planning, with no hype and no decorative emoji; every control at least 40px and keyboard-usable.
- **Visual tokens (Observed, styles.css section 1):** paper `#eef4f3`, ink `#17393d`, teal `#1f6e72`, coral `#e8684a` for now/next only; Schibsted Grotesk headings, Atkinson Hyperlegible Next body, IBM Plex Mono times.

## 4. Existing help, tutorial and feedback

| Item | Evidence | Notes |
|---|---|---|
| How-to video dialog on home | index.html lines 84–275 | Not linked from Try it; no feedback route inside the dialog |
| Sample week (Maya) on Try it, with "Set up my own week" | try.html line 97–99 | Maya is a synthetic persona |
| Setup card with step text and the Google warning explained | script.js `renderSetup` | Good inline help |
| Feedback dialog (floating "Feedback" button; "Send feedback" in menu and on Try it) | script.js `buildFeedbackDialog` ~line 2861, `addFeedbackButton` ~line 3089; try.html line 393 | **Requires Google sign-in** (`renderFeedbackSignedOut`) |
| Feedback form fields | script.js `FEEDBACK_CATEGORIES` line 2721, `FEEDBACK_FEATURES` line 2716 | Type (worked well / confusing / didn't work / change something), part of site, message (required, 2,000 max), rating 1–5 optional |
| Feedback storage and access | server/accounts.js lines 445–470; migrations/0001_accounts.sql line 63 | D1 `feedback` table; per-user rate limit 10/hour (line 50); admin-only inbox (`role = 'admin'`, line 106); users see only their own feedback (line 471) |
| Feedback analysis loop | [PRODUCT_LOOP.md](../../PRODUCT_LOOP.md); admin.html | Problems, experiments, decisions tables (migration 0002) |

## 5. Analytics and operations

| Capability | Evidence | Notes |
|---|---|---|
| Anonymous feature counts, once per feature per browser | script.js `track()` line 2624; worker.js `TRACKED_EVENTS` line 314 | Random browser ID in localStorage; no cookies or names |
| Daily visit + time open in 60-second steps + `?from=` tag | script.js `ping()` line 2610; `visit_days` table | Disclosed on privacy.html |
| Signed-in active days | `user_days` table (migration 0003) | |
| **Bug: two events are sent but rejected** | script.js line 3581 `setup_classes_added`, line 3676 `setup_google_clicked`; not in worker.js `TRACKED_EVENTS`; worker.js line 243 returns 400 | Setup data is silently lost |
| Video engagement | — | Not tracked (owner approval pending) |
| Cloudflare Web Analytics beacon | index.html line ~255 | Placeholder token, so likely inactive (Inferred) |

## 6. Constraints and unknowns

- **Budget:** $0 (owner-confirmed earlier; Workers Free plan).
- **Deploys:** pushing to GitHub `main` auto-deploys (owner-confirmed). Claude cannot push from this session (no GitHub App access).
- **Static assets:** Workers serves the repo root as assets, so any new file is public unless listed in `.assetsignore`. This docs folder was added to `.assetsignore`.
- **Unknowns:** content of feedback items FB-2 and FB-3 (not read); whether the Web Analytics beacon has a real token; who besides the owner triages feedback.
