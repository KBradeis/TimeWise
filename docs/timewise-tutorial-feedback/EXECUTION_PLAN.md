# Execution plan

Capacity (Owner-confirmed earlier in October): about 40 minutes a day through the launch period, and $0. Effort figures below are estimates.

## Owner decisions needed

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D1 | Approve TW-01 (record the two setup events) | Yes | Setup funnel data |
| D2 | Approve TW-06 (video events + privacy line) | Yes | Measuring the video |
| D3 | Approve TW-02 + TW-03 (feedback link in the video; current site names in the form) | Yes | Feedback near the tutorial |
| D4 | Who can send feedback: keep sign-in, or TW-04 anonymous short form | TW-04 | Hearing from first-minute visitors |
| D5 | Approve TW-05 (two optional questions, migration) | Later, after D4 | Brief's full question set |
| D6 | Practice page scoring vs "never a score" | Owner's call | — |
| D7 | Triage cadence (proposed Mon/Thu, 15 min) and who else, if anyone, reads feedback | Confirm | Feedback loop |
| D8 | Brand voice draft ([BRAND_VOICE.md](BRAND_VOICE.md)) | Approve or edit | Future copy |

## Dependency-ordered actions

1. **Now (done 2026-10-27):** video live; docs written; docs kept off the public site; caption timing fix. This commit is waiting for the owner to push.
2. **After D1–D3 (about 3 h of build, by Claude in the repo):** TW-01, TW-06, TW-02, TW-03 in one small release, then run tests and push.
3. **Same week:** explain-back test with 3–5 students (owner, about 1 h total); log the answers as Observations.
4. **After D4:** TW-04, then a privacy page update, then release.
5. **Day 14 after step 2:** compare against the baseline in [MEASUREMENT_PLAN.md](MEASUREMENT_PLAN.md); update [data/feedback_opportunities.csv](data/feedback_opportunities.csv); send close-the-loop notes the owner approves.
6. **Later:** TW-05, TW-07, TW-08, TW-09 as evidence supports them.

## First release contents (proposed)

TW-01 + TW-02 + TW-03 + TW-06: small, reversible, and no schema change.

## Maintenance cadence

- Feedback triage: Mon and Thu (proposed).
- Roadmap review: weekly (PRODUCT_LOOP "Copy all for AI analysis").
- Re-record the video when setup, Replan output or navigation labels change.
- Review dates for each open item are in [data/feedback_opportunities.csv](data/feedback_opportunities.csv).
