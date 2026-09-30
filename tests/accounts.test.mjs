// Test-only. Runs worker.js + server/accounts.js against an in-memory SQLite stand-in for D1,
// with a fake Google that behaves like the real OAuth flow (PKCE, state, nonce).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import crypto from 'node:crypto';
import worker from '../worker.js';

// ---- D1 stand-in with foreign keys ON (as in real D1) + the migration applied ----
function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(fs.readFileSync(new URL('../migrations/0001_accounts.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    first: async () => db.prepare(sql).get(...args) ?? null,
    _batch: () => ({ results: /^\s*(SELECT|WITH)|RETURNING/i.test(sql) ? db.prepare(sql).all(...args) : (db.prepare(sql).run(...args), []) })
  });
  return { raw: db, prepare: (sql) => stmt(sql), batch: async (list) => { db.exec('BEGIN'); try { const r = list.map((s) => s._batch()); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
}

const ORIGIN = 'https://timewise.example.workers.dev';
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const env = { DB: makeD1(), GOOGLE_AUTH_CLIENT_ID: CLIENT_ID, GOOGLE_AUTH_CLIENT_SECRET: 'dummy-test-value', ASSETS: { fetch: () => new Response('asset') } };
const sql = (q, ...a) => env.DB.raw.prepare(q).all(...a);

// ---- Fake Google ----
const issuedCodes = new Map();
let tamper = {};
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
globalThis.fetch = async (url, init) => {
  if (String(url) === 'https://oauth2.googleapis.com/token') {
    const p = new URLSearchParams(init.body);
    const c = issuedCodes.get(p.get('code'));
    const challenge = crypto.createHash('sha256').update(p.get('code_verifier') || '').digest('base64url');
    if (!c || p.get('client_secret') !== 'dummy-test-value' || p.get('client_id') !== CLIENT_ID ||
        challenge !== c.challenge || p.get('redirect_uri') !== ORIGIN + '/api/auth/callback') {
      return new Response('{"error":"invalid_grant"}', { status: 400 });
    }
    issuedCodes.delete(p.get('code'));
    const claims = { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: c.sub, email: c.email, email_verified: true,
      name: c.name, nonce: c.nonce, exp: Math.floor(Date.now() / 1000) + 3600, ...tamper };
    return Response.json({ access_token: 'x', id_token: b64u({ alg: 'RS256' }) + '.' + b64u(claims) + '.sig' });
  }
  throw new Error('unexpected fetch ' + url);
};

// ---- HTTP helpers ----
async function call(path, { method = 'GET', cookie = '', body, origin = ORIGIN, ip = '1.1.1.1' } = {}) {
  const headers = { 'CF-Connecting-IP': ip };
  if (cookie) headers.Cookie = cookie;
  if (origin && method !== 'GET') headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env);
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch (e) {}
  return { status: res.status, data, location: res.headers.get('Location'), cookies: res.headers.getSetCookie() };
}
const cookieVal = (cookies, name) => { const c = cookies.find((x) => x.startsWith(name + '=')); return c ? c.split(';')[0] : null; };

async function signIn(sub, email, name, opts = {}) {
  const login = await call('/api/auth/login?return=/try.html%23calendars', { ip: opts.ip });
  const auth = new URL(login.location);
  const oauthCookie = cookieVal(login.cookies, 'tw_oauth');
  const code = 'code-' + crypto.randomUUID();
  issuedCodes.set(code, { sub, email, name, nonce: auth.searchParams.get('nonce'), challenge: auth.searchParams.get('code_challenge') });
  const state = opts.badState ? 'wrong' : auth.searchParams.get('state');
  const cb = await call(`/api/auth/callback?code=${code}&state=${state}`, { cookie: oauthCookie });
  return { login, auth, cb, session: cookieVal(cb.cookies, 'tw_session') };
}

// ---- Tiny test runner ----
let pass = 0, fail = 0; const failures = [];
function check(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } console.log((cond ? '  ✓ ' : '  ✗ ') + name); }
const section = (t) => console.log('\n' + t);

// =================== AUTHENTICATION ===================
section('Authentication');
let r = await call('/api/auth/me');
check('Visitor: /api/auth/me says signed out', r.status === 200 && r.data.signedIn === false && r.data.configured === true);

const A = await signIn('google-sub-A', 'User.A@Example.com', 'User A');
check('Login redirects to Google auth endpoint', A.login.status === 302 && A.auth.origin + A.auth.pathname === 'https://accounts.google.com/o/oauth2/v2/auth');
check('Requests only openid email profile', A.auth.searchParams.get('scope') === 'openid email profile');
check('Uses PKCE S256 + state + nonce', A.auth.searchParams.get('code_challenge_method') === 'S256' && A.auth.searchParams.get('state') && A.auth.searchParams.get('nonce'));
check('Redirect URI is this site\'s callback', A.auth.searchParams.get('redirect_uri') === ORIGIN + '/api/auth/callback');
check('Callback signs in and returns to the requested page', A.cb.status === 302 && A.cb.location === '/try.html?signin=ok#calendars', A.cb.location);
const sc = A.cb.cookies.find((c) => c.startsWith('tw_session='));
check('Session cookie is HttpOnly; Secure; SameSite=Lax; 30 days', /HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Lax/.test(sc) && /Max-Age=2592000/.test(sc));
check('Database stores a hash, not the raw token', sql('SELECT id FROM sessions')[0].id !== A.session.split('=')[1] && /^[0-9a-f]{64}$/.test(sql('SELECT id FROM sessions')[0].id));
r = await call('/api/auth/me', { cookie: A.session });
check('User A: /me shows signed in as user', r.data.signedIn && r.data.user.role === 'user' && r.data.user.email === 'user.a@example.com');

const badState = await signIn('google-sub-X', 'x@example.com', 'X', { badState: true });
check('Wrong state is rejected', badState.cb.location.includes('signin=expired') && !badState.session);
tamper = { nonce: 'attacker' };
check('Wrong nonce is rejected', (await signIn('google-sub-X', 'x@example.com', 'X')).cb.location.includes('signin=invalid_token'));
tamper = { aud: 'someone-elses-client' };
check('ID token for another app (aud) is rejected', (await signIn('google-sub-X', 'x@example.com', 'X')).cb.location.includes('signin=invalid_token'));
tamper = { email_verified: false };
check('Unverified Google email is rejected', (await signIn('google-sub-X', 'x@example.com', 'X')).cb.location.includes('signin=invalid_token'));
tamper = { exp: 1 };
check('Expired ID token is rejected', (await signIn('google-sub-X', 'x@example.com', 'X')).cb.location.includes('signin=invalid_token'));
tamper = {};
check('No user was created by the rejected attempts', sql("SELECT COUNT(*) n FROM users WHERE google_sub = 'google-sub-X'")[0].n === 0);

r = await call('/api/auth/callback?code=code-replayed&state=abc');
check('Callback without the sign-in cookie is rejected', r.location.includes('signin=expired'));

r = await call('/api/auth/login?return=//evil.example.com');
check('Open redirect blocked (//evil)', !(await (async () => { const c = cookieVal(r.cookies, 'tw_oauth'); const p = JSON.parse(Buffer.from(c.split('=')[1], 'base64url')); return p.r !== '/'; })()));
r = await call('/api/auth/login?return=https://evil.example.com');
check('Open redirect blocked (https://evil)', JSON.parse(Buffer.from(cookieVal(r.cookies, 'tw_oauth').split('=')[1], 'base64url')).r === '/');

const B = await signIn('google-sub-B', 'userb@example.com', 'User B');
const ADMIN = await signIn('google-sub-ADMIN', 'owner@example.com', 'Owner');
check('Sign-in never grants admin (all new users are role=user)', sql("SELECT COUNT(*) n FROM users WHERE role='admin'")[0].n === 0);

// Logout + old session
const A2 = await signIn('google-sub-A', 'user.a@example.com', 'User A');
check('Signing in again reuses the same account', sql("SELECT COUNT(*) n FROM users WHERE google_sub='google-sub-A'")[0].n === 1);
r = await call('/api/auth/logout', { method: 'POST', cookie: A2.session });
check('Logout succeeds and clears the cookie', r.status === 200 && r.cookies.some((c) => c.startsWith('tw_session=;') && /Max-Age=0/.test(c)));
r = await call('/api/me/weeks', { cookie: A2.session });
check('Logged-out session can no longer access private data', r.status === 401);
r = await call('/api/me/weeks', { cookie: A.session });
check('Other sessions for the same user keep working', r.status === 200);

// Expired session
const E = await signIn('google-sub-E', 'e@example.com', 'Expiring');
env.DB.raw.prepare("UPDATE sessions SET expires_at = 1 WHERE user_id = (SELECT id FROM users WHERE google_sub='google-sub-E')").run();
r = await call('/api/auth/me', { cookie: E.session });
check('Expired session is rejected', r.data.signedIn === false);
check('Expired session row is deleted', sql("SELECT COUNT(*) n FROM sessions WHERE expires_at = 1")[0].n === 0);

// Sliding renewal
const Rn = await signIn('google-sub-R', 'r@example.com', 'Renew');
env.DB.raw.prepare("UPDATE sessions SET expires_at = ? WHERE user_id = (SELECT id FROM users WHERE google_sub='google-sub-R')").run(Math.floor(Date.now() / 1000) + 5 * 86400);
r = await call('/api/auth/me', { cookie: Rn.session });
check('Session in its last half is renewed', r.data.signedIn && r.cookies.some((c) => c.startsWith('tw_session=') && /Max-Age=2592000/.test(c)));

r = await call('/api/auth/me', { cookie: 'tw_session=' + 'A'.repeat(43) });
check('Forged session token is rejected', r.data.signedIn === false);

// Suspended user
env.DB.raw.prepare("UPDATE users SET status='suspended' WHERE google_sub='google-sub-R'").run();
r = await call('/api/auth/me', { cookie: Rn.session });
check('Suspended user\'s session stops working', r.data.signedIn === false);
check('Suspended user cannot sign back in', (await signIn('google-sub-R', 'r@example.com', 'Renew')).cb.location.includes('signin=suspended'));

// =================== CSRF ===================
section('Cross-site request protection');
r = await call('/api/feedback', { method: 'POST', cookie: A.session, origin: 'https://evil.example.com', body: { category: 'idea', feature: 'home', message: 'x' } });
check('POST from another site is refused', r.status === 403 && r.data.error === 'bad_origin');
r = await call('/api/feedback', { method: 'POST', cookie: A.session, origin: '', body: { category: 'idea', feature: 'home', message: 'x' } });
check('POST with no Origin header is refused', r.status === 403);

// =================== SAVED WEEKS / ISOLATION ===================
section('Saved weeks and User A / User B isolation');
const week = '2026-09-28';
const evA = [{ title: 'A private lecture', dayIndex: 0, startMinutes: 570, endMinutes: 650, allDay: false, category: 'class', source: 'manual', reality: { status: 'over', detail: 45 } }];
r = await call('/api/me/week?start=' + week);
check('Visitor cannot read a saved week', r.status === 401);
r = await call('/api/me/week', { method: 'PUT', body: { weekStart: week, events: evA } });
check('Visitor cannot save a week', r.status === 401);
r = await call('/api/me/week', { method: 'PUT', cookie: A.session, body: { weekStart: week, events: evA, userId: 'whatever', role: 'admin' } });
check('User A saves their week', r.status === 200 && r.data.saved === 1);
r = await call('/api/me/week?start=' + week, { cookie: A.session });
check('User A reads their week back (with reflection status)', r.data.events && r.data.events[0].title === 'A private lecture' && r.data.events[0].reality.detail === 45);
r = await call('/api/me/week?start=' + week, { cookie: B.session });
check('User B does not see User A\'s week', r.status === 200 && r.data.events === null);
const aId = sql("SELECT id FROM users WHERE google_sub='google-sub-A'")[0].id;
r = await call('/api/me/week?start=' + week + '&userId=' + aId + '&user_id=' + aId, { cookie: B.session });
check('User B forging User A\'s ID in the URL still gets only their own data', r.data.events === null);
r = await call('/api/me/week', { method: 'PUT', cookie: B.session, body: { weekStart: week, userId: aId, user_id: aId, events: [{ ...evA[0], title: 'B overwrote' }] } });
r = await call('/api/me/week?start=' + week, { cookie: A.session });
check('User B forging User A\'s ID in the body cannot overwrite A', r.data.events[0].title === 'A private lecture');
check('Forged role in a request did not change anyone\'s role', sql("SELECT COUNT(*) n FROM users WHERE role='admin'")[0].n === 0);

r = await call('/api/me/week', { method: 'PUT', cookie: A.session, body: { weekStart: week, events: Array(201).fill(evA[0]) } });
check('More than 200 events rejected', r.status === 400);
r = await call('/api/me/week', { method: 'PUT', cookie: A.session, body: { weekStart: week, events: [{ ...evA[0], dayIndex: 9 }] } });
check('Out-of-range day rejected', r.status === 400);
r = await call('/api/me/week', { method: 'PUT', cookie: A.session, body: { weekStart: week, events: [{ ...evA[0], title: 'x'.repeat(81) }] } });
check('Over-long title rejected', r.status === 400);
r = await call('/api/me/week', { method: 'PUT', cookie: A.session, body: { weekStart: week, events: [{ ...evA[0], category: '<script>' }] } });
check('Unknown category rejected', r.status === 400);
r = await call('/api/me/week', { method: 'PUT', cookie: A.session, body: { weekStart: "2026-09-28'; DROP TABLE users;--", events: [] } });
check('Injection attempt in week date rejected', r.status === 400 && sql('SELECT COUNT(*) n FROM users')[0].n > 0);
r = await call('/api/me/week', { method: 'PUT', cookie: A.session, body: '{not json' });
check('Malformed JSON rejected', r.status === 400);
r = await call('/api/me/week', { method: 'PUT', cookie: A.session, body: { weekStart: week, events: [{ ...evA[0], extra: 'x'.repeat(200000) }] } });
check('Oversized request rejected', r.status === 400);
r = await call('/api/me/week', { method: 'PUT', cookie: A.session, body: { weekStart: week, events: [{ ...evA[0], sneaky: 'field' }] } });
const stored = JSON.parse(sql("SELECT data FROM saved_weeks WHERE user_id=?", aId)[0].data);
check('Unknown fields are dropped before saving', r.status === 200 && !('sneaky' in stored.events[0]));
r = await call('/api/me/weeks', { cookie: B.session });
check('User B\'s week list does not include User A\'s weeks', r.data.weeks.length === 1 && r.data.weeks[0].events === 1);

// =================== FEEDBACK ===================
section('Feedback');
r = await call('/api/feedback', { method: 'POST', body: { category: 'idea', feature: 'home', message: 'hi' } });
check('Visitor cannot submit feedback (signed-in only)', r.status === 401);
r = await call('/api/feedback', { method: 'POST', cookie: A.session, body: { category: 'confusing', feature: 'replan', page: '/try.html', rating: 3, message: 'Not sure what "fixed" means', userId: 'forged', role: 'admin' } });
check('User A submits feedback', r.status === 200 && r.data.id);
const fbA = r.data.id;
check('Feedback is linked to User A (not a forged ID)', sql('SELECT user_id FROM feedback WHERE id=?', fbA)[0].user_id === aId);
await call('/api/feedback', { method: 'POST', cookie: B.session, body: { category: 'broken', feature: 'calendars', message: 'Notion popup blocked' } });
for (const [label, body, code] of [
  ['Empty message rejected', { category: 'idea', feature: 'home', message: '   ' }, 'empty_message'],
  ['2001-character message rejected', { category: 'idea', feature: 'home', message: 'x'.repeat(2001) }, 'message_too_long'],
  ['Unknown category rejected', { category: 'praise', feature: 'home', message: 'x' }, 'bad_category'],
  ['Unknown feature rejected', { category: 'idea', feature: 'nope', message: 'x' }, 'bad_feature'],
  ['Rating 6 rejected', { category: 'idea', feature: 'home', message: 'x', rating: 6 }, 'bad_rating'],
  ['Rating as text rejected', { category: 'idea', feature: 'home', message: 'x', rating: '5' }, 'bad_rating'],
]) { r = await call('/api/feedback', { method: 'POST', cookie: B.session, body }); check(label, r.status === 400 && r.data.error === code, r.data); }
r = await call('/api/feedback', { method: 'POST', cookie: A.session, body: { category: 'idea', feature: 'home', page: 'javascript:alert(1)', message: 'x' } });
check('Bad page path is replaced with "/"', r.status === 200 && sql('SELECT page FROM feedback WHERE id=?', r.data.id)[0].page === '/');
r = await call('/api/me/feedback', { cookie: A.session });
check('User A sees only their own feedback', r.data.feedback.length === 2 && r.data.feedback.every((f) => !/Notion popup/.test(f.message)));
check('"My feedback" never includes admin notes', r.data.feedback.every((f) => !('admin_notes' in f)));

// =================== ADMIN ===================
section('Admin access');
for (const p of ['/api/admin/overview', '/api/admin/users', '/api/admin/feedback']) {
  r = await call(p); check('Visitor denied ' + p, r.status === 401);
  r = await call(p, { cookie: A.session }); check('User A denied ' + p, r.status === 403);
}
r = await call('/api/admin/feedback/' + fbA, { method: 'PATCH', cookie: A.session, body: { status: 'resolved' } });
check('User A cannot update feedback status', r.status === 403 && sql('SELECT status FROM feedback WHERE id=?', fbA)[0].status === 'new');

// The owner-controlled first-admin step (what ACCOUNTS_SETUP.md tells you to run by hand)
env.DB.raw.prepare("UPDATE users SET role = 'admin' WHERE email = 'owner@example.com'").run();
r = await call('/api/auth/me', { cookie: ADMIN.session });
check('After the manual SQL step, the owner is admin', r.data.user.role === 'admin');
r = await call('/api/admin/overview', { cookie: ADMIN.session });
check('Admin overview works', r.status === 200 && r.data.users.total >= 4 && r.data.feedback.byCategory.confusing === 1, r.data);
r = await call('/api/admin/users', { cookie: ADMIN.session });
check('Admin user list works and never includes session data', r.status === 200 && r.data.users.length >= 4 && r.data.users.every((u) => !('google_sub' in u) && !('id' in u)));
r = await call('/api/admin/feedback?status=new&category=confusing', { cookie: ADMIN.session });
check('Admin feedback filters work', r.status === 200 && r.data.feedback.length === 1 && r.data.feedback[0].user_email === 'user.a@example.com');
r = await call("/api/admin/feedback?status=new' OR 1=1--", { cookie: ADMIN.session });
check('Injection attempt in filter rejected', r.status === 400);
r = await call('/api/admin/feedback/' + fbA, { method: 'PATCH', cookie: ADMIN.session, body: { status: 'reviewing', adminNotes: 'Rename "fixed" to "can\'t move"?' } });
check('Admin updates status + notes', r.status === 200 && sql('SELECT status, admin_notes FROM feedback WHERE id=?', fbA)[0].status === 'reviewing');
check('Admin update is written to the audit log', sql("SELECT COUNT(*) n FROM audit_log WHERE action='feedback.update'")[0].n === 1);
r = await call('/api/me/feedback', { cookie: A.session });
check('User A sees the new status but not the admin note', r.data.feedback.some((f) => f.status === 'reviewing') && !JSON.stringify(r.data).includes('Rename'));
r = await call('/api/admin/feedback/' + fbA, { method: 'PATCH', cookie: ADMIN.session, body: { status: 'done' } });
check('Invalid status rejected', r.status === 400);
r = await call('/api/admin/feedback/999999', { method: 'PATCH', cookie: ADMIN.session, body: { status: 'resolved' } });
check('Unknown feedback ID returns 404', r.status === 404);
r = await call('/api/admin/feedback/abc', { method: 'PATCH', cookie: ADMIN.session, body: { status: 'resolved' } });
check('Non-numeric feedback ID returns 404', r.status === 404);

// =================== RATE LIMITS ===================
section('Rate limits');
let last;
for (let i = 0; i < 12; i++) last = await call('/api/feedback', { method: 'POST', cookie: B.session, body: { category: 'idea', feature: 'home', message: 'spam ' + i } });
check('Feedback limited to 10/hour per user', last.status === 429);
for (let i = 0; i < 21; i++) last = await call('/api/auth/login', { ip: '9.9.9.9' });
check('Sign-in attempts limited to 20 per 10 min per IP', last.location.includes('signin=too_many'));
last = await call('/api/auth/login', { ip: '8.8.8.8' });
check('Other IPs are unaffected', last.location.startsWith('https://accounts.google.com/'));

// =================== DELETE ACCOUNT ===================
section('Deleting your own account');
r = await call('/api/me/delete', { method: 'POST', cookie: A.session, body: {} });
check('Delete requires typed confirmation', r.status === 400);
r = await call('/api/me/delete', { method: 'POST', cookie: ADMIN.session, body: { confirm: 'DELETE' } });
check('The last admin cannot delete their account', r.status === 400 && r.data.error === 'last_admin');
r = await call('/api/me/delete', { method: 'POST', cookie: A.session, body: { confirm: 'DELETE' } });
check('User A deletes their account', r.status === 200);
check('…their sessions and saved weeks are gone', sql('SELECT COUNT(*) n FROM sessions WHERE user_id=?', aId)[0].n === 0 && sql('SELECT COUNT(*) n FROM saved_weeks WHERE user_id=?', aId)[0].n === 0);
check('…their feedback is kept but unlinked', sql('SELECT user_id FROM feedback WHERE id=?', fbA)[0].user_id === null);
r = await call('/api/auth/me', { cookie: A.session });
check('…and their old cookie no longer works', r.data.signedIn === false);

// =================== EXISTING SITE ===================
section('Existing features still work');
r = await call('/api/waitlist', { method: 'POST', body: { visitorId: 'visitor-1234abcd', email: 'w@x.edu', weekly: 'Definitely' } });
check('Early-access form still works', r.status === 200 && r.data.ok);
r = await call('/api/track', { method: 'POST', body: { visitorId: 'visitor-1234abcd', event: 'replan_used' } });
check('Feature tracking still works', r.status === 204);
r = await call('/api/notion/status');
check('Notion status route still answers', r.status === 200);
r = await call('/');
check('Static pages still served', r.status === 200);
r = await call('/api/admin/overview', { cookie: ADMIN.session });
check('Admin overview includes early-access numbers', r.data.earlyAccess.responses === 1 && r.data.earlyAccess.features.replan_used === 1, r.data.earlyAccess);

// Not configured
const bare = { DB: env.DB, ASSETS: env.ASSETS };
const nc = await worker.fetch(new Request(ORIGIN + '/api/auth/login?return=/try.html'), bare);
check('Without Google settings, sign-in fails safely', nc.status === 302 && nc.headers.get('Location').includes('signin=not_configured'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('\nFailures:\n' + failures.join('\n')); process.exit(1); }
