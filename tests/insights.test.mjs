// Test-only: the product-insights API (problems, experiments, decisions, observations, sources).
// Run: node tests/insights.test.mjs  — in-memory SQLite stand-in for D1, fake Google sign-in.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import crypto from 'node:crypto';
import worker from '../worker.js';

const migrations = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort()
  .map((m) => fs.readFileSync(new URL('../migrations/' + m, import.meta.url), 'utf8'));
function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  migrations.forEach((m) => db.exec(m));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    run: async () => { db.prepare(sql).run(...args); return {}; },
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    first: async () => db.prepare(sql).get(...args) ?? null,
    _b: () => ({ results: /^\s*(SELECT|WITH)|RETURNING/i.test(sql) ? db.prepare(sql).all(...args) : (db.prepare(sql).run(...args), []) })
  });
  return { raw: db, prepare: (s) => stmt(s), batch: async (l) => l.map((s) => s._b()) };
}

const ORIGIN = 'https://timewise.example.workers.dev', CLIENT_ID = 'cid.apps.googleusercontent.com';
const env = { DB: makeD1(), GOOGLE_AUTH_CLIENT_ID: CLIENT_ID, GOOGLE_AUTH_CLIENT_SECRET: 'dummy', ASSETS: { fetch: () => new Response('asset') } };
const sql = (q, ...a) => env.DB.raw.prepare(q).all(...a);
const codes = new Map();
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
globalThis.fetch = async (url, init) => {
  const p = new URLSearchParams(init.body); const c = codes.get(p.get('code'));
  if (!c || crypto.createHash('sha256').update(p.get('code_verifier')).digest('base64url') !== c.ch) return new Response('{}', { status: 400 });
  return Response.json({ id_token: 'x.' + b64u({ iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: c.sub, email: c.sub + '@x.edu', name: c.sub, email_verified: true, nonce: c.nonce, exp: Date.now() / 1000 + 3600 }) + '.y' });
};
async function call(path, { method = 'GET', cookie = '', body } = {}) {
  const headers = { 'CF-Connecting-IP': '1.2.3.4' };
  if (cookie) headers.Cookie = cookie;
  if (method !== 'GET') headers.Origin = ORIGIN;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  const t = await res.text(); let data = null; try { data = JSON.parse(t); } catch (e) {}
  return { status: res.status, data, cookies: res.headers.getSetCookie(), location: res.headers.get('Location') };
}
const cv = (list, n) => (list.find((c) => c.startsWith(n + '=')) || '').split(';')[0];
async function signIn(sub) {
  const l = await call('/api/auth/login?return=/'); const a = new URL(l.location); const code = 'c' + crypto.randomUUID();
  codes.set(code, { sub, nonce: a.searchParams.get('nonce'), ch: a.searchParams.get('code_challenge') });
  const cb = await call(`/api/auth/callback?code=${code}&state=${a.searchParams.get('state')}`, { cookie: cv(l.cookies, 'tw_oauth') });
  return cv(cb.cookies, 'tw_session');
}
let pass = 0, fail = 0; const fails = [];
const check = (n, ok, x) => { ok ? pass++ : (fail++, fails.push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''))); console.log((ok ? '  ✓ ' : '  ✗ ') + n); };
const section = (t) => console.log('\n' + t);

const A = await signIn('usera'), B = await signIn('userb'), ADMIN = await signIn('owner');
env.DB.raw.prepare("UPDATE users SET role='admin' WHERE google_sub='owner'").run();

section('Migration');
{
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys = ON;'); db.exec(migrations[0]);
  db.exec("INSERT INTO users(id,google_sub,email) VALUES('u','s','e'); INSERT INTO feedback(user_id,category,feature,page,message) VALUES('u','idea','home','/','pre-existing')");
  db.exec(migrations[1]);
  const row = db.prepare('SELECT source, problem_id FROM feedback').get();
  check('Existing feedback is kept and labeled "test" (not deleted)', row.source === 'test' && row.problem_id === null);
  let rejected = false; try { db.exec("UPDATE feedback SET source='bogus'"); } catch (e) { rejected = true; }
  check('Database rejects unknown source labels', rejected);
}

