// Test-only. Checks POST /api/ics-feed in worker.js: only Brandeis Moodle export
// links are fetched, the link never shows up in responses or logs, and bad
// responses from Moodle are handled. Run: node tests/ics-feed.test.mjs
import worker, { checkMoodleFeedUrl } from '../worker.js';

const ORIGIN = 'https://timewise.example.workers.dev';
const GOOD = 'https://moodle.brandeis.edu/calendar/export_execute.php?userid=123&authtoken=SECRETTOKEN42&preset_what=all&preset_time=recentupcoming';
const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Essay due\r\nDTSTART:20261110T235900Z\r\nDTEND:20261110T235900Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
const env = { ASSETS: { fetch: () => new Response('asset') } }; // no DB: rate limit is skipped

let fetched = [];
let reply = () => new Response(ICS, { status: 200, headers: { 'Content-Type': 'text/calendar' } });
globalThis.fetch = async (url, init) => { fetched.push({ url: String(url), init }); return reply(); };
const logs = [];
for (const k of ['log', 'error', 'warn', 'info']) { const orig = console[k]; console[k] = (...a) => { logs.push(a.join(' ')); }; console['_' + k] = orig; }

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console._log('FAIL: ' + name); } };
const call = (body, headers = { Origin: ORIGIN, 'Content-Type': 'application/json' }) =>
  worker.fetch(new Request(ORIGIN + '/api/ics-feed', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);

// URL checks
ok(checkMoodleFeedUrl(GOOD) !== null, 'accepts a real export link');
for (const bad of [
  'http://moodle.brandeis.edu/calendar/export_execute.php?userid=1&authtoken=x',
  'https://moodle.brandeis.edu.evil.com/calendar/export_execute.php?userid=1&authtoken=x',
  'https://evil.com/calendar/export_execute.php?userid=1&authtoken=x',
  'https://moodle.brandeis.edu/login/index.php?userid=1&authtoken=x',
  'https://moodle.brandeis.edu:8443/calendar/export_execute.php?userid=1&authtoken=x',
  'https://user:pw@moodle.brandeis.edu/calendar/export_execute.php?userid=1&authtoken=x',
  'https://moodle.brandeis.edu/calendar/export_execute.php?userid=1&authtoken=x&redirect=https://evil.com',
  'https://moodle.brandeis.edu/calendar/export_execute.php?userid=1',
  'https://moodle.brandeis.edu/calendar/../admin/export_execute.php?userid=1&authtoken=x',
  'not a url', '', null, 42, 'https://moodle.brandeis.edu/calendar/export_execute.php?userid=1&authtoken=' + 'x'.repeat(700)
]) ok(checkMoodleFeedUrl(bad) === null, 'rejects ' + String(bad).slice(0, 80));

// Happy path
fetched = [];
let res = await call({ url: GOOD });
let text = await res.text();
ok(res.status === 200 && text.startsWith('BEGIN:VCALENDAR'), 'returns the calendar');
ok(res.headers.get('Cache-Control') === 'no-store', 'not cached');
ok(fetched.length === 1 && fetched[0].url === GOOD, 'fetches exactly the Moodle link');
ok(fetched[0].init.redirect === 'manual', 'does not follow redirects');

// Origin and input checks never fetch
fetched = [];
res = await call({ url: GOOD }, { Origin: 'https://evil.com', 'Content-Type': 'application/json' });
ok(res.status === 403, 'other sites are refused');
res = await call({ url: 'https://evil.com/x.ics' });
ok(res.status === 400 && (await res.json()).error === 'not_moodle_link', 'non-Moodle link refused');
res = await call('{not json');
ok(res.status === 400, 'bad JSON refused');
ok(fetched.length === 0, 'nothing fetched for refused requests');
res = await worker.fetch(new Request(ORIGIN + '/api/ics-feed?url=' + encodeURIComponent(GOOD), { headers: { Origin: ORIGIN } }), env);
ok(res.status !== 200, 'GET with the link in the URL is not served');

// Moodle misbehaving
const cases = [
  [() => new Response('', { status: 302, headers: { Location: 'https://evil.com' } }), 502, 'redirect'],
  [() => new Response('nope', { status: 403 }), 502, 'expired token'],
  [() => new Response('<html>login</html>', { status: 200 }), 502, 'not a calendar'],
  [() => new Response('BEGIN:VCALENDAR\n' + 'X'.repeat(2 * 1024 * 1024 + 10), { status: 200 }), 413, 'too large'],
  [() => { throw new Error('connect failed for ' + GOOD); }, 502, 'network error']
];
for (const [fn, status, name] of cases) {
  reply = fn;
  res = await call({ url: GOOD });
  const body = await res.text();
  ok(res.status === status, name + ' → ' + status + ' (got ' + res.status + ')');
  ok(!body.includes('SECRETTOKEN42'), name + ': token not echoed');
}

ok(!logs.some((l) => l.includes('SECRETTOKEN42')), 'token never logged');
console._log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
