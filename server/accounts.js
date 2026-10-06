/* ==========================================================================
   TimeWise — accounts, saved weeks, feedback, and admin API
   Imported by worker.js. See ACCOUNTS_SETUP.md for the full picture.

   Sign-in is Google's standard OpenID Connect "authorization code" flow with
   PKCE, state, and nonce, done server-side:
     1. /api/auth/login   → redirect to Google (scopes: openid email profile)
     2. /api/auth/callback → exchange the code with Google over HTTPS using our
        client secret, check the ID token's issuer/audience/expiry/nonce and
        that the email is verified, then create a session.
   Because the ID token comes straight from Google's token endpoint over TLS
   (authenticated with our client secret), Google's docs say its signature
   doesn't need separate verification; the claims are still checked.

   Sessions: a random 32-byte token in an HttpOnly, Secure, SameSite=Lax
   cookie. The database stores only its SHA-256 hash. 30-day lifetime,
   extended when used in the second half of its life.

   Authorization rules (enforced here, on the server, for every request):
     - Who you are comes ONLY from the session cookie — never from a user ID,
       email, or role in the request.
     - Saved weeks and "my feedback" queries are always filtered by that user.
     - /api/admin/* requires role = 'admin' read fresh from the users table.
     - Nothing in this file ever writes users.role.
     - State-changing requests must come from this site's own origin (CSRF).

   Required settings on the Worker (names only — values never go in code):
     GOOGLE_AUTH_CLIENT_ID      (plain variable)
     GOOGLE_AUTH_CLIENT_SECRET  (secret)
   ========================================================================== */

import { handleInsightsApi, FEEDBACK_SOURCES, JOURNEY_STAGES } from "./insights.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const SESSION_COOKIE = "tw_session";
const OAUTH_COOKIE = "tw_oauth";
const SESSION_DAYS = 30;
const DAY = 86400;

const FEEDBACK_CATEGORIES = ["worked_well", "confusing", "broken", "idea"];
const FEEDBACK_FEATURES = ["home", "the_idea", "your_week", "calendars", "replan", "reflect", "practice", "early_access", "account", "other"];
const FEEDBACK_STATUSES = ["new", "reviewing", "resolved"];

// Limits per fixed window: [max requests, window in seconds]
const LIMITS = {
  login: [20, 600],        // per IP: sign-in attempts
  feedback: [10, 3600],    // per user: feedback submissions
  weekSave: [240, 3600],   // per user: autosaves of the week
  account: [20, 3600]      // per user: other account writes
};

// Shapes allowed in a saved week (mirrors the event object in script.js)
const EVENT_CATEGORIES = ["class", "assignment", "personal", "work", "timewise"];
const EVENT_SOURCES = ["sample", "manual", "google", "notion", "ics", "timewise", "google-demo", "notion-demo"];
const REALITY_STATUSES = ["done", "over", "swapped", "skipped"];
const REALITY_REASONS = ["", "overflow", "energy", "urgent", "distracted", "bigger", "avoid"];
const MAX_EVENTS_PER_WEEK = 200;

/* ---------- Entry point ---------- */

