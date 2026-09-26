/* ==========================================================================
   TimeWise — Cloudflare Worker
   Serves the static site (via the ASSETS binding) and adds a tiny API for the
   real, read-only Notion connection. Notion's API can't be called from a
   browser (no CORS) and its OAuth flow needs a client secret, so those two
   steps have to happen here on the server.

   Routes (everything else is served as a normal static file):
     GET  /api/notion/status      → { configured, connected, workspace }
     GET  /api/notion/login       → redirects to Notion's "pick pages to share" screen
     GET  /api/notion/callback    → Notion sends the visitor back here; we swap the
                                    code for an access token and store it in a
                                    secure, HttpOnly cookie in *their* browser
     GET  /api/notion/events?start=YYYY-MM-DD&end=YYYY-MM-DD
                                  → dated items from the databases they shared
     POST /api/notion/disconnect  → forgets the cookie

     POST /api/waitlist           → saves an early-access sign-up + survey answers
     POST /api/track              → counts (anonymously) which demo features a visitor tried
     GET  /api/waitlist/results   → everything above, for results.html (needs ADMIN_KEY)

   Secrets (set once with `npx wrangler secret put NAME`, never committed):
     NOTION_CLIENT_ID, NOTION_CLIENT_SECRET   — Notion connection
     ADMIN_KEY                                — password for results.html
   Bindings (in wrangler.json):
     DB — a Cloudflare D1 database for sign-ups and feature counts. Tables are
          created automatically the first time they're used.

   For Notion, nothing is stored on the server: the visitor's token lives only
   in their own browser's cookie, and events are passed straight through.
   ========================================================================== */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const SESSION_COOKIE = "tw_notion";
