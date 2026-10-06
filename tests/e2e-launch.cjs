// Test-only: "Start my week" first-run setup, repeating classes, and launch tracking.
// Start tests/local-server.mjs first (fresh /tmp/tw-local.sqlite), then: node tests/e2e-launch.cjs (needs Playwright).
const { chromium } = require('playwright');
const { DatabaseSync } = require('node:sqlite');
const BASE = 'http://localhost:8791';
let pass = 0, fail = 0; const fails = [];
const check = (n, ok, x) => { ok ? pass++ : (fail++, fails.push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''))); console.log((ok ? '  ✓ ' : '  ✗ ') + n); };
const db = () => new DatabaseSync('/tmp/tw-local.sqlite');

async function user(browser, w = 1280, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.route(/fonts\.g|cloudflareinsights|accounts\.google\.com\/gsi/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  return { ctx, page };
}
async function addEvent(page, title, days, start, end) {
  await page.fill('#quickAddTitle', title);
  for (const box of await page.$$('#quickAddDays input')) {
    const v = Number(await box.getAttribute('value'));
    if ((await box.isChecked()) !== days.includes(v)) await box.evaluate((b) => b.click());
  }
  await page.fill('#quickAddStart', start);
  if (end) await page.fill('#quickAddEnd', end);
  await page.click('.quick-add-submit'); await page.waitForTimeout(150);
}

(async () => {
  const browser = await chromium.launch();

  console.log('\nArriving from a shared link');
  const A = await user(browser);
  await A.page.goto(BASE + '/index.html?from=team'); await A.page.waitForTimeout(600);
  check('The ?from= tag is removed from the address bar', !A.page.url().includes('from='));
  check('…and remembered in this browser', (await A.page.evaluate(() => localStorage.getItem('timewise-from'))) === 'team');
  check('Header CTA is "Start my week"', (await A.page.textContent('.primary-nav .btn')).trim() === 'Start my week');
  check('Hero CTA starts setup', (await A.page.getAttribute('.home-hero-ctas .btn-primary', 'href')) === 'try.html#setup');
  const visit = db().prepare("SELECT source, seconds FROM visit_days").all();
  check('The visit is counted anonymously with its source', visit.length === 1 && visit[0].source === 'team' && visit[0].seconds === 0, visit);

  console.log('\nStart my week (signed out)');
  await A.page.click('.home-hero-ctas .btn-primary'); await A.page.waitForTimeout(700);
  check('Lands on try.html#setup', A.page.url().endsWith('/try.html#setup'));
  check('Starts with an empty week, not Maya\'s', (await A.page.$$('.week-event')).length === 0);
  check('Setup card is shown with 3 steps', await A.page.isVisible('#setup') && (await A.page.$$('#setup .setup-step')).length === 3);
  check('Step 1 offers Google sign-in', await A.page.isVisible('#setup a.btn:has-text("Sign in with Google")'));
  check('Sample note is hidden', !(await A.page.isVisible('#todaySampleNote')));

  console.log('\nRepeating classes');
  check('Today\'s day is pre-ticked', (await A.page.$$eval('#quickAddDays input:checked', (b) => b.map((x) => Number(x.value)))).length === 1);
  await addEvent(A.page, 'BIO 201 Lecture', [0, 2, 4], '10:00', '11:15');
  check('One entry with Mon/Wed/Fri adds 3 blocks', (await A.page.$$('.week-event')).length === 3);
  check('Status says which days', (await A.page.textContent('#quickAddStatus')).includes('Mon, Wed, Fri'));
  await A.page.$$eval('#quickAddDays input', (bs) => bs.forEach((b) => { if (b.checked) b.click(); }));
  await A.page.fill('#quickAddTitle', 'No day'); await A.page.fill('#quickAddStart', '09:00'); await A.page.click('.quick-add-submit');
  check('No day ticked → asks to pick one, adds nothing', (await A.page.textContent('#quickAddStatus')).includes('Pick at least one day') && (await A.page.$$('.week-event')).length === 3);
  check('Setup step 2 shows progress', (await A.page.textContent('#setup')).includes('3 things added so far'));
  check('Not "set up" yet while signed out', !(await A.page.textContent('#setup')).includes("You're set up"));

  console.log('\nSign in from the setup card');
  await A.page.click('#setup a.btn:has-text("Sign in with Google")');
  await A.page.click('#as-a');
  await A.page.waitForSelector('.nav-account-btn', { state: 'attached' });
  await A.page.waitForTimeout(1500);
  check('Back on try.html#setup, signed in', A.page.url().includes('/try.html') && A.page.url().endsWith('#setup'));
  check('Blocks added before sign-in survived the trip to Google', (await A.page.$$('.week-event')).length === 3);
  await A.page.waitForFunction(() => /Saved/.test(document.getElementById('weekSaveStatus').textContent), null, { timeout: 5000 });
  check('…and were saved to the account', true);
  const setupText = await A.page.textContent('#setup');
  check('3 own blocks + signed in = "You\'re set up"', setupText.includes("You're set up") && setupText.includes('home screen'), setupText.slice(0, 120));
  let row = db().prepare("SELECT source, contact_ok FROM users WHERE email = 'user.a@example.com'").get();
  check('The user is tagged with the link they came from', row.source === 'team', row);
  check('Today counts as an active day', db().prepare("SELECT COUNT(*) n FROM user_days").get().n === 1);
  await A.page.click('#setup button:has-text("Got it")');
  check('"Got it" hides the card', !(await A.page.isVisible('#setup')));

  console.log('\nContact opt-in');
  await A.page.evaluate(() => { localStorage.removeItem('timewise-setup-done'); });
  await A.page.click('#weekClearBtn'); await A.page.waitForTimeout(200); // empty week → setup again
  await A.page.goto(BASE + '/try.html#setup'); await A.page.waitForTimeout(1200);
  const box = await A.page.$('#setupContactOk');
  check('Signed-in setup offers "OK to email me once"', !!box && !(await box.isChecked()));
  await box.check(); await A.page.waitForTimeout(400);
  row = db().prepare("SELECT contact_ok FROM users WHERE email = 'user.a@example.com'").get();
  check('Ticking it is saved', row.contact_ok === 1, row);

  console.log('\nTime on site');
  const pings = await A.page.evaluate(async () => {
    const id = localStorage.getItem('timewise-visitor-id');
    const send = (b) => fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.status);
    return [await send({ visitorId: id, seconds: 60 }), await send({ visitorId: id, seconds: 999 }), await send({ visitorId: 'x', seconds: 60 })];
  });
  check('A 60-second ping is accepted; odd values are refused', pings[0] === 204 && pings[1] === 400 && pings[2] === 400, pings);
  const secs = db().prepare("SELECT seconds FROM visit_days").all().map((r) => r.seconds);
  check('Seconds add up per browser per day', secs.includes(60), secs);
  check('No page errors (tester)', A.page.errors.length === 0, A.page.errors);

  console.log('\nVisitors without a link tag still see Maya\'s week');
  const V = await user(browser);
  await V.page.goto(BASE + '/try.html'); await V.page.waitForTimeout(600);
  check('Plain try.html shows the sample week + "Set up my own week"', (await V.page.$$('.week-event')).length > 10 && await V.page.isVisible('#todaySampleAdd'));
  await V.page.click('#todaySampleAdd'); await V.page.waitForTimeout(400);
  check('"Set up my own week" clears the sample and shows setup', (await V.page.$$('.week-event')).length === 0 && await V.page.isVisible('#setup'));
  await V.page.click('#setup button:has-text("Show Maya")'); await V.page.waitForTimeout(300);
  check('"Show Maya\'s sample week" brings it back', (await V.page.$$('.week-event')).length > 10 && !(await V.page.isVisible('#setup')));

  console.log('\nAdmin launch scoreboard');
  db().prepare("INSERT INTO user_days (user_id, day) SELECT id, date('now', '-1 day') FROM users WHERE email = 'user.a@example.com'").run();
  const O = await user(browser);
  await O.page.goto(BASE + '/'); await O.page.waitForSelector('.nav-signin', { state: 'attached' });
  await O.page.click('.nav-signin'); await O.page.click('#as-owner'); await O.page.waitForSelector('.nav-account-btn', { state: 'attached' });
  db().prepare("UPDATE users SET role = 'admin' WHERE email = 'owner@example.com'").run();
  await O.page.goto(BASE + '/admin.html'); await O.page.waitForSelector('#launch .kpi');
  const L = (await O.page.textContent('#launch')).replace(/\s+/g, ' ');
  check('Scoreboard: 1 / 50 users (admin not counted)', L.includes('1 / 50'), L.slice(0, 300));
  check('Scoreboard: 1 / 10 returned (2 different days)', L.includes('1 / 10'));
  check('Scoreboard: OK to email counted', /1\s*OK to email/.test(L));
  check('Scoreboard breaks users down by link tag', (await O.page.textContent('#launch table')).includes('team'));
  await O.page.click('#tab-testers'); await O.page.waitForSelector('#panel-testers tbody tr');
  const tr = await O.page.textContent('#panel-testers tbody tr:has-text("user.a@example.com")');
  check('Testers tab shows source, active days, own events, OK to email', tr.includes('team') && tr.includes('Yes'), tr);

  console.log('\nPhone');
  const M = await user(browser, 390, 844);
  await M.page.goto(BASE + '/try.html#setup'); await M.page.waitForTimeout(800);
  check('Setup fits a phone (no sideways scroll)', (await M.page.evaluate(() => document.documentElement.scrollWidth)) === 390);
  check('Day chips are big enough to tap (≥ 40px tall)', await M.page.$$eval('.day-chips span', (s) => s.every((x) => x.getBoundingClientRect().height >= 40)));
  await M.page.locator('#setup').screenshot({ path: 'launch-setup-mobile.png' });
  await M.page.locator('#quickAddForm').scrollIntoViewIfNeeded();
  await M.page.screenshot({ path: 'launch-add-mobile.png' });
  check('No page errors (phone)', M.page.errors.length === 0, M.page.errors);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();