// Returns a Response for account-related routes, or null so worker.js can handle others.
export async function handleAccountsApi(request, env, url) {
  const path = url.pathname;
  if (!/^\/api\/(auth|me|feedback|admin)(\/|$)/.test(path)) return null;

  if (!env.DB) return json({ error: "not_configured" }, 503);
  const method = request.method;

  // CSRF: anything that changes data must be sent by pages on this same site
  if (method !== "GET" && method !== "HEAD" && !sameOrigin(request, url)) {
    return json({ error: "bad_origin" }, 403);
  }

  // ----- Sign-in -----
  if (method === "GET" && path === "/api/auth/login") return login(request, env, url);
  if (method === "GET" && path === "/api/auth/callback") return callback(request, env, url);
  if (method === "POST" && path === "/api/auth/logout") return logout(request, env);
  if (method === "GET" && path === "/api/auth/me") {
    const session = await getSession(request, env);
    if (session) await recordActiveDay(env, session.user, url.searchParams.get("from"));
    return withSessionCookie(session, json(session
      ? { signedIn: true, user: publicUser(session.user) }
      : { signedIn: false, configured: authConfigured(env) }));
  }

  // Everything below needs a signed-in, active user
  const session = await getSession(request, env);
  if (!session) return json({ error: "not_signed_in" }, 401);
  const user = session.user;
  const respond = (res) => withSessionCookie(session, res);

  // ----- The signed-in user's own data -----
  if (path === "/api/me/week" && method === "GET") return respond(await getWeek(env, user, url));
  if (path === "/api/me/week" && method === "PUT") return respond(await putWeek(request, env, user));
  if (path === "/api/me/weeks" && method === "GET") return respond(await listWeeks(env, user));
  if (path === "/api/me/feedback" && method === "GET") return respond(await myFeedback(env, user));
  if (path === "/api/me/delete" && method === "POST") return deleteAccount(request, env, user);
  if (path === "/api/me/contact" && method === "POST") return respond(await setContactOk(request, env, user));
  if (path === "/api/feedback" && method === "POST") return respond(await submitFeedback(request, env, user));

  // ----- Admin only -----
  if (path.startsWith("/api/admin/")) {
    if (user.role !== "admin") return json({ error: "forbidden" }, 403);
    if (path === "/api/admin/overview" && method === "GET") return respond(await adminOverview(env));
    if (path === "/api/admin/users" && method === "GET") return respond(await adminUsers(env));
    if (path === "/api/admin/feedback" && method === "GET") return respond(await adminFeedback(env, url));
    const match = path.match(/^\/api\/admin\/feedback\/(\d{1,10})$/);
    if (match && method === "PATCH") return respond(await adminUpdateFeedback(request, env, user, Number(match[1])));
    // Problems, experiments, decisions, observations (server/insights.js)
    const insights = await handleInsightsApi(request, env, url, user, {
      json, readJson, FEEDBACK_FEATURES,
      audit: (actor, action, target, detail) => env.DB.prepare(
        "INSERT INTO audit_log (actor_user_id, action, target, detail) VALUES (?1, ?2, ?3, ?4)"
      ).bind(actor, action, target || null, detail || null).run()
    });
    if (insights) return respond(insights);
    return json({ error: "not_found" }, 404);
  }

  return json({ error: "not_found" }, 404);
}

/* ---------- Google sign-in ---------- */

function authConfigured(env) {
  return Boolean(env.GOOGLE_AUTH_CLIENT_ID && env.GOOGLE_AUTH_CLIENT_SECRET);
}

async function login(request, env, url) {
  const returnTo = safeReturnPath(url.searchParams.get("return"));
  if (!authConfigured(env)) return redirect(withParam(returnTo, "signin", "not_configured"));

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await allow(env.DB, "login:" + ip, LIMITS.login))) {
    return redirect(withParam(returnTo, "signin", "too_many"));
  }

  const state = randomToken(24);
  const verifier = randomToken(48);
  const nonce = randomToken(24);
  const challenge = base64url(await sha256Bytes(verifier));

  const auth = new URL(GOOGLE_AUTH_URL);
  auth.searchParams.set("client_id", env.GOOGLE_AUTH_CLIENT_ID);
  auth.searchParams.set("redirect_uri", url.origin + "/api/auth/callback");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "openid email profile");
  auth.searchParams.set("state", state);
  auth.searchParams.set("nonce", nonce);
  auth.searchParams.set("code_challenge", challenge);
  auth.searchParams.set("code_challenge_method", "S256");
  auth.searchParams.set("prompt", "select_account");

  const res = redirect(auth.toString());
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ s: state, v: verifier, n: nonce, r: returnTo })));
  res.headers.append("Set-Cookie", cookie(OAUTH_COOKIE, payload, 600, "/api/auth"));
  return res;
}

