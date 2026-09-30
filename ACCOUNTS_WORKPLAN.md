# TimeWise — Accounts, Feedback & Admin: Workplan

Details for every step are in `ACCOUNTS_SETUP.md`.

## Build (local) — done

- [x] Application inspected (static HTML/CSS/JS + one Cloudflare Worker; D1 `timewise`; no existing accounts)
- [x] Authentication selected (Google sign-in, `openid email profile`, standard OIDC code flow + PKCE, server-side sessions)
- [x] Database designed (users, sessions, saved_weeks, feedback, audit_log, rate_limits)
- [x] Database migration created (`migrations/0001_accounts.sql`, all `IF NOT EXISTS`)
- [x] User accounts implemented (sign in, sign out, My account, delete own account)
- [x] Roles implemented (user/admin, read from the database on every request; set only by the owner via SQL)
- [x] User data saved (Try It week, applied replans, reflection check-ins; autosaved, reloaded on return)
- [x] Feedback implemented (signed-in only; button on every page; testers see status, not admin notes)
- [x] Admin dashboard implemented (`admin.html`: testers, inbox with status + private notes, where people get stuck, feature usage)
- [x] Authorization tested (93 server checks: visitors, forged IDs/roles/tokens, CSRF, expired/logged-out sessions, input validation, rate limits)
- [x] User A/User B isolation tested (server tests + browser walk-through)
- [x] Admin permissions tested (non-admins get 403 from pages and API; admin updates audited)
- [x] Existing website tested (calendars, Replan, Reflect, practice quiz, early-access form, all pages; 40 browser checks)
- [x] Cost checked (see ACCOUNTS_SETUP.md §11; $0 on Workers Free)
- [x] Local testing completed (local stand-ins for D1 and Google; not the real services)

## Production — waiting on you

- [ ] Cloudflare account switched to **Workers Free** (you, in the dashboard)
- [ ] Production approval received (Google client, two Worker secrets, database migration, deploy)
- [ ] Google sign-in client created in a separate "TimeWise Sign-in" project, published with basic scopes
- [ ] `GOOGLE_AUTH_CLIENT_ID` + `GOOGLE_AUTH_CLIENT_SECRET` added as Worker secrets
- [ ] Migration applied to the live `timewise` database
- [ ] Production deployed (commit + push)
- [ ] First admin set with the SQL in §7.6 (and verified: exactly one admin row)
- [ ] Production testing completed (checklist in §9, with two real Google accounts)
- [ ] Remaining issues documented

## Remaining / known issues

- Real Google sign-in and real D1 not yet exercised (only local stand-ins)
- No independent security review of the sign-in code
- Only the current week is editable; past weeks are read-only on My account
- `results.html` (shared `ADMIN_KEY`) still exists alongside the new dashboard; retire it when ready