const STATE_COOKIE = "tw_notion_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const MAX_DATABASES = 10; // keeps us well under Workers' subrequest limit
const MAX_ITEMS_PER_DATABASE = 100;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        console.error(err);
        return json({ error: "server_error" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env, url) {
  const route = request.method + " " + url.pathname;
  const configured = Boolean(env.NOTION_CLIENT_ID && env.NOTION_CLIENT_SECRET);

  switch (route) {
    case "GET /api/notion/status": {
      const session = readSession(request);
      return json({ configured, connected: Boolean(session), workspace: session ? session.w : null });
    }

    case "GET /api/notion/login": {
      const popup = url.searchParams.get("popup") === "1";
      if (!configured) return backToSite(url, "error", "not_configured", false, popup);
      const state = crypto.randomUUID();
      const authorize = new URL(NOTION_API + "/oauth/authorize");
      authorize.searchParams.set("client_id", env.NOTION_CLIENT_ID);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("owner", "user");
      authorize.searchParams.set("redirect_uri", redirectUri(url));
      authorize.searchParams.set("state", state);
      const res = redirect(authorize.toString());
      // ".p" remembers that sign-in happened in a pop-up window
      res.headers.append("Set-Cookie", cookie(STATE_COOKIE, state + (popup ? ".p" : ""), 600));
      return res;
    }

    case "GET /api/notion/callback": {
      const savedState = readCookie(request, STATE_COOKIE) || "";
      const popup = savedState.endsWith(".p");
      if (!configured) return backToSite(url, "error", "not_configured", true, popup);
      if (url.searchParams.get("error")) return backToSite(url, "error", "denied", true, popup);

      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      if (!state || !code || state !== savedState.replace(/\.p$/, "")) {
        return backToSite(url, "error", "state", true, popup);
      }

      const tokenRes = await fetch(NOTION_API + "/oauth/token", {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(env.NOTION_CLIENT_ID + ":" + env.NOTION_CLIENT_SECRET),
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION
        },
        body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri(url) })
      });
      if (!tokenRes.ok) {
        console.error("Notion token exchange failed", tokenRes.status, await tokenRes.text());
        return backToSite(url, "error", "token", true, popup);
      }
      const token = await tokenRes.json();
      const session = encodeSession({ t: token.access_token, w: token.workspace_name || "" });

      const res = backToSite(url, "connected", null, true, popup);
      res.headers.append("Set-Cookie", cookie(SESSION_COOKIE, session, SESSION_MAX_AGE));
      return res;
    }

    case "GET /api/notion/events": {
      const session = readSession(request);
      if (!session) return json({ error: "not_connected" }, 401);

      const start = url.searchParams.get("start") || "";
      const end = url.searchParams.get("end") || "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return json({ error: "bad_range" }, 400);
      }

      const search = await notion(session.t, "/search", {
        filter: { property: "object", value: "database" },
        page_size: 25
      });
      if (search.status === 401) return notConnected();
      if (!search.ok) return json({ error: "notion_error", status: search.status }, 502);

      // Only databases with a Date property can say *when* something happens
      const databases = (search.data.results || [])
        .map((db) => {
          const props = Object.entries(db.properties || {});
          const dateProp = props.find(([, p]) => p.type === "date");
          return dateProp ? { id: db.id, name: plainText(db.title) || "Untitled database", dateProp: dateProp[0] } : null;
        })
        .filter(Boolean)
        .slice(0, MAX_DATABASES);

      const results = await Promise.all(databases.map(async (db) => {
        const query = await notion(session.t, "/databases/" + db.id + "/query", {
          filter: {
            and: [
              { property: db.dateProp, date: { on_or_after: start } },
              { property: db.dateProp, date: { on_or_before: end } }
            ]
          },
          page_size: MAX_ITEMS_PER_DATABASE
        });
        if (!query.ok) return [];
        return (query.data.results || []).map((page) => {
          const props = page.properties || {};
          const titleProp = Object.values(props).find((p) => p.type === "title");
          const date = props[db.dateProp] && props[db.dateProp].date;
          if (!date || !date.start) return null;
          return {
            title: (titleProp && plainText(titleProp.title)) || "Untitled",
            start: date.start,
            end: date.end || null,
            database: db.name
          };
        }).filter(Boolean);
      }));

      return json({
        workspace: session.w,
        databases: databases.length,
        events: results.flat()
      });
    }

    case "POST /api/notion/disconnect": {
      const res = json({ ok: true });
      res.headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
      return res;
    }

    case "POST /api/waitlist": {
      if (!env.DB) return json({ error: "not_configured" }, 503);
      const body = await readJson(request);
      if (!body) return json({ error: "bad_request" }, 400);
      if (body.website) return json({ ok: true, responses: 0 }); // honeypot: bots fill hidden fields

      const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "bad_email" }, 400);
      const answers = {};
      for (const [question, options] of Object.entries(SURVEY)) {
        const value = String(body[question] || "");
        answers[question] = options.includes(value) ? value : null;
      }
      if (!email && !answers.planning && !answers.struggle && !answers.weekly) {
        return json({ error: "empty" }, 400);
      }
      const visitor = validVisitor(body.visitorId) || crypto.randomUUID();

      await ensureTables(env.DB);
      await env.DB.prepare(
        `INSERT INTO signups (visitor_id, email, planning, struggle, weekly)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(visitor_id) DO UPDATE SET
           email = COALESCE(excluded.email, signups.email),
           planning = excluded.planning, struggle = excluded.struggle, weekly = excluded.weekly,
           updated_at = CURRENT_TIMESTAMP`
      ).bind(visitor, email || null, answers.planning, answers.struggle, answers.weekly).run();
      await recordEvent(env.DB, visitor, "waitlist_joined");

      const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM signups").first();
      return json({ ok: true, responses: total ? total.n : 1 });
    }

    case "POST /api/track": {
      if (!env.DB) return new Response(null, { status: 204 });
      const body = await readJson(request);
      const visitor = body && validVisitor(body.visitorId);
      if (!visitor || !TRACKED_EVENTS.includes(body.event)) return json({ error: "bad_request" }, 400);
      await ensureTables(env.DB);
      await recordEvent(env.DB, visitor, body.event);
      return new Response(null, { status: 204 });
    }

    case "GET /api/waitlist/results": {
      if (!env.ADMIN_KEY) return json({ error: "no_admin_key" }, 503);
      if (!env.DB) return json({ error: "not_configured" }, 503);
      const given = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!(await sameSecret(given, env.ADMIN_KEY))) return json({ error: "unauthorized" }, 401);

      await ensureTables(env.DB);
      const [signups, events, visitors, triedAny, triedAndSigned] = await env.DB.batch([
        env.DB.prepare("SELECT email, planning, struggle, weekly, created_at, updated_at FROM signups ORDER BY created_at DESC LIMIT 2000"),
        env.DB.prepare("SELECT event, COUNT(*) AS visitors FROM events GROUP BY event"),
        env.DB.prepare("SELECT COUNT(DISTINCT visitor_id) AS n FROM events"),
        env.DB.prepare("SELECT COUNT(DISTINCT visitor_id) AS n FROM events WHERE event NOT IN ('visit', 'waitlist_joined')"),
        env.DB.prepare(
          `SELECT COUNT(*) AS n FROM signups s WHERE EXISTS (
             SELECT 1 FROM events e WHERE e.visitor_id = s.visitor_id
             AND e.event NOT IN ('visit', 'waitlist_joined'))`
        )
      ]);
      const counts = {};
      (events.results || []).forEach((row) => { counts[row.event] = row.visitors; });
      return json({
        survey: SURVEY,
        signups: signups.results || [],
        events: counts,
        visitors: (visitors.results[0] || {}).n || 0,
        visitorsWhoTriedDemo: (triedAny.results[0] || {}).n || 0,
        signupsWhoTriedDemo: (triedAndSigned.results[0] || {}).n || 0
      });
    }

    default:
      return json({ error: "not_found" }, 404);
  }
}