section('Only admins can reach the insights API');
const adminRoutes = [['GET', '/api/admin/insights'], ['POST', '/api/admin/problems', { title: 'x' }], ['PATCH', '/api/admin/problems/1', { status: 'planned' }],
  ['POST', '/api/admin/experiments', { title: 'x' }], ['POST', '/api/admin/decisions', { title: 'x' }],
  ['POST', '/api/admin/observations', { category: 'idea', feature: 'home', message: 'x' }]];
for (const [method, path, body] of adminRoutes) {
  const v = await call(path, { method, body }); const u = await call(path, { method, body, cookie: A });
  check(`${method} ${path}: visitor 401, tester 403`, v.status === 401 && u.status === 403, [v.status, u.status]);
}
check('Nothing was created by refused requests', sql('SELECT COUNT(*) n FROM problems')[0].n === 0 && sql('SELECT COUNT(*) n FROM experiments')[0].n === 0);

section('Feedback sources and real-only counts');
const f1 = (await call('/api/feedback', { method: 'POST', cookie: A, body: { category: 'confusing', feature: 'replan', message: 'Not sure what fixed means', rating: 3 } })).data.id;
const f2 = (await call('/api/feedback', { method: 'POST', cookie: B, body: { category: 'confusing', feature: 'replan', message: 'Which blocks can move?' } })).data.id;
const f3 = (await call('/api/feedback', { method: 'POST', cookie: B, body: { category: 'idea', feature: 'your_week', message: 'Make it prettier' } })).data.id;
const f4 = (await call('/api/feedback', { method: 'POST', cookie: ADMIN, body: { category: 'broken', feature: 'home', message: 'my own test note' } })).data.id;
check('New tester feedback is labeled "real" by default', sql('SELECT COUNT(*) n FROM feedback WHERE source = ?', 'real')[0].n === 4);
let r = await call('/api/admin/feedback/' + f4, { method: 'PATCH', cookie: ADMIN, body: { source: 'test' } });
check('Admin can relabel an item as test data', r.status === 200 && sql('SELECT source FROM feedback WHERE id=?', f4)[0].source === 'test');
r = await call('/api/admin/feedback/' + f4, { method: 'PATCH', cookie: ADMIN, body: { source: 'fake' } });
check('Unknown source label rejected', r.status === 400);
r = await call('/api/admin/overview', { cookie: ADMIN });
check('Overview counts real feedback only (test item excluded)', r.data.feedback.byCategory.broken === undefined && r.data.feedback.byCategory.confusing === 2 && r.data.feedback.nonRealItems === 1, r.data.feedback);
r = await call('/api/admin/feedback?source=test', { cookie: ADMIN });
check('Inbox can filter by source', r.data.feedback.length === 1 && r.data.feedback[0].id === f4);
r = await call('/api/admin/feedback?source=bogus', { cookie: ADMIN });
check('Bad source filter rejected', r.status === 400);
r = await call('/api/admin/feedback', { cookie: ADMIN });
const byId = Object.fromEntries(r.data.feedback.map((f) => [f.id, f]));
check('Tester codes are anonymous and stable per account', byId[f2].tester === byId[f3].tester && byId[f1].tester !== byId[f2].tester && /^T-[0-9a-f]{5}$/.test(byId[f1].tester));
check('Inbox never includes names, emails, or account IDs', !/usera@x\.edu|"usera"|user_id|user_email|user_name/.test(JSON.stringify(r.data)));

