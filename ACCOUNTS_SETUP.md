# TimeWise — Accounts, Feedback & Admin: Setup Guide

This guide covers the user-testing system added to the TimeWise site: Google sign-in, saved weeks,
in-site feedback, and an admin dashboard. It explains how it works, how to switch it on in production,
how to test it, and how to undo it.

> **Status:** built and tested locally. **Not deployed yet.** Nothing in Cloudflare or Google has been
> created or changed. The production steps below are for you to do, one at a time, after you approve them.

---

## 1. How it fits together

```
Browser ──(HttpOnly session cookie)──▶ Cloudflare Worker "timewise" ──▶ D1 database "timewise"
   │                                     (worker.js + server/accounts.js)
   └──(sign-in only)──▶ Google ──(code)──▶ Worker ──(code + secret, server to server)──▶ Google
```

There is no file storage (R2), no email service, no analytics service, and no new Cloudflare resources.

| Piece | File | What it does |
|---|---|---|
| Server routes | `server/accounts.js` (imported by `worker.js`) | Sign-in, sessions, saved weeks, feedback, admin API |
| Database changes | `migrations/0001_accounts.sql` | New tables (see §4) |
| Header, Feedback button, autosave | `script.js` section 17 | Runs on every page |
| My account | `account.html` + `account.js` | Profile, saved weeks, your feedback, delete account |
| Admin dashboard | `admin.html` + `admin.js` | Testers, feedback inbox, where people get stuck, feature usage |
| Tests | `tests/` | Security tests + a browser walk-through (not published) |

`server/`, `migrations/`, `tests/`, and these `.md` files are listed in `.assetsignore`, so they are never
served as public files.

---

## 2. Sign-in (authentication)

- **Method:** "Sign in with Google" using Google's standard OpenID Connect authorization-code flow with
  PKCE (S256), `state`, and `nonce`, done on the server. It asks only for **`openid email profile`**
  (name + email) — no Gmail, Drive, or Calendar access.
- **Why no library:** npm downloads are blocked in the environment this was built in, so the flow follows
  Google's published steps directly using the built-in Web Crypto API (approved by you). The ID token is
  received directly from Google's token endpoint over HTTPS using the client secret; per Google's OpenID
  Connect docs, that token doesn't need separate signature verification. Its issuer, audience, expiry,
  nonce, and `email_verified` are still checked.
- **Sessions:** a random 32-byte token in a cookie named `tw_session` — `HttpOnly; Secure; SameSite=Lax`,
  30 days, renewed when used in its second half. The database stores only the token's **SHA-256 hash**.
  Signing out deletes the session row. Nothing about sign-in is stored in `localStorage`.
- **CSRF:** every request that changes data (POST/PUT/PATCH) must carry this site's own `Origin`, or it's refused.
- **Visitors are never forced to sign in.** The whole demo works signed out; signing in adds saving and feedback.

### Required settings (names only — never put values in code, chat, or docs)

| Name | Where | Type |
|---|---|---|
| `GOOGLE_AUTH_CLIENT_ID` | Cloudflare → Worker **timewise** → Settings → Variables and Secrets | **Secret** |
| `GOOGLE_AUTH_CLIENT_SECRET` | same | **Secret** |

(Both are stored as *Secrets* because Cloudflare keeps secrets across deploys, while plain variables not
listed in `wrangler.json` can be removed by a deploy.)

If either is missing, the site behaves exactly as before: no Sign in link, no Feedback button.

---

## 3. Who can do what (enforced on the server)

| | Visitor | User (tester) | Admin |
|---|:---:|:---:|:---:|
| Browse all pages, use the whole demo | ✅ | ✅ | ✅ |
| Week saved to account, see it again later | — | ✅ own only | ✅ own only |
| Send feedback | — | ✅ | ✅ |
| See own feedback + its status (not admin notes) | — | ✅ | ✅ |
| Delete own account | — | ✅ | ✅ (not the last admin) |
| Admin dashboard + `/api/admin/*` | — | ❌ 403 | ✅ |

- **Who you are always comes from the session cookie**, never from an ID, email, or role in the request.
  There is no route that takes a user ID. Saved weeks and "my feedback" are always filtered by the
  signed-in user.
- **Admin checks read `users.role` fresh from the database on every request.** Hiding the admin link is
  just convenience; typing `/admin.html` or calling the API directly still gets refused.
- **No code ever writes `users.role`.** New accounts are always `user`. There is no `/setup`,
  `/make-admin`, or similar endpoint.
- **Admins can see:** testers' names, emails, sign-up and last-sign-in dates, and counts of saved weeks
  and feedback. **Admins can't see:** Google IDs, session tokens, or the contents of anyone's saved week.