/* ---------- Early access + feature counts ---------- */

// Allowed survey answers — must match the options in index.html's #earlyAccessForm
const SURVEY = {
  planning: ["Paper planner", "Google or Apple Calendar", "Notion or a to-do app", "In my head", "Something else"],
  struggle: ["Deadlines piling up", "Procrastinating", "Balancing school, work & life", "Plans falling apart mid-day", "Knowing what to do first"],
  weekly: ["Definitely", "Probably", "Not sure", "Probably not"]
};

// Demo features script.js reports (each counted at most once per visitor)
const TRACKED_EVENTS = [
  "visit", "event_added", "calendar_google", "calendar_notion", "calendar_ics",
  "replan_used", "replan_applied", "reflection_viewed", "reflection_step_added",
  "quiz_completed", "waitlist_joined"
];

let tablesReady = false;
async function ensureTables(db) {
  if (tablesReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS signups (
      visitor_id TEXT PRIMARY KEY,
      email TEXT,
      planning TEXT,
      struggle TEXT,
      weekly TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS events (
      visitor_id TEXT NOT NULL,
      event TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (visitor_id, event)
    )`)
  ]);
  tablesReady = true;
}

function recordEvent(db, visitor, event) {
  return db.prepare("INSERT OR IGNORE INTO events (visitor_id, event) VALUES (?1, ?2)").bind(visitor, event).run();
}

function validVisitor(value) {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;
}

async function readJson(request) {
  try {
    const text = await request.text();
    if (text.length > 4000) return null;
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

// Compares two secrets without leaking how many characters matched
async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b))
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0 && a.length > 0;
}

/* ---------- Helpers ---------- */

async function notion(token, path, body) {
  const res = await fetch(NOTION_API + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    },
    body: JSON.stringify(body)
  });
  const data = res.ok ? await res.json() : null;
  return { ok: res.ok, status: res.status, data };
}

function plainText(richText) {
  return (richText || []).map((t) => t.plain_text || "").join("").trim();
}

function redirectUri(url) {
  return url.origin + "/api/notion/callback";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}

// Finishes sign-in. In a pop-up, a tiny page tells the TimeWise tab the result and
// closes itself (so events already on the grid are kept). Otherwise the visitor
// is redirected back to the Calendars section with a status flag the page reads.
function backToSite(url, result, reason, clearState, popup) {
  const target = new URL("/", url.origin);
  target.searchParams.set("notion", result);
  if (reason) target.searchParams.set("reason", reason);
  target.hash = "calendars";

  let res;
  if (popup) {
    const message = JSON.stringify({ type: "timewise-notion", result, reason: reason || null });
    res = new Response(
      "<!doctype html><meta charset=\"utf-8\"><title>TimeWise</title>" +
      "<p style=\"font-family:system-ui;padding:24px\">Finishing up… you can close this window.</p>" +
      "<script>if (window.opener) { window.opener.postMessage(" + message + ", location.origin); window.close(); }" +
      " else { location.replace(" + JSON.stringify(target.toString()) + "); }</script>",
      { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );
  } else {
    res = redirect(target.toString());
  }
  if (clearState) res.headers.append("Set-Cookie", cookie(STATE_COOKIE, "", 0));
  return res;
}

function notConnected() {
  const res = json({ error: "not_connected" }, 401);
  res.headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
  return res;
}

function cookie(name, value, maxAge) {
  return name + "=" + value + "; Max-Age=" + maxAge + "; Path=/api/notion; HttpOnly; Secure; SameSite=Lax";
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i !== -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function encodeSession(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function readSession(request) {
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const session = JSON.parse(new TextDecoder().decode(bytes));
    return session && session.t ? session : null;
  } catch (e) {
    return null;
  }
}
