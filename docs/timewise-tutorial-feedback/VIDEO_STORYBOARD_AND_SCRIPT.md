# Video storyboard and script: "How to use TimeWise"

Status: **Produced, owner-approved and live (Owner-confirmed 2026-10-27).** This file documents the video as it actually exists. File: [`assets/video/timewise-how-to.mp4`](../../assets/video/timewise-how-to.mp4) (1:25, 1280×720 H.264, about 5.7 MB), poster [`timewise-how-to-poster.jpg`](../../assets/video/timewise-how-to-poster.jpg), captions [`timewise-how-to.vtt`](../../assets/video/timewise-how-to.vtt), transcript [transcript.md](transcript.md).

## Concept and rationale

**"Fix the rest of your day."** The video opens on a Monday that is already slipping, shows that adding your week is quick, then gives Replan the most screen time, because Replan is what a normal calendar can't do. It ends on one action: Start my week.

- Serves Persona B first (overcommitted), with A (Today's "next") and C (no-guilt check-ins) along the way. See [PERSONAS_AND_MESSAGING.md](PERSONAS_AND_MESSAGING.md).
- Reflects the product values: recovery over perfection, no guilt, honesty about limits (it warns about Google's unverified-app screen).
- **Format decisions (Owner-confirmed 2026-10-27):** captions only, no voiceover; Inter as a stand-in font; no music.
- **Every shot is real product footage** of the site running from the repository, except the opening and closing text cards (simple graphics in TimeWise colors). Data is Maya's sample week plus a made-up class ("BUS 131A"). No Google screens, accounts or personal data appear.

## Storyboard (actual timings)

| # | Time | Visual (source) | On-screen action | Caption (exact) | Persona need | Intended outcome |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:07 | Text card (graphic): coral "11:20 AM" chip, three lines | Lines appear one by one | Monday. Lecture ran over. You're 30 minutes behind, and your shift starts at 2. | B: recognizes the moment | Viewer keeps watching |
| 2 | 0:07–0:13 | Home page hero (real) | Cursor moves to Start my week and clicks | TimeWise is a free planner for students whose weeks don't go as planned. | All: what it is, who it's for | Understands the product in 10 s |
| 3 | 0:13–0:22 | try.html#setup (real) | Cursor visits Sign in with Google, Connect Google Calendar, Import a calendar file | Start by adding your week… / Setup takes about five minutes. Then: Google will warn the app isn't verified. Click Advanced, then Go to TimeWise. It's read-only. | C: low effort; all: trust | Not surprised by Google's warning |
| 4 | 0:22–0:33 | Setup class form (real) | Types "BUS 131A", picks Mon and Wed, 9:30–10:50, Add to my week; "Added 1 class" and the class on Today | Or type your classes. It takes about a minute. | C, A | Sees the result of setup |
| 5 | 0:33–0:43 | Crossfade to Maya's sample week, Today (real) | Cursor visits Next block, free time, packed-day heads-up | Here's a full week, using Maya's sample week. / Each morning, Today shows what's next, how much free time you have left, and what needs attention. | A | Knows where to look each morning |
| 6 | 0:43–1:00 | Replan (real) | I'm running behind → Try Maya's messy Monday → Replan the rest of my day → result (Added, Stays, Moved, Tomorrow) | Running behind? Tell TimeWise what changed. / Classes and shifts stay put. Everything else shifts, and whatever won't fit moves to tomorrow. | B | Understands the core value |
| 7 | 1:00–1:09 | Today (real) | Didn't happen on Econ problem set → "That's fine" offer → Put it on Tue | Missed something? That's fine. Put it back in one tap. | C | Sees no-guilt recovery |
| 8 | 1:09–1:20 | Look back (real) | Try Maya's example → reflection's pattern and next step | At night, mark what happened. You get one pattern and one small change for tomorrow. No score. | C | Sees the daily loop close |
| 9 | 1:20–1:25 | End card (graphic) | "Plans fall apart. That's normal." + Start my week + site address | Start my week at timewise.aydink.workers.dev. Sign in with Google so it saves. | All | One clear next step |

## Title, description, thumbnail, CTA

- **Title:** How to use TimeWise
- **Short description:** A 1:25 walkthrough: add your week, check Today, replan when you fall behind, and look back without a score.
- **Thumbnail/poster:** a Replan result frame with "Running behind? Fix the rest of your day." and a coral play button.
- **CTA:** Start my week (in the video's end card and as a button under the player).

## Shot list and recording checklist

Recorded with a scripted browser (Playwright) against a local copy of the site, so the clock, data and cursor are repeatable. Script: `record-how-to-video-v2.cjs`; crossfade editing: `crossfade-cuts-v2.py` (both kept in the owner's `Claude outputs` folder, not in this repo).

- [x] Clock pinned to Monday 1:20 PM so "Next" and "now" are stable
- [x] Fresh browser storage before setup and before Maya's week
- [x] Signed-out view of the live sign-in step (the account API was stubbed to "signed out, sign-in available")
- [x] No real accounts, no Google screens, no personal data
- [x] Captions burned in (high contrast, 22 px on 720p) and a matching .vtt
- [x] Page loads cut out and crossfaded (fix of 2026-10-27)

## Editing notes for future versions

- If a voiceover is ever added, the captions above are the script (about 120 words, roughly 55 seconds of speech).
- Re-record when the setup step, Replan output or nav labels change; the e2e tests in `tests/` are a good early warning.
- Known limit: burned-in captions are small on phones. The .vtt track (CC button) can be used instead.