---

## 4. Database (Cloudflare D1, database `timewise`)

Added by `migrations/0001_accounts.sql`. Everything uses `CREATE TABLE IF NOT EXISTS`, so the two
existing early-access tables (`signups`, `events`) and their data are untouched.

| Table | Purpose | Key points |
|---|---|---|
| `users` | One row per Google account | `google_sub` unique; `role` ∈ user/admin; `status` ∈ active/suspended |
| `sessions` | Sign-in sessions | `id` = SHA-256 of the cookie token; deleted when the user is deleted |
| `saved_weeks` | A user's week on Try It (events, applied replans, reflection check-ins) | One row per user per week; server validates every field |
| `feedback` | Tester feedback | category, part of site, page, optional 1–5 rating, message ≤ 2,000 chars, status new/reviewing/resolved, private `admin_notes` |
| `audit_log` | Admin feedback updates, account deletions | No secrets stored |
| `rate_limits` | Abuse limits (below) | One shared database, so limits apply across every Cloudflare location |

All queries are parameterized. Foreign keys cascade: deleting a user deletes their sessions and saved
weeks; their feedback is kept but unlinked (`user_id` becomes empty).

**Rate limits:** 20 sign-in attempts per 10 minutes per IP · 10 feedback notes per hour per user ·
240 week autosaves per hour per user · 20 account actions per hour per user. Each check costs one
database write.

---

## 5. Feedback

A **💬 Feedback** button sits in the bottom-right of every page (except the admin page). Signed-out
visitors are asked to sign in with Google first, then brought straight back to the form. The form has:

