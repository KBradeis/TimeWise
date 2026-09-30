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

## Production — done (2026-09-30)

- [x] Cloudflare account switched to **Workers Free** (you, in the dashboard)
- [x] Production approval received (Google client, two Worker secrets, database migration, deploy)
- [x] Google sign-in client created in a separate "TimeWise Sign-in" project, published with basic scopes
- [x] `GOOGLE_AUTH_CLIENT_ID` + `GOOGLE_AUTH_CLIENT_SECRET` added as Worker secrets
- [x] Migration applied to the live `timewise` database
- [x] Production deployed (commit + push)
- [x] First admin set with the SQL in §7.6 (and verified: exactly one admin row)
- [x] Production testing completed (checklist in §9, with two real Google accounts)
- [x] Remaining issues documented

## What happened during production setup (for next time)

- **Secrets:** the two Google values were first added in the dashboard but didn't survive the deploy
  (most likely saved as *Text*, which a deploy clears). They were re-added from Terminal with
  `npx wrangler secret put …`, which always stores them as *Secrets* that persist across deploys.
- **Deploy:** Cloudflare's Git-connected build sat in "Queued" (no Cloudflare outage was reported), so the
  site was deployed from Terminal with `npx wrangler deploy` — same code, same Worker. Use that as the
  fallback whenever a build stays queued.
- **Google "OAuth client was not found":** fixed by re-entering the Client ID/secret; brand-new Google
  clients can also take a few minutes to start working.
- **Migration:** applied by pasting the SQL into the D1 Console (not via `wrangler d1 migrations`), so
  Wrangler's migration history doesn't list 0001. Running `wrangler d1 migrations apply` later is harmless:
  every statement is `IF NOT EXISTS`.
- **First admin:** the owner signed in on the live site with their own Google account, then ran the §7.6
  `UPDATE users SET role = 'admin' WHERE email = …` in the D1 Console and confirmed one admin row.
- **Live test (owner):** sign-in/out, autosave + reload, feedback, User A/B isolation, admin dashboard
  (status + private note), tester can't see notes or admin page, existing features — all worked.

## Remaining / known issues

- No independent security review of the sign-in code
- Only the current week is editable; past weeks are read-only on My account
- `results.html` (shared `ADMIN_KEY`) still exists alongside the new dashboard; retire it when ready
