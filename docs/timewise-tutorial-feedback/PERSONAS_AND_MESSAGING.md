# Personas and messaging

Run date: 2026-10-27. **All personas below are provisional (Hypothesis).** No interviews or usability tests have been run. "Maya" is a synthetic sample student used by the site, not a real user.

## Evidence actually available

| Source | Coverage | What it says | Limits |
|---|---|---|---|
| Early-access survey (`signups` table, aggregate counts, read 2026-10-27) | 6 respondents, Sep–Oct 2026 | Biggest struggle: one each for "Balancing school, work & life", "Deadlines piling up", "Knowing what to do first", "Plans falling apart mid-day", "Procrastinating", and one blank. How they plan now: Google/Apple Calendar 3, Notion or a to-do app 2, something else 1. Would use weekly: Definitely 3, Probably 2, blank 1. | Far too small to rank personas; the spread is even |
| Usage counts (D1, aggregate) | 203 browsers, 14 accounts as of 2026-10-27 | 83% of visit-days under 60 seconds; Google Calendar and typed events were the top sources of users' own events (Oct 20) | Browser IDs are not people |
| Real feedback | 3 items (FB-2 4/5, FB-3 4/5, FB-4 1/5 bug, fixed) | One reflection bug | Very small |
| Public research | **Not performed.** | — | The survey already shows most respondents use an existing calendar, which answered the "status quo" question this video needed. |

**Inferred:** 5 of 6 respondents already plan in a calendar or app, so the tutorial should present TimeWise as working *with* that calendar rather than replacing it.

## Persona hypotheses mapped to the product

| | A: Overwhelmed student | B: Overcommitted student | C: Building better habits |
|---|---|---|---|
| Trigger | Several deadlines land in one week | One thing runs late and the day slides (class, shift, practice) | Wants a routine, has tried planners before |
| Job to be done | Know what to do first today | Fix the rest of today without redoing everything | Check in briefly and keep going after a bad day |
| Current workaround | To-do list or calendar, re-sorted in their head | Calendar; drops the gym or the essay ad hoc | Paper planner, Notion, streak apps |
| Why it persists | Free, familiar | Rearranging a calendar mid-day is slow | Already invested in a system |
| Needs (stated cautiously) | A clear "next" and how much time is left | A fast replan that respects fixed commitments | Low setup, no guilt when it slips |
| Verified features | Today: Next block, free time, heads-ups | Replan; overlaps; packed-day warning | 5-minute setup; Didn't happen → put it back; Look back without a score |
| Barriers / objections | "Another app to check" | "I don't have time to set it up" | "I'll stop using it in a week"; Practice page uses a score |
| Accessibility needs | Readable captions; keyboard use | Works muted on a phone between classes | Plain language |
| Tutorial example | Today scene | Replan scene (Maya's messy Monday) | Missed-block and Look back scenes |
| Next action | Start my week | Start my week → connect calendar | Start my week |

**Primary audience for the tutorial (owner-approved 2026-10-27):** Persona B, with A and C served in the Today and no-guilt scenes.

## Message hierarchy

- **Primary promise:** When your day stops matching your plan, TimeWise helps you fix the rest of it. *(Supported by the Replan feature; does not claim less stress or better grades.)*
- **Supporting messages (max 3):**
  1. See what's next and how much time you have left today. *(Today view.)*
  2. Missed something? Put it back, no guilt. *(Didn't happen → put it back.)*
  3. Bring the calendar you already use. *(Google Calendar, Notion, .ics import, all read-only.)*
- **Proof shown on screen:** the real Today, Replan and Look back screens with Maya's sample week.
- **Call to action:** Start my week.

## Claims to avoid

TimeWise does not send reminders, suggest when to do assignments, create recurring events, or write back to calendars (about.html lines 150–156). Do not say it "reduces stress", "boosts productivity", or "fixes your schedule".

## Recommended validation (small)

A 3–5 student explain-back test of the video (see [MEASUREMENT_PLAN.md](MEASUREMENT_PLAN.md)) plus asking each tester which of the three situations above sounds most like their week. That is the cheapest way to move a persona from Hypothesis toward evidence.