async function callback(request, env, url) {
  const saved = decodeJsonCookie(readCookie(request, OAUTH_COOKIE));
  const returnTo = saved && saved.r ? safeReturnPath(saved.r) : "/";
  const fail = (reason) => {
    const res = redirect(withParam(returnTo, "signin", reason));
    res.headers.append("Set-Cookie", cookie(OAUTH_COOKIE, "", 0, "/api/auth"));
    return res;
  };

  if (!authConfigured(env)) return fail("not_configured");
  if (url.searchParams.get("error")) return fail("cancelled");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!saved || !code || !state || state !== saved.s) return fail("expired");

  let tokens;
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_AUTH_CLIENT_ID,
        client_secret: env.GOOGLE_AUTH_CLIENT_SECRET,
        redirect_uri: url.origin + "/api/auth/callback",
        grant_type: "authorization_code",
        code_verifier: saved.v
      })
    });
    if (!res.ok) {
      console.error("Google token exchange failed with status", res.status); // never log codes/tokens
      return fail("google_error");
    }
    tokens = await res.json();
  } catch (e) {
    console.error("Google token exchange error");
    return fail("google_error");
  }

  const claims = decodeJwtPayload(tokens && tokens.id_token);
  const now = Math.floor(Date.now() / 1000);
  if (!claims ||
      !GOOGLE_ISSUERS.includes(claims.iss) ||
      claims.aud !== env.GOOGLE_AUTH_CLIENT_ID ||
      typeof claims.exp !== "number" || claims.exp < now ||
      claims.nonce !== saved.n ||
      typeof claims.sub !== "string" || !claims.sub ||
      claims.email_verified !== true || typeof claims.email !== "string") {
    return fail("invalid_token");
  }

  // Create or update the user. `role` and `status` are deliberately NOT set here.
  const name = typeof claims.name === "string" ? claims.name.slice(0, 120) : null;
  const email = claims.email.slice(0, 254).toLowerCase();
  await env.DB.prepare(
    `INSERT INTO users (id, google_sub, email, name, last_login_at)
     VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
     ON CONFLICT(google_sub) DO UPDATE SET
       email = excluded.email, name = excluded.name, last_login_at = CURRENT_TIMESTAMP`
  ).bind(crypto.randomUUID(), claims.sub, email, name).run();
  const user = await env.DB.prepare("SELECT id, status FROM users WHERE google_sub = ?1").bind(claims.sub).first();
  if (!user || user.status !== "active") return fail("suspended");

  // Replace any session this browser already had, then start a fresh one
  const old = readCookie(request, SESSION_COOKIE);
  if (old) await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(await sha256Hex(old)).run();
  const token = randomToken(32);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)")
      .bind(await sha256Hex(token), user.id, now + SESSION_DAYS * DAY),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(now) // tidy up expired sessions
  ]);

  const res = redirect(withParam(returnTo, "signin", "ok"));
  res.headers.append("Set-Cookie", cookie(OAUTH_COOKIE, "", 0, "/api/auth"));
  res.headers.append("Set-Cookie", cookie(SESSION_COOKIE, token, SESSION_DAYS * DAY, "/"));
  return res;
}

async function logout(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(await sha256Hex(token)).run();
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0, "/"));
  return res;
}

/* ---------- Sessions ---------- */