section('Problems');
r = await call('/api/admin/problems', { method: 'POST', cookie: ADMIN, body: {} });
check('Problem needs a title', r.status === 400 && r.data.error === 'title_required');
r = await call('/api/admin/problems', { method: 'POST', cookie: ADMIN, body: { title: 'x'.repeat(121) } });
check('Over-long title rejected', r.status === 400);
r = await call('/api/admin/problems', { method: 'POST', cookie: ADMIN, body: { title: 'x', sevImpact: 'extreme' } });
check('Severity must be unknown/low/moderate/high', r.status === 400);
r = await call('/api/admin/problems', { method: 'POST', cookie: ADMIN, body: { title: 'x', status: 'done' } });
check('Status must be one of the 9 defined statuses', r.status === 400);
r = await call('/api/admin/problems', { method: 'POST', cookie: ADMIN, body: { title: 'Replan: unclear which blocks can move', theme: 'Clarity',
  psUser: 'Students replanning a busy day', psSituation: 'Using Replan after running late', psProblem: 'They cannot tell what "fixed" means', psImpact: 'They hesitate or skip replanning',
  known: '2 testers asked what fixed means', interpretation: 'Label wording may be unclear', unknowns: 'Whether it is wording or layout',
  sevFrequency: 'moderate', sevImpact: 'moderate', sevReach: 'unknown', sevCore: 'high', sevConfidence: 'low', priority: 'now',
  "role = 'admin' --": 'ignored', id: 999 } });
check('Admin creates a problem (unknown keys ignored)', r.status === 200 && r.data.id);
const p1 = r.data.id;
check('Unknown keys never reach the database', sql('SELECT id FROM problems')[0].id !== 999 && sql("SELECT COUNT(*) n FROM users WHERE role='admin'")[0].n === 1);
r = await call('/api/admin/feedback/' + f1, { method: 'PATCH', cookie: ADMIN, body: { problemId: p1, journeyStage: 'adjusting_plans' } });
await call('/api/admin/feedback/' + f2, { method: 'PATCH', cookie: ADMIN, body: { problemId: p1 } });
await call('/api/admin/feedback/' + f4, { method: 'PATCH', cookie: ADMIN, body: { problemId: p1 } });
check('Feedback can be linked to a problem', sql('SELECT COUNT(*) n FROM feedback WHERE problem_id=?', p1)[0].n === 3);
r = await call('/api/admin/feedback/' + f3, { method: 'PATCH', cookie: ADMIN, body: { problemId: 424242 } });
check('Linking to a problem that doesn\'t exist is rejected', r.status === 400);
r = await call('/api/admin/feedback/' + f3, { method: 'PATCH', cookie: ADMIN, body: { journeyStage: 'somewhere' } });
check('Unknown journey stage rejected', r.status === 400);
r = await call('/api/admin/insights', { cookie: ADMIN });
const prob = r.data.problems.find((p) => p.id === p1);
check('Problem evidence counts real feedback only (2 real, 1 test excluded)', prob.real_feedback === 2 && prob.real_testers === 2 && prob.excluded === 1, prob);
r = await call('/api/admin/feedback?problem=' + p1, { cookie: ADMIN });
check('Inbox filter by problem', r.data.feedback.length === 3);
r = await call('/api/admin/feedback?problem=none', { cookie: ADMIN });
check('Inbox filter "not linked to a problem"', r.data.feedback.length === 1 && r.data.feedback[0].id === f3);
r = await call('/api/admin/feedback?problem=1%20OR%201=1', { cookie: ADMIN });
check('Injection attempt in problem filter rejected', r.status === 400);
r = await call('/api/admin/problems/' + p1, { method: 'PATCH', cookie: ADMIN, body: { status: 'testing', smallestChange: 'Rename "Fixed" to "Can\'t move"' } });
check('Problem status + fields update', r.status === 200 && sql('SELECT status FROM problems WHERE id=?', p1)[0].status === 'testing');
r = await call('/api/admin/problems/999', { method: 'PATCH', cookie: ADMIN, body: { status: 'planned' } });
check('Updating a missing problem returns 404', r.status === 404);
r = await call('/api/admin/problems/' + p1, { method: 'PATCH', cookie: ADMIN, body: { title: '' } });
check('Title cannot be blanked', r.status === 400);

