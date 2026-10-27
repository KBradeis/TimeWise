# Integration and feedback plan

## Part 1: Where the tutorial lives

### Current behavior (Observed, owner-approved and live 2026-10-27)

- Home hero has a "See how it works 1:25" button ([index.html](../../index.html) line 84) that opens a modal dialog (line 224) with the video, a Start my week button, and a close button.
- Plays only after the click (`preload="none"`), never autoplays with sound, uses native controls (pause, replay, scrub, fullscreen, CC), and pauses when closed. Escape and clicking outside both close it, and focus returns to the button.
- Tested on 2026-10-27 at 1280×800 and 390×844: opens, plays, closes, pauses, no sideways scroll, no console errors. Verified live in a browser the same day.

### Gaps against the brief

| Requirement | Today | Proposal (needs approval) |
|---|---|---|
| Visible feedback route near the tutorial | None inside the video dialog | **TW-02**: add "Was this video clear? Tell us" under the player, opening the existing feedback form with "How-to video" preselected |
| Transcript or text instructions | Captions only; transcript is in this docs folder, which isn't public | **TW-09**: add a "Read the transcript" disclosure inside the dialog |
| Reachable from where people try the product | Home page only | **TW-08**: add "Watch the 1:25 how-to" to the sample-week note on Try it ([try.html](../../try.html) line 97) |
| Easy to spot | Owner had trouble finding the button | Optional: a poster thumbnail instead of a text button (same spot) |
| Engagement measurement | None | **TW-06** in [MEASUREMENT_PLAN.md](MEASUREMENT_PLAN.md) |

Cost of all of the above: $0. The video is served as a static asset from the existing Workers deployment, so no new service is involved.

## Part 2: Feedback experience

### What exists (Observed)

- Routes: floating "Feedback" button on every page; "Send feedback" in the phone menu; "Send feedback" at the bottom of Try it (try.html line 393). Source: [script.js](../../script.js) `addFeedbackButton` (~line 3089).
- **Signed-out visitors are asked to sign in with Google before they can send anything** (`renderFeedbackSignedOut`).
- Form: what it's about (worked well / confusing / didn't work / I'd change something), which part of the site, message (required, up to 2,000 characters), rating 1–5 (optional, "How is TimeWise so far?").
- Server: validates category, feature, length and rating; 10 submissions per user per hour; stored in D1 `feedback`; readable only by that user (their own) and admins; admin notes never returned to non-admins ([server/accounts.js](../../server/accounts.js) lines 43–50, 445–477, 106).
- States: inline error messages; text is kept on failure (the form isn't cleared); success shows only after the server says OK; focus moves to the thank-you message.

**Assessment:** the plumbing (validation, storage, access control, error states) already meets the brief. The weak points are **who can send feedback** and **what the form asks**.

### Evidence of friction

- Real feedback: 3 items in total, and none since 2026-10-20 (D1 aggregate, 2026-10-27).
- Feedback needs a Google account, but 14 accounts against 203 browsers means most visitors never see the form (Inferred).
- The "Which part of the site?" list uses old names: "The Idea page", "Your week", "Plan vs. Reality". It also lacks Today, Setup and the video (script.js line 2716).
- The type buttons use emoji (👍 🤔 🐞 💡), against the "no decorative emoji" rule. These are arguably functional, so this is the owner's call.

### Proposed form (needs approval)

The brief asks six questions. Adding all six to every submission would double the form. I recommend this mapping, which keeps the current short form and adds two optional questions:

| Brief question | Proposal |
|---|---|
| 1. How has your experience been? (5-point) | Keep the existing optional 1–5 rating, relabeled with words: Very negative · Negative · Neutral · Positive · Very positive |
| 2. What has been most useful? | Covered by the type "Something worked well" + message |
| 3. What to add/improve/change? | Covered by "I'd change something" + message |
| 4. Anything confusing or frustrating? | Covered by "Something was confusing" / "Something didn't work" + message |
| 5. How likely to keep using (1–5)? | **New, optional** (TW-05) |
| 6. What area to prioritize? | **New, optional** single choice (TW-05): Organization and planning / Managing competing responsibilities / Ease of use and navigation / Personalization / Accessibility / Other |

Q5 and Q6 need two new nullable columns, so this is a **database migration and needs approval**.

### Who can send feedback (decision for the owner)

| Option | Benefit | Risk | Effort |
|---|---|---|---|
| A. Keep sign-in required (today) | Spam-proof; feedback tied to accounts | Most visitors can't give feedback | None |
| B. **Allow a short anonymous message** (TW-04): no email, IP rate limit, same-origin check, honeypot field, stored with `user_id` NULL and source "anonymous" | Hears from people who leave in under a minute, who are 83% of visits | Some spam; can't follow up | Medium: schema check constraint, server route, privacy page update |
| C. Link to an external form | Fast | New third-party service and data sharing | Not recommended |

**Recommendation: B**, because the people the tutorial is meant to convert are exactly the ones who can't reach the form today.

### Invitation wording (draft, see [BRAND_VOICE.md](BRAND_VOICE.md))

- Under the video: "Was this video clear? Tell us what was confusing."
- Feedback dialog intro: "What would make TimeWise more useful for you?"
- After a first replan (future; only with approval and only once): "Was anything harder than it should have been?"

## Part 3: From feedback to decisions

The repo already has this loop in [PRODUCT_LOOP.md](../../PRODUCT_LOOP.md): admin inbox → Problems → Experiments → Decision log, with Real/Observation/Test/Automated sources. This plan uses that loop and adds a cadence and a register.

- **Register:** [data/feedback_opportunities.csv](data/feedback_opportunities.csv). One row per underlying need, not per request.
- **Statuses:** received, needs clarification, researching, testing, proposed, awaiting owner approval, approved, in progress, released, deferred, declined, closed-loop follow-up.
- **Triage:** the owner, twice a week (Mon and Thu, about 15 minutes), during the launch period. *Owner to confirm.*
- **Roadmap review:** weekly (Sunday), using PRODUCT_LOOP's "Copy all for AI analysis".
- **Urgent items:** anything about data exposure, sign-in or lost weeks skips the queue and is handled the same day.
- **Prioritization:** severity, number of independent users, fit with "fix the rest of your day", effort, risk. Votes and counts are signals, not proof.

### Close the loop (template; drafting is not permission to send)

> You told us [problem]. We understood it as [need]. We [changed / tested / are still looking at] [response] because [reason]. Does this fix what you ran into?

### Worked example (real evidence)

FB-4 (real, rating 1/5): the reflection only named one skipped block, and the button looked dead. Need: trust that Look back reflects the whole day. Response: fixed both (Oct 18–20, listed in the project's traction baseline). Close the loop: "You told us Look back only mentioned one skipped block and the button seemed broken. We fixed both. Does it match your day now?" Status: released; follow-up not yet sent.