// Returns { id, token, expiresAt, renew, user } or null. Role and status come from the database.
async function getSession(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const id = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.expires_at, u.id AS user_id, u.email, u.name, u.role, u.status, u.created_at, u.contact_ok, u.source
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?1`
  ).bind(id).first();
  const now = Math.floor(Date.now() / 1000);
  if (!row) return null;
  if (row.expires_at <= now) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(id).run();
    return null;
  }
  if (row.status !== "active") return null;

  const session = {
    id, token, expiresAt: row.expires_at, renew: false,
    user: { id: row.user_id, email: row.email, name: row.name, role: row.role, createdAt: row.created_at,
            contactOk: row.contact_ok === 1, source: row.source || null }
  };
  // Sliding expiry: extend once the session is past the halfway point
  if (row.expires_at - now < (SESSION_DAYS / 2) * DAY) {
    session.expiresAt = now + SESSION_DAYS * DAY;
    session.renew = true;
    await env.DB.prepare("UPDATE sessions SET expires_at = ?1 WHERE id = ?2").bind(session.expiresAt, id).run();
  }
  return session;
}

function withSessionCookie(session, res) {
  if (session && session.renew) {
    res.headers.append("Set-Cookie", cookie(SESSION_COOKIE, session.token, SESSION_DAYS * DAY, "/"));
  }
  return res;
}

/* ---------- Launch tracking ---------- */

// A ?from= link tag: short, lowercase, letters/digits/dashes (e.g. team, class, academic)
function validSource(value) {
  return typeof value === "string" && /^[a-z0-9-]{1,24}$/.test(value) ? value : null;
}

// Called on every signed-in page load. One row per user per day ("returned" = 2+ days),
// and the first link tag a user ever arrived with. Failures never block the page.
async function recordActiveDay(env, user, from) {
  try {
    const source = validSource(from);
    const stmts = [env.DB.prepare("INSERT OR IGNORE INTO user_days (user_id, day) VALUES (?1, date('now'))").bind(user.id)];
    if (source && !user.source) stmts.push(env.DB.prepare("UPDATE users SET source = ?1 WHERE id = ?2 AND source IS NULL").bind(source, user.id));
    await env.DB.batch(stmts);
  } catch (e) { /* tracking tables not migrated yet: ignore */ }
}

async function setContactOk(request, env, user) {
  const body = await readJson(request, 1000);
  if (!body || typeof body.ok !== "boolean") return json({ error: "bad_request" }, 400);
  await env.DB.prepare("UPDATE users SET contact_ok = ?1 WHERE id = ?2").bind(body.ok ? 1 : 0, user.id).run();
  return json({ ok: true, contactOk: body.ok });
}

// The Oct 20 goal: users / activated / returned (admins excluded), visits by link tag, time on site.
async function launchStats(env) {
  const OWN_EVENTS = `(SELECT COUNT(*) FROM saved_weeks w, json_each(w.data, '$.events') e
                        WHERE w.user_id = u.id AND json_extract(e.value, '$.source') <> 'sample')`;
  const [people, visits] = await env.DB.batch([
    env.DB.prepare(
      `SELECT COALESCE(u.source, 'direct') AS source, u.contact_ok AS contact_ok,
              ${OWN_EVENTS} AS own_events,
              (SELECT COUNT(*) FROM user_days d WHERE d.user_id = u.id) AS days
       FROM users u WHERE u.role <> 'admin' AND u.status = 'active'`),
    env.DB.prepare("SELECT visitor_id, COALESCE(source, 'direct') AS source, seconds FROM visit_days")
  ]);
  const rows = people.results || [];
  const vrows = visits.results || [];
  const bySource = {};
  const bucket = (k) => (bySource[k] = bySource[k] || { source: k, visits: 0, browsers: new Set(), users: 0, activated: 0, returned: 0 });
  rows.forEach((r) => {
    const b = bucket(r.source);
    b.users++;
    if (r.own_events >= 3) b.activated++;
    if (r.days >= 2) b.returned++;
  });
  const perBrowser = {};
  vrows.forEach((v) => {
    const b = bucket(v.source);
    b.visits++;
    b.browsers.add(v.visitor_id);
    perBrowser[v.visitor_id] = (perBrowser[v.visitor_id] || 0) + 1;
  });
  const timed = vrows.map((v) => v.seconds).filter((n) => n > 0).sort((a, b) => a - b);
  const median = timed.length ? timed[Math.floor((timed.length - 1) / 2)] : 0;
  return {
    users: rows.length,
    activated: rows.filter((r) => r.own_events >= 3).length,
    returned: rows.filter((r) => r.days >= 2).length,
    contactOk: rows.filter((r) => r.contact_ok === 1).length,
    visits: vrows.length,
    browsers: Object.keys(perBrowser).length,
    returningBrowsers: Object.values(perBrowser).filter((n) => n >= 2).length,
    medianVisitSeconds: median,
    bySource: Object.values(bySource)
      .map((b) => ({ source: b.source, visits: b.visits, browsers: b.browsers.size, users: b.users, activated: b.activated, returned: b.returned }))
      .sort((a, b) => b.users - a.users || b.visits - a.visits)
  };
}

function publicUser(user) {
  return { name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, contactOk: user.contactOk === true };
}

/* ---------- Saved weeks ---------- */

function validWeekStart(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + "T00:00:00Z");
  return isNaN(d) ? null : value;
}

async function getWeek(env, user, url) {
  const start = validWeekStart(url.searchParams.get("start"));
  if (!start) return json({ error: "bad_week" }, 400);
  const row = await env.DB.prepare(
    "SELECT data, updated_at FROM saved_weeks WHERE user_id = ?1 AND week_start = ?2"
  ).bind(user.id, start).first();
  if (!row) return json({ weekStart: start, events: null });
  let events = null;
  try { events = JSON.parse(row.data).events; } catch (e) { events = null; }
  return json({ weekStart: start, events, updatedAt: row.updated_at });
}

async function putWeek(request, env, user) {
  if (!(await allow(env.DB, "week:" + user.id, LIMITS.weekSave))) return json({ error: "too_many" }, 429);
  const body = await readJson(request, 100000);
  const start = body && validWeekStart(body.weekStart);
  if (!start || !Array.isArray(body.events)) return json({ error: "bad_request" }, 400);
  if (body.events.length > MAX_EVENTS_PER_WEEK) return json({ error: "too_many_events" }, 400);

  const events = [];
  for (const raw of body.events) {
    const ev = cleanEvent(raw);
    if (!ev) return json({ error: "bad_event" }, 400);
    events.push(ev);
  }
  const data = JSON.stringify({ v: 1, events });
  await env.DB.prepare(
    `INSERT INTO saved_weeks (user_id, week_start, data) VALUES (?1, ?2, ?3)
     ON CONFLICT(user_id, week_start) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`
  ).bind(user.id, start, data).run();
  return json({ ok: true, saved: events.length });
}

function isInt(v, min, max) {
  return Number.isInteger(v) && v >= min && v <= max;
}

// Accepts only the known fields, with the known types and ranges. Anything else is dropped.
function cleanEvent(e) {
  if (!e || typeof e !== "object") return null;
  if (typeof e.title !== "string" || !e.title.trim() || e.title.length > 80) return null;
  if (!isInt(e.dayIndex, 0, 6) || !isInt(e.startMinutes, 0, 1439)) return null;
  if (e.endMinutes !== null && e.endMinutes !== undefined && !isInt(e.endMinutes, 0, 1439)) return null;
  if (!EVENT_CATEGORIES.includes(e.category) || !EVENT_SOURCES.includes(e.source)) return null;
  let reality = null;
  if (e.reality) {
    const r = e.reality;
    if (!REALITY_STATUSES.includes(r.status)) return null;
    if (r.status === "over" ? !isInt(r.detail, 0, 600) : !REALITY_REASONS.includes(r.detail || "")) return null;
    // "Swapped" was merged into "Skipped"; older pages may still send it
    reality = { status: r.status === "swapped" ? "skipped" : r.status, detail: r.status === "over" ? r.detail : (r.detail || "") };
  }
  return {
    title: e.title.trim(),
    dayIndex: e.dayIndex,
    startMinutes: e.startMinutes,
    endMinutes: e.endMinutes == null ? null : e.endMinutes,
    allDay: e.allDay === true,
    category: e.category,
    source: e.source,
    reality
  };
}

async function listWeeks(env, user) {
  const rows = await env.DB.prepare(
    `SELECT week_start, json_array_length(data, '$.events') AS events, updated_at
     FROM saved_weeks WHERE user_id = ?1 ORDER BY week_start DESC LIMIT 52`
  ).bind(user.id).all();
  return json({ weeks: rows.results || [] });
}

/* ---------- Feedback ---------- */

async function submitFeedback(request, env, user) {
  if (!(await allow(env.DB, "feedback:" + user.id, LIMITS.feedback))) return json({ error: "too_many" }, 429);
  const body = await readJson(request, 10000);
  if (!body) return json({ error: "bad_request" }, 400);

  const category = body.category;
  const feature = body.feature;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const page = typeof body.page === "string" && /^\/[A-Za-z0-9._\-\/]{0,80}$/.test(body.page) ? body.page : "/";
  const rating = body.rating === null || body.rating === undefined || body.rating === "" ? null : body.rating;

  if (!FEEDBACK_CATEGORIES.includes(category)) return json({ error: "bad_category" }, 400);
  if (!FEEDBACK_FEATURES.includes(feature)) return json({ error: "bad_feature" }, 400);
  if (!message) return json({ error: "empty_message" }, 400);
  if (message.length > 2000) return json({ error: "message_too_long" }, 400);
  if (rating !== null && !isInt(rating, 1, 5)) return json({ error: "bad_rating" }, 400);

  const row = await env.DB.prepare(
    `INSERT INTO feedback (user_id, category, feature, page, rating, message)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id`
  ).bind(user.id, category, feature, page, rating, message).first();
  return json({ ok: true, id: row ? row.id : null });
}

async function myFeedback(env, user) {
  // Deliberately excludes admin_notes
  const rows = await env.DB.prepare(
    `SELECT id, category, feature, rating, message, status, created_at
     FROM feedback WHERE user_id = ?1 ORDER BY id DESC LIMIT 100`
  ).bind(user.id).all();
  return json({ feedback: rows.results || [] });
}

/* ---------- Deleting your own account ---------- */

async function deleteAccount(request, env, user) {
  if (!(await allow(env.DB, "account:" + user.id, LIMITS.account))) return json({ error: "too_many" }, 429);
  const body = await readJson(request, 1000);
  if (!body || body.confirm !== "DELETE") return json({ error: "confirm_required" }, 400);
  if (user.role === "admin") {
    const admins = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first();
    if (!admins || admins.n <= 1) return json({ error: "last_admin" }, 400);
  }
  // Sessions and saved weeks are removed by ON DELETE CASCADE; feedback is kept but unlinked.
  await env.DB.batch([
    env.DB.prepare("INSERT INTO audit_log (actor_user_id, action, target) VALUES (?1, 'account.delete', ?1)").bind(user.id),
    env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(user.id)
  ]);
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0, "/"));
  return res;
}

/* ---------- Admin ---------- */

async function adminOverview(env) {
  const [users, newUsers, active, byStatus, byCategory, byFeature, signups, visitors, tried, events, nonReal] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM users"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now', '-7 days')"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE last_login_at >= datetime('now', '-7 days')"),
    // Headline feedback numbers count REAL tester feedback only (not observations, test, or automated items)
    env.DB.prepare("SELECT status AS k, COUNT(*) AS n FROM feedback WHERE source = 'real' GROUP BY status"),
    env.DB.prepare("SELECT category AS k, COUNT(*) AS n FROM feedback WHERE source = 'real' GROUP BY category"),
    env.DB.prepare(
      `SELECT feature AS k, COUNT(*) AS n,
              SUM(CASE WHEN category IN ('confusing', 'broken') THEN 1 ELSE 0 END) AS problems
       FROM feedback WHERE source = 'real' GROUP BY feature ORDER BY n DESC`),
    env.DB.prepare("SELECT COUNT(*) AS n FROM signups"),
    env.DB.prepare("SELECT COUNT(DISTINCT visitor_id) AS n FROM events"),
    env.DB.prepare("SELECT COUNT(DISTINCT visitor_id) AS n FROM events WHERE event NOT IN ('visit', 'waitlist_joined')"),
    env.DB.prepare("SELECT event AS k, COUNT(*) AS n FROM events GROUP BY event"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE source <> 'real'")
  ]);
  const first = (r) => ((r.results || [])[0] || {}).n || 0;
  const map = (r) => Object.fromEntries((r.results || []).map((row) => [row.k, row.n]));
  let launch = null;
  try { launch = await launchStats(env); } catch (e) { launch = { notReady: true }; } // migration 0003 not run yet
  return json({
    launch,
    users: { total: first(users), newThisWeek: first(newUsers), activeThisWeek: first(active) },
    feedback: {
      byStatus: map(byStatus),
      byCategory: map(byCategory),
      byFeature: (byFeature.results || []).map((r) => ({ feature: r.k, total: r.n, problems: r.problems || 0 })),
      nonRealItems: first(nonReal)
    },
    earlyAccess: { responses: first(signups), visitors: first(visitors), triedDemo: first(tried), features: map(events) }
  });
}

async function adminUsers(env) {
  const rows = await env.DB.prepare(
    `SELECT u.name, u.email, u.role, u.status, u.created_at, u.last_login_at,
            (SELECT COUNT(*) FROM saved_weeks w WHERE w.user_id = u.id) AS weeks_saved,
            (SELECT COUNT(*) FROM feedback f WHERE f.user_id = u.id) AS feedback_sent
     FROM users u ORDER BY u.created_at DESC LIMIT 500`
  ).all();
  const users = rows.results || [];
  // Launch columns (need migration 0003); the list still works without them
  try {
    const extra = await env.DB.prepare(
      `SELECT u.email, u.source, u.contact_ok,
              (SELECT COUNT(*) FROM user_days d WHERE d.user_id = u.id) AS days_active,
              (SELECT COUNT(*) FROM saved_weeks w, json_each(w.data, '$.events') e
                 WHERE w.user_id = u.id AND json_extract(e.value, '$.source') <> 'sample') AS own_events
       FROM users u`
    ).all();
    const byEmail = Object.fromEntries((extra.results || []).map((r) => [r.email, r]));
    users.forEach((u) => {
      const x = byEmail[u.email] || {};
      u.source = x.source || null;
      u.contact_ok = x.contact_ok === 1;
      u.days_active = x.days_active || 0;
      u.own_events = x.own_events || 0;
    });
  } catch (e) { /* migration 0003 not run yet */ }
  return json({ users });
}

// Feedback for the admin inbox. Testers appear only as anonymous account codes (e.g. "T-3fa91"):
// analysis needs what happened, not who said it. Codes identify an account, not a verified person.
async function adminFeedback(env, url) {
  const where = [];
  const args = [];
  const filters = { status: FEEDBACK_STATUSES, category: FEEDBACK_CATEGORIES, feature: FEEDBACK_FEATURES, source: FEEDBACK_SOURCES };
  for (const [name, allowed] of Object.entries(filters)) {
    const value = url.searchParams.get(name);
    if (!value) continue;
    if (!allowed.includes(value)) return json({ error: "bad_filter" }, 400);
    args.push(value);
    where.push("f." + name + " = ?" + args.length); // column names come from the fixed list above
  }
  const problem = url.searchParams.get("problem");
  if (problem === "none") where.push("f.problem_id IS NULL");
  else if (problem) {
    if (!/^\d{1,10}$/.test(problem)) return json({ error: "bad_filter" }, 400);
    args.push(Number(problem));
    where.push("f.problem_id = ?" + args.length);
  }
  const rows = await env.DB.prepare(
    `SELECT f.id, f.user_id, f.category, f.feature, f.page, f.rating, f.message, f.status, f.admin_notes,
            f.source, f.problem_id, f.journey_stage, f.user_type, f.created_at, f.updated_at
     FROM feedback f
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY f.id DESC LIMIT 500`
  ).bind(...args).all();
  const codes = {};
  const feedback = [];
  for (const row of rows.results || []) {
    const { user_id: uid, ...rest } = row;
    if (uid && !codes[uid]) codes[uid] = "T-" + (await sha256Hex("tester:" + uid)).slice(0, 5);
    rest.tester = row.source === "observation" ? "Observation" : uid ? codes[uid] : "Deleted account";
    feedback.push(rest);
  }
  return json({ feedback });
}

async function adminUpdateFeedback(request, env, admin, id) {
  const body = await readJson(request, 5000);
  if (!body) return json({ error: "bad_request" }, 400);
  const sets = [];
  const args = [];
  if (body.status !== undefined) {
    if (!FEEDBACK_STATUSES.includes(body.status)) return json({ error: "bad_status" }, 400);
    args.push(body.status); sets.push("status = ?" + args.length);
  }
  if (body.adminNotes !== undefined) {
    if (body.adminNotes !== null && (typeof body.adminNotes !== "string" || body.adminNotes.length > 2000)) {
      return json({ error: "bad_notes" }, 400);
    }
    args.push(body.adminNotes ? body.adminNotes.trim() : null); sets.push("admin_notes = ?" + args.length);
  }
  if (body.source !== undefined) {
    if (!FEEDBACK_SOURCES.includes(body.source)) return json({ error: "bad_source" }, 400);
    args.push(body.source); sets.push("source = ?" + args.length);
  }
  if (body.journeyStage !== undefined) {
    if (body.journeyStage !== null && !JOURNEY_STAGES.includes(body.journeyStage)) return json({ error: "bad_stage" }, 400);
    args.push(body.journeyStage); sets.push("journey_stage = ?" + args.length);
  }
  if (body.userType !== undefined) {
    if (body.userType !== null && (typeof body.userType !== "string" || body.userType.length > 60)) return json({ error: "bad_user_type" }, 400);
    args.push(body.userType ? body.userType.trim() || null : null); sets.push("user_type = ?" + args.length);
  }
  if (body.problemId !== undefined) {
    let pid = null;
    if (body.problemId !== null && body.problemId !== "") {
      pid = Number(body.problemId);
      const exists = Number.isInteger(pid) && pid > 0 && await env.DB.prepare("SELECT id FROM problems WHERE id = ?1").bind(pid).first();
      if (!exists) return json({ error: "bad_problem" }, 400);
    }
    args.push(pid); sets.push("problem_id = ?" + args.length);
  }
  if (!sets.length) return json({ error: "nothing_to_update" }, 400);
  args.push(id);
  const updated = await env.DB.prepare(
    `UPDATE feedback SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?${args.length} RETURNING id`
  ).bind(...args).first();
  if (!updated) return json({ error: "not_found" }, 404);
  await env.DB.prepare("INSERT INTO audit_log (actor_user_id, action, target, detail) VALUES (?1, 'feedback.update', ?2, ?3)")
    .bind(admin.id, String(id), Object.keys(body).filter((k) => ["status", "adminNotes", "source", "problemId", "journeyStage", "userType"].includes(k)).join(",")).run();
  return json({ ok: true });
}

/* ---------- Rate limiting (fixed window, stored in D1) ---------- */

async function allow(db, key, [max, windowSeconds]) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const row = await db.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`
  ).bind(key, windowStart).first();
  return !row || row.count <= max;
}

