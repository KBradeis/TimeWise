# Measurement plan

The question is whether people **understand TimeWise and try it**, not how many play the video. Every number below is an actual read-only aggregate from production D1, unless it's labeled as a proposal. **No targets are set yet.** The owner has to confirm the objective and approve the new events first.

## Baseline (actual, read 2026-10-27 ~17:30 ET, admin accounts excluded; video went live ~15:50 ET the same day)

| Measure | Definition | Value |
|---|---|---|
| Browsers that ever visited | distinct browser IDs with the `visit` event | 203 |
| Browsers that started setup | browser IDs with `setup_started` | 27 |
| Accounts | users with role `user` | 14 |
| New accounts since Oct 20 | created after 2026-10-20 22:00 UTC | 0 |
| Accounts active on 2+ days | from `user_days` | 0 |
| Visit-days | one row per browser per day (`visit_days`) | 180 total; 37 since Oct 21 |
| Visit-days under 60 seconds | `seconds < 60` | 149 of 180 (83%); 32 of 37 since Oct 21 (86%) |
| Real feedback | `feedback.source = 'real'` | 3 total; 0 since Oct 20 |
| Activated users (3+ own events) | from the Oct 20 project snapshot | 4 of 14 (not re-measured) |
| Video plays | — | **Not measured** (no event yet) |

**Limits:** browser IDs are not people (one person on two devices counts twice). The numbers are tiny, so a change of one or two users is noise. Outreach days caused all past spikes, so compare windows with similar outreach.

## Tutorial measures (proposed, TW-06, needs approval)

- Play rate = browsers with `video_opened` ÷ browsers with `visit` on the home page, same window.
- Reach = `video_half` and `video_completed` ÷ `video_opened`.
- CTA = `video_cta_clicked` ÷ `video_opened`.
- Downstream = share of `video_opened` browsers that also have `setup_started` (and, for signed-in users, 3+ own events), compared with browsers that didn't open it. This is correlation only, because people who choose to watch differ from people who don't.
- Clarity = explain-back test (below).

## Feedback measures

- Valid submissions per week, by source (real / anonymous if TW-04 is approved).
- Time from submission to first status change (admin inbox `updated_at`).
- Themes and linked Problems (PRODUCT_LOOP).
- Changes tested and shipped; follow-ups sent and answered.

## Product measures

- Core workflow completed: `setup_started` → own week with 3+ events → `replan_used` or `reflection_viewed`.
- Repeat use: accounts active on 2+ days (`user_days`), currently 0.

## Small usability test (no tooling, $0)

3–5 students, 10 minutes each. They watch the video once, without pausing, then: (1) "In your own words, what does TimeWise do?" (2) "What would you click first?" (3) "Was anything unclear?" Count how many mention fixing the day when it slips, and how many say Start my week. Log each answer as an **Observation** in the admin inbox. With 5 people this finds obvious confusion, not percentages.

## Event dictionary

Full table: [data/event_dictionary.csv](data/event_dictionary.csv). The current model is one row per browser per event (deduplicated by the primary key `visitor_id, event`), with no names, emails or IP addresses. That covers "did this browser ever do X", not counts per session. Proposed video events follow the same model so the privacy page stays accurate, with one added sentence.

## Review

Compare 14 days before and after TW-06 ships. Report actual numbers next to the baseline above. Never claim the video "caused" a change.