1. **What's this about?** 👍 Worked well · 🤔 Confusing · 🐞 Didn't work · 💡 I'd change something
2. **Which part of the site?** (pre-filled from the page they're on)
3. **Tell us more** (required, up to 2,000 characters)
4. **Rating 1–5** (optional)

Testers see their notes and a simple status (Received / Being reviewed / Resolved) on **My account**.

---

## 6. Admin dashboard (`/admin.html`)

- Headline numbers: testers signed up (+ this week), signed in this week, new feedback, early-access answers
- **Where people get stuck:** feedback per part of the site, with "confusing" + "didn't work" counted as problems
- **Feedback by type**
- **What visitors tried:** anonymous feature-usage counts (existing tracking)
- **Feedback inbox:** filter by status, type, or part of site; set status; add private notes (logged in `audit_log`)
- **Testers:** everyone who has signed in

The older `results.html` (early-access survey, protected by `ADMIN_KEY`) still works. It can be retired
later if you want everything in one place.

---

## 7. Production setup — for you to do, after approval

**Cost check first:** do step 7.1 before anything else.

### 7.1 Switch Cloudflare to the Workers Free plan (your decision: done by you)
Cloudflare dashboard → **Workers & Pages** → **Plans** → choose **Free**. On Free, going over a limit makes
requests fail until the next day instead of charging you. Removing your card afterward is optional.

### 7.2 Create the Google sign-in client (free, no billing account needed)
Use a **separate** Google Cloud project just for sign-in (e.g. "TimeWise Sign-in"). That way the Calendar
feature's "sensitive" permission and its test-user list don't restrict who can sign in.
1. console.cloud.google.com → create project **TimeWise Sign-in** (don't add a billing account).
2. **Google Auth Platform → Get started:** app name *TimeWise*, your email for support/contact, audience **External**.
3. **Data Access:** the default `openid`, `email`, `profile` are all you need (no sensitive scopes).
4. **Audience → Publish app** (to "In production"). With only basic scopes, Google doesn't require
   verification and there's no 100-user cap.
5. **Clients → Create client → Web application.** Under **Authorized redirect URIs** add exactly:
   `https://timewise.<your-subdomain>.workers.dev/api/auth/callback`
6. Copy the **Client ID** and **Client secret**. Paste them only into Cloudflare (next step), nowhere else.

### 7.3 Add the two secrets to the Worker
Cloudflare → Workers & Pages → **timewise** → Settings → Variables and Secrets → **Add** (type **Secret**)
for `GOOGLE_AUTH_CLIENT_ID` and `GOOGLE_AUTH_CLIENT_SECRET`.

### 7.4 Add the new tables to the live database
**Option A (Terminal, in this folder):** `npx wrangler d1 migrations apply timewise --remote`
**Option B (no Terminal):** Cloudflare → Storage & databases → D1 → **timewise** → **Console**, paste the
contents of `migrations/0001_accounts.sql`, and run it. It only creates tables that don't exist yet.

### 7.5 Deploy
Commit everything in GitHub Desktop and **Push origin** (Cloudflare deploys automatically).

### 7.6 Make yourself the first admin (owner-controlled, one time)
1. On the live site, click **Sign in** and sign in with **your own** Google account.
2. In D1 → **timewise** → **Console**, run (with your real email):
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
   SELECT name, email, role FROM users WHERE role = 'admin';
   ```
3. The second line should show exactly one row: you. Reload the site; **Admin dashboard** appears in your menu.

To add another admin later, have them sign in once, then run the same `UPDATE` with their email. To remove
one: `UPDATE users SET role = 'user' WHERE email = '…';` (keep at least one admin).

### 7.7 Test the live site (see §9)

---

## 8. Local testing

**On your Mac with Wrangler** (optional): create a second Google client (or add a redirect URI) with
`http://localhost:8787/api/auth/callback`, put the two values in a `.dev.vars` file in this folder
(`.gitignore` keeps it out of git), then:
```bash
npx wrangler d1 migrations apply timewise --local   # local copy only, never touches production
npx wrangler dev
```

**Automated tests (no Cloudflare or Google needed):**
```bash
node tests/accounts.test.mjs          # 93 server-side security checks (fake Google, in-memory database)
node tests/local-server.mjs           # local site with a fake Google account chooser, at http://localhost:8791
node tests/e2e-browser.cjs            # 40 browser checks (needs Playwright), with local-server running
```
These use a throwaway SQLite database, never your real D1 data.

---

## 9. Testing checklist for the live site

Use two Google accounts (yours plus one other) and a private/incognito window.

- [ ] Signed out: Sign in link and 💬 Feedback appear; the demo works without signing in
- [ ] Sign in → back on the same page with your name in the header
- [ ] Try It: add an event → "✓ Saved" → reload → it's still there
- [ ] Send feedback → appears on My account as "Received"
- [ ] Second account: doesn't see the first account's week; `/admin.html` says no access
- [ ] Your admin account: dashboard shows both testers and the feedback; set a status and a note
- [ ] Second account: sees the new status, **not** your note
- [ ] Sign out → My account asks you to sign in again
- [ ] Existing features: calendars, Replan, Reflect, practice quiz, early-access form

---

## 10. Undoing it (rollback)

- **Code:** in GitHub Desktop, right-click the commit → **Revert changes in commit** → Push. The site goes
  back to how it was. The new tables stay in D1, unused and harmless.
- **Turn off sign-in without a code change:** delete the `GOOGLE_AUTH_CLIENT_ID` secret; the Sign in link and
  Feedback button disappear.
- **Removing the new tables** permanently deletes testers' accounts and feedback. Only do this deliberately:
  `DROP TABLE rate_limits; DROP TABLE audit_log; DROP TABLE feedback; DROP TABLE saved_weeks; DROP TABLE sessions; DROP TABLE users;`

---

## 11. Cost

Designed for **$0.00/month on the Workers Free plan**.

| Resource | Purpose | Free? | Expected monthly cost | Possible charge? |
|---|---|---|---:|---|
| Worker `timewise` | Website + API | Yes (Free: 100,000 requests/day) | $0 | **Not on Workers Free** — over the limit, requests fail until the next day. **On the Student plan (= Workers Paid) usage above included amounts is billed.** |
| D1 `timewise` | Accounts, sessions, weeks, feedback | Yes (Free: 5M row reads + 100K row writes per day, 5 GB) | $0 | Not on Workers Free (queries fail at the daily limit; data is kept) |
| Google sign-in | Login | Yes (no billing account needed for basic scopes) | $0 | No |
| Feedback | Stored in D1 | Yes | $0 | Same as D1 |
| File storage (R2) | — | Not used | $0 | — |
| Email / analytics / monitoring | — | Not used | $0 | — |

Typical use per tester visit: a few requests and a handful of row writes (autosaves are batched ~1 second
after changes; each rate-limit check is one write). A class-sized group stays far below the free limits.

---

## 12. Not implemented / known limitations

- Email-and-password sign-in (Google only, by your choice)
- Role management in the UI (roles are changed by SQL on purpose)
- Suspending users from the UI (possible via SQL: `UPDATE users SET status = 'suspended' WHERE email = '…'`)
- Only the **current** week loads on Try It; past weeks are viewable (read-only) on My account
- Rate limits are simple fixed windows, not a full abuse-protection system
- The sign-in code follows Google's standard flow without an outside library; it's covered by the test
  suite, but not by an independent security review
- Real Google sign-in and real Cloudflare D1 have **not** been tested yet — only local stand-ins