/* ---------- Small helpers ---------- */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}

function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  if (origin) return origin === url.origin;
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  return fetchSite === "same-origin";
}

// Only allow returning to a path on this site (no "//evil.com" or "https://…")
function safeReturnPath(value) {
  if (typeof value !== "string" || !/^\/(?!\/)[A-Za-z0-9._\-\/]*(#[A-Za-z0-9_-]*)?$/.test(value) || value.length > 100) return "/";
  return value;
}

function withParam(path, key, value) {
  const hashIndex = path.indexOf("#");
  const base = hashIndex === -1 ? path : path.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : path.slice(hashIndex);
  return base + (base.includes("?") ? "&" : "?") + key + "=" + encodeURIComponent(value) + hash;
}

function cookie(name, value, maxAge, path) {
  return name + "=" + value + "; Max-Age=" + maxAge + "; Path=" + path + "; HttpOnly; Secure; SameSite=Lax";
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i !== -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

async function readJson(request, maxBytes) {
  try {
    const text = await request.text();
    if (!text || text.length > maxBytes) return null;
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch (e) {
    return null;
  }
}

function randomToken(bytes) {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function base64url(bytes) {
  let binary = "";
  new Uint8Array(bytes).forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function sha256Bytes(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

async function sha256Hex(text) {
  return Array.from(await sha256Bytes(text), (b) => b.toString(16).padStart(2, "0")).join("");
}

function decodeJsonCookie(value) {
  if (!value || value.length > 2000) return null;
  try { return JSON.parse(new TextDecoder().decode(fromBase64url(value))); } catch (e) { return null; }
}

function decodeJwtPayload(jwt) {
  if (typeof jwt !== "string") return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try { return JSON.parse(new TextDecoder().decode(fromBase64url(parts[1]))); } catch (e) { return null; }
}
