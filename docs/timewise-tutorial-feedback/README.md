# TimeWise tutorial and feedback plan

Run date: 2026-10-27 · Repository revision: `7826753` + this docs commit · Prepared with Claude for the owner (Aydin Kijjambu).

**Status (updated 2026-10-28):** The how-to video is live on the home page. The **first release is built and tested**: TW-01 (setup events), TW-02 (feedback link under the video), TW-03 (current names in the feedback form) and TW-06 (video counts + privacy line). It was approved by the owner on 2026-10-28 and goes live when pushed. Still awaiting a decision: TW-04 (anonymous feedback), TW-05, TW-07, TW-08, TW-09, Practice scoring, and the emoji in the feedback type choices. See [TECHNICAL_BUILD_PLAN.md](TECHNICAL_BUILD_PLAN.md).

This folder is excluded from the public site through `.assetsignore`, because Workers serves the repo root as static assets.

## Contents

| File | What it holds |
|---|---|
| [PRODUCT_AUDIT.md](PRODUCT_AUDIT.md) | What TimeWise does today, with file and line evidence; help, feedback and analytics; unknowns |
| [PERSONAS_AND_MESSAGING.md](PERSONAS_AND_MESSAGING.md) | Provisional personas, the evidence actually available, message hierarchy |
| [BRAND_VOICE.md](BRAND_VOICE.md) | Voice rules (observed vs draft), use/avoid examples, checklist |
| [VIDEO_STORYBOARD_AND_SCRIPT.md](VIDEO_STORYBOARD_AND_SCRIPT.md) | The produced video, scene by scene with real timings, title, thumbnail, recording notes |
| [transcript.md](transcript.md) | Full caption text of the video |
| [timewise-how-to.vtt](timewise-how-to.vtt) | Copy of the captions file (the live one is in `assets/video/`) |
| [INTEGRATION_AND_FEEDBACK_PLAN.md](INTEGRATION_AND_FEEDBACK_PLAN.md) | Video placement, the feedback system as it exists, proposed changes, triage and close-the-loop |
| [MEASUREMENT_PLAN.md](MEASUREMENT_PLAN.md) | Actual baseline (Oct 27), proposed measures, usability test |
| [TECHNICAL_BUILD_PLAN.md](TECHNICAL_BUILD_PLAN.md) | Tickets TW-01 to TW-09 with files, acceptance, effort, risk |
| [EXECUTION_PLAN.md](EXECUTION_PLAN.md) | Owner decisions D1–D8 and the order of work |
| [data/feedback_opportunities.csv](data/feedback_opportunities.csv) | Opportunity register (real evidence and audit findings only) |
| [data/event_dictionary.csv](data/event_dictionary.csv) | Every tracked event (observed and proposed) |

## Key findings

1. Replan ("fix the rest of your day") is the strongest verified workflow and the video's centerpiece.
2. 83% of visit-days last under a minute, and there were no new accounts or feedback between Oct 20 and Oct 27 (D1 aggregates).
3. **Feedback requires Google sign-in**, so most visitors can't give it.
4. **Two setup events are being dropped** by the server's allowlist (TW-01).
5. The feedback form's "part of the site" list uses outdated names (TW-03).

## Research and testing actually done

- Static repository inspection; read-only aggregate D1 queries (survey answers n=6, usage counts). No message text, names or emails were read.
- No public or competitor research. No interviews or usability tests.
- Video: tested in a headless browser at desktop and phone sizes, and verified live in a browser on 2026-10-27.

## Next actions

1. ~~Owner pushes the docs commit.~~ Done 2026-10-27.
2. ~~Owner approves the first release.~~ Done 2026-10-28 (D1–D3). D4 (anonymous feedback) still open.
3. ~~Build the first release.~~ Built and tested 2026-10-28; owner pushes to make it live.
4. Run the 3–5 student explain-back test (owner).
5. Compare against the baseline on or after 2026-11-11 (14 days after release).