section('Manual observations');
r = await call('/api/admin/observations', { method: 'POST', cookie: ADMIN, body: { category: 'confusing', feature: 'replan', message: 'Watched a tester hover over "Fixed" for 10s', journeyStage: 'adjusting_plans', userType: 'Athlete (self-described)', problemId: p1 } });
check('Admin logs an observation', r.status === 200);
const obs = sql('SELECT * FROM feedback WHERE id=?', r.data.id)[0];
check('Observation is labeled "observation" and tied to no user', obs.source === 'observation' && obs.user_id === null && obs.user_type === 'Athlete (self-described)');
r = await call('/api/admin/observations', { method: 'POST', cookie: ADMIN, body: { category: 'confusing', feature: 'replan', message: '' } });
check('Empty observation rejected', r.status === 400);
r = await call('/api/admin/observations', { method: 'POST', cookie: ADMIN, body: { category: 'confusing', feature: 'replan', message: 'x', journeyStage: 'moon' } });
check('Observation with unknown stage rejected', r.status === 400);
r = await call('/api/me/feedback', { cookie: A });
check('Observations never appear in a tester\'s "My feedback"', r.data.feedback.every((f) => !/hover/.test(f.message)));
r = await call('/api/admin/insights', { cookie: ADMIN });
check('Observations are counted separately from real feedback', r.data.overview.observations === 1 && r.data.overview.realFeedback === 3 && r.data.problems[0].observations === 1, r.data.overview);

section('Experiments and decisions');
r = await call('/api/admin/experiments', { method: 'POST', cookie: ADMIN, body: { title: 'Rename Fixed', problemId: p1, hypothesis: 'Clearer label reduces confusion', startedOn: '2026-10-01', decision: 'pending' } });
check('Admin creates an experiment linked to a problem', r.status === 200);
const e1 = r.data.id;
r = await call('/api/admin/experiments', { method: 'POST', cookie: ADMIN, body: { title: 'x', startedOn: '10/01/2026' } });
check('Bad date rejected', r.status === 400);
r = await call('/api/admin/experiments', { method: 'POST', cookie: ADMIN, body: { title: 'x', problemId: 777 } });
check('Experiment linked to a missing problem rejected', r.status === 400);
r = await call('/api/admin/experiments/' + e1, { method: 'PATCH', cookie: ADMIN, body: { decision: 'win' } });
check('Unknown experiment decision rejected', r.status === 400);
r = await call('/api/admin/experiments/' + e1, { method: 'PATCH', cookie: ADMIN, body: { decision: 'keep', actualResult: 'Fewer questions', endedOn: '2026-10-08' } });
check('Experiment result + decision recorded', r.status === 200 && sql('SELECT decision FROM experiments WHERE id=?', e1)[0].decision === 'keep');
r = await call('/api/admin/decisions', { method: 'POST', cookie: ADMIN, body: { title: 'Keep "Can\'t move" label', decidedOn: '2026-10-08', problemId: p1, experimentId: e1, evidence: '2 real + 1 observation', reason: 'Confusion reports stopped' } });
check('Admin logs a decision linked to problem + experiment', r.status === 200);
r = await call('/api/admin/decisions', { method: 'POST', cookie: ADMIN, body: { title: 'x', experimentId: 555 } });
check('Decision linked to a missing experiment rejected', r.status === 400);
r = await call('/api/admin/insights', { cookie: ADMIN });
check('Snapshot includes experiments + decisions', r.data.experiments.length === 1 && r.data.decisions.length === 1 && r.data.overview.implemented === 1 && r.data.overview.awaitingValidation === 1);
const auditRows = sql("SELECT action FROM audit_log WHERE action LIKE 'problem.%' OR action LIKE 'experiment.%' OR action LIKE 'decision.%' OR action LIKE 'observation.%'").map((x) => x.action);
check('Every create/update was audited', auditRows.length >= 6, auditRows);

section('Bad input');
r = await call('/api/admin/problems', { method: 'POST', cookie: ADMIN, body: { title: 'x', known: 'y'.repeat(3001) } });
check('Over-long text field rejected', r.status === 400);
r = await call('/api/admin/problems', { method: 'POST', cookie: ADMIN, body: { title: 42 } });
check('Non-text title rejected', r.status === 400);
r = await worker.fetch(new Request(ORIGIN + '/api/admin/problems', { method: 'POST', headers: { Cookie: ADMIN, Origin: 'https://evil.example.com', 'Content-Type': 'application/json' }, body: '{"title":"csrf"}' }), env);
check('Cross-site request refused', r.status === 403);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log(fails.join('\n')); process.exit(1); }
