// Test-only local server for the accounts system: real worker.js + server/accounts.js,
// SQLite stand-in for D1 (migration applied, foreign keys on), and a fake Google.
// Not part of the site; not deployed.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker.js';

const PORT = 8791, ORIGIN = 'http://localhost:' + PORT, CLIENT_ID = 'local-test-client';
const db = new DatabaseSync('/tmp/tw-local.sqlite');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(new URL('../migrations/0001_accounts.sql', import.meta.url), 'utf8'));
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  run: async () => { db.prepare(sql).run(...args); return { success: true }; },
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  first: async () => db.prepare(sql).get(...args) ?? null,
  _b: () => ({ results: /^\s*(SELECT|WITH)|RETURNING/i.test(sql) ? db.prepare(sql).all(...args) : (db.prepare(sql).run(...args), []) })
});
const D1 = { prepare: (s) => stmt(s), batch: async (l) => l.map((s) => s._b()) };

const PEOPLE = { a: ['sub-user-a', 'user.a@example.com', 'Alex Tester'], b: ['sub-user-b', 'user.b@example.com', 'Blair Tester'], owner: ['sub-owner', 'owner@example.com', 'Site Owner'] };
const codes = new Map();
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
globalThis.fetch = async (url, init) => {
  if (String(url) === 'https://oauth2.googleapis.com/token') {
    const p = new URLSearchParams(init.body); const c = codes.get(p.get('code'));
    const ok = c && crypto.createHash('sha256').update(p.get('code_verifier')).digest('base64url') === c.challenge;
    if (!ok) return new Response('{"error":"invalid_grant"}', { status: 400 });
    const claims = { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: c.who[0], email: c.who[1], name: c.who[2], email_verified: true, nonce: c.nonce, exp: Math.floor(Date.now() / 1000) + 3600 };
    return Response.json({ id_token: b64u({ alg: 'none' }) + '.' + b64u(claims) + '.x' });
  }
  return new Response('offline in test', { status: 500 });
};

const env = { DB: D1, GOOGLE_AUTH_CLIENT_ID: CLIENT_ID, GOOGLE_AUTH_CLIENT_SECRET: 'local-dummy', ADMIN_KEY: 'test-admin', ASSETS: { fetch: async (req) => {
  let p = new URL(req.url).pathname; if (p === '/') p = '/index.html';
  const f = path.join(new URL('..', import.meta.url).pathname, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('404', { status: 404 });
  const type = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }[path.extname(p)] || 'text/html';
  return new Response(fs.readFileSync(f), { headers: { 'Content-Type': type } });
} } };

http.createServer(async (req, res) => {
  const u = new URL(ORIGIN + req.url);
  if (u.pathname === '/fake-google') { // stand-in for Google's account chooser
    if (u.searchParams.get('as')) {
      const code = 'c' + crypto.randomUUID();
      codes.set(code, { who: PEOPLE[u.searchParams.get('as')], nonce: u.searchParams.get('nonce'), challenge: u.searchParams.get('code_challenge') });
      res.writeHead(302, { Location: u.searchParams.get('redirect_uri') + '?code=' + code + '&state=' + u.searchParams.get('state') }); return res.end();
    }
    const q = u.search;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(`<h1>Fake Google (local test)</h1>${Object.keys(PEOPLE).map((k) => `<p><a id="as-${k}" href="/fake-google${q}&as=${k}">Continue as ${PEOPLE[k][2]}</a></p>`).join('')}<p><a id="cancel" href="${u.searchParams.get('redirect_uri')}?error=access_denied&state=${u.searchParams.get('state')}">Cancel</a></p>`);
  }
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
  const r = await worker.fetch(new Request(ORIGIN + req.url, { method: req.method, headers: req.headers, body }), env);
  const h = {};
  for (const [k, v] of r.headers) {
    if (k === 'set-cookie') (h[k] = h[k] || []).push(v.replace('; Secure', '')); // http://localhost only
    else if (k === 'location' && v.startsWith('https://accounts.google.com/')) h[k] = '/fake-google' + new URL(v).search;
    else h[k] = v;
  }
  res.writeHead(r.status, h);
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log('local test server on ' + ORIGIN));
