// Test-only browser walk-through. Start tests/local-server.mjs first, then: node tests/e2e-browser.cjs (needs Playwright).
const { chromium } = require('playwright');
const { DatabaseSync } = require('node:sqlite');
const BASE = 'http://localhost:8791';
let pass = 0, fail = 0; const fails = [];
const check = (name, ok, extra) => { ok ? pass++ : (fail++, fails.push(name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : ''))); console.log((ok ? '  ✓ ' : '  ✗ ') + name); };

async function newUser(browser, vw = 1280, vh = 900) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
  await ctx.route(/fonts\.g|cloudflareinsights|accounts\.google\.com\/gsi/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return { ctx, page };
}
async function signInAs(page, who, from = '/try.html') {
  await page.goto(BASE + from); await page.waitForSelector('.nav-signin', { state: 'attached' });
  if (!(await page.isVisible('.nav-signin'))) { await page.click('#navToggle'); await page.waitForTimeout(250); } // phone: inside the ☰ menu
  await page.click('.nav-signin');
  await page.click('#as-' + who);
  await page.waitForSelector('.nav-account-btn', { state: 'attached' });
}

(async () => {
  const browser = await chromium.launch();

  console.log('\nVisitor');
  const V = await newUser(browser);
  await V.page.goto(BASE + '/'); await V.page.waitForSelector('.nav-signin');
  check('Header shows "Sign in"', await V.page.isVisible('.nav-signin'));
  check('Feedback button is on the page', await V.page.isVisible('.feedback-fab'));
  await V.page.click('.feedback-fab');
  check('Signed-out feedback asks to sign in first', (await V.page.textContent('.feedback-dialog')).includes('Sign in with Google'));
  await V.page.screenshot({ path: 'acc-feedback-signedout.png' });
  await V.page.keyboard.press('Escape');
  await V.page.goto(BASE + '/try.html'); await V.page.waitForTimeout(500);
  check('Try It says the week isn\'t saved + offers sign-in', (await V.page.textContent('#weekSaveStatus')).includes('Sign in to save it'));
  check('Visitor still sees Maya\'s sample week', (await V.page.$$('.week-event')).length > 10);
  const visitorApi = await V.page.evaluate(async () => [(await fetch('/api/me/weeks')).status, (await fetch('/api/admin/users')).status]);
  check('Visitor API calls to private/admin data are refused (401)', visitorApi[0] === 401 && visitorApi[1] === 401, visitorApi);
  await V.page.goto(BASE + '/admin.html'); await V.page.waitForTimeout(400);
  check('Visitor on admin.html sees "Admins only"', (await V.page.textContent('#adminRoot')).includes('Admins only'));

  console.log('\nUser A');
  const A = await newUser(browser);
  await signInAs(A.page, 'a');
  check('After sign-in, back on Try It with name in header', A.page.url().startsWith(BASE + '/try.html') && (await A.page.textContent('.nav-account-btn')).includes('Alex'));
  check('Sign-in notice shown and ?signin removed from URL', (await A.page.textContent('.tw-toast')).includes('signed in') && !A.page.url().includes('signin='));
  await A.page.waitForTimeout(400);
  check('Save status says changes save automatically', (await A.page.textContent('#weekSaveStatus')).includes('save automatically'));
  await A.page.fill('#quickAddTitle', 'Alex secret study block'); await A.page.fill('#quickAddStart', '15:00');
  await A.page.click('.quick-add-submit');
  await A.page.waitForFunction(() => document.getElementById('weekSaveStatus').textContent.includes('Saved'), null, { timeout: 5000 });
  check('Adding an event autosaves', true);
  await A.page.click('#realityExampleBtn'); await A.page.waitForTimeout(1800);
  await A.page.click('#replanExampleBtn'); await A.page.click('.replan-actions button'); await A.page.waitForTimeout(1800);
  await A.page.reload(); await A.page.waitForFunction(() => document.getElementById('weekSaveStatus').textContent.includes('Loaded'), null, { timeout: 5000 });
  const titles = await A.page.$$eval('.week-event-title', (els) => els.map((e) => e.textContent));
  check('Reload: saved week comes back (incl. my event)', titles.includes('Alex secret study block'));
  check('Reload: applied replan persisted (recruiter call added)', titles.includes('Call back internship recruiter'));
  const statuses = await A.page.$$eval('.week-event.is-done, .week-event.is-over, .week-event.is-skipped', (e) => e.length);
  check('Reload: reflection check-ins persisted', statuses >= 3, statuses);
  await A.page.screenshot({ path: 'acc-try-signedin.png' });

  // Feedback
  await A.page.click('.feedback-fab');
  await A.page.click('.feedback-types label:nth-of-type(2)');
  check('Feedback page auto-selects the right part of the site', (await A.page.$eval('.feedback-dialog select', (s) => s.value)) === 'your_week');
  await A.page.fill('.feedback-dialog textarea', 'I wasn\'t sure what "fixed" meant on the Replan blocks.');
  await A.page.click('.feedback-rating label:nth-of-type(4)');
  await A.page.screenshot({ path: 'acc-feedback-form.png' });
  await A.page.click('.feedback-form button[type=submit]');
  await A.page.waitForSelector('.feedback-thanks');
  check('Feedback sends and shows thanks', true);
  await A.page.keyboard.press('Escape');

  await A.page.goto(BASE + '/account.html'); await A.page.waitForSelector('#my-feedback .account-feedback');
  check('My account shows profile email', (await A.page.textContent('#accountRoot')).includes('user.a@example.com'));
  await A.page.click('#my-weeks summary'); await A.page.waitForSelector('.account-events li');
  check('My account lists the saved week with its blocks', (await A.page.textContent('#my-weeks')).includes('Alex secret study block'));
  check('My account shows my feedback as "Received"', (await A.page.textContent('#my-feedback')).includes('Received'));
  await A.page.screenshot({ path: 'acc-account.png', fullPage: true });
  await A.page.goto(BASE + '/admin.html'); await A.page.waitForTimeout(500);
  check('User A on admin.html is refused', (await A.page.textContent('#adminRoot')).includes("doesn't have admin access"));
  check('Admin link not in User A\'s menu', !(await A.page.$('a[href="admin.html"]')));
  const aApi = await A.page.evaluate(async () => ({
    users: (await fetch('/api/admin/users')).status,
    patch: (await fetch('/api/admin/feedback/1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"status":"resolved"}' })).status,
    forgedRole: (await (await fetch('/api/me/week?start=2000-01-03&role=admin')).json()).events
  }));
  check('User A calling admin APIs directly is refused (403)', aApi.users === 403 && aApi.patch === 403, aApi);

  console.log('\nUser B');
  const B = await newUser(browser);
  await signInAs(B.page, 'b');
  await B.page.waitForTimeout(600);
  const bTitles = await B.page.$$eval('.week-event-title', (els) => els.map((e) => e.textContent));
  check('User B does not see User A\'s saved week', !bTitles.includes('Alex secret study block'));
  await B.page.goto(BASE + '/account.html'); await B.page.waitForSelector('#my-weeks .empty-note, #my-weeks details');
  check('User B\'s account shows no saved weeks and no feedback', (await B.page.textContent('#my-weeks')).includes('Nothing saved yet') && (await B.page.textContent('#my-feedback')).includes("haven't sent"));

  console.log('\nAdmin');
  const O = await newUser(browser);
  await O.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await signInAs(O.page, 'owner', '/');
  const db = new DatabaseSync('/tmp/tw-local.sqlite');
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run('owner@example.com'); // the manual first-admin step
  await O.page.goto(BASE + '/admin.html'); await O.page.waitForSelector('#panel-overview .kpi');
  check('Admin dashboard loads on the Overview tab', (await O.page.textContent('#adminRoot')).includes('Admin dashboard') && await O.page.isVisible('#panel-overview'));
  check('Overview counts 1 real feedback item', (await O.page.textContent('#panel-overview .kpi')).trim().startsWith('1'));
  await O.page.click('#tab-inbox'); await O.page.waitForSelector('#panel-inbox .admin-feedback');
  const item = await O.page.textContent('#panel-inbox .admin-feedback');
  check('Inbox shows an anonymous tester code, not a name or email', /T-[0-9a-f]{5}/.test(item) && !item.includes('Alex') && !item.includes('user.a@'));
  check('Inbox defaults to Real feedback and shows a source badge', (await O.page.$eval('.admin-filters select', (s) => s.value)) === 'real' && item.includes('Real'));
  check('Journey stage is shown as inferred, not assumed', item.includes('(inferred)'));
  await O.page.selectOption('.admin-feedback-controls select >> nth=0', 'reviewing');
  await O.page.fill('.admin-notes textarea', 'Rename "Fixed" → "Can\'t move"');
  await O.page.click('.admin-feedback-controls .insight-save button');
  await O.page.waitForFunction(() => document.querySelector('.admin-feedback-controls .admin-save-msg').textContent.includes('Saved'));
  check('Admin can change status + add a private note', true);
  await O.page.selectOption('.admin-filters select >> nth=1', 'resolved'); await O.page.waitForTimeout(300);
  check('Inbox status filter works (no resolved items)', (await O.page.textContent('.admin-feedback-list')).includes('No real tester feedback matches'));
  await O.page.selectOption('.admin-filters select >> nth=1', ''); await O.page.waitForTimeout(300);

  // Log a manual observation
  await O.page.click('text=+ Log an observation');
  await O.page.fill('.insight-obs textarea', 'Watched a tester hover over "Fixed" for ~10 seconds before giving up.');
  await O.page.click('.insight-obs .insight-save button');
  await O.page.waitForFunction(() => document.querySelector('.insight-obs .admin-save-msg').textContent.includes('Saved'));
  check('Admin logs a manual observation', db.prepare("SELECT COUNT(*) n FROM feedback WHERE source = 'observation'").get().n === 1);

  // Create a problem
  await O.page.click('#tab-problems');
  await O.page.click('text=+ New problem');
  const pc = O.page.locator('#panel-problems .insight-card').first();
  await pc.locator('input').nth(0).fill('Replan: unclear which blocks can move');
  await pc.locator('input').nth(1).fill('Clarity');
  await pc.locator('select').nth(0).selectOption('now');
  await pc.locator('select').nth(1).selectOption('investigating');
  await pc.locator('textarea').nth(4).fill('1 real feedback item + 1 observation mention "Fixed"');
  await pc.locator('.insight-save button').click();
  await O.page.waitForFunction(() => /P-1 ·/.test(document.getElementById('panel-problems').textContent));
  check('Admin creates a problem', db.prepare('SELECT COUNT(*) n FROM problems').get().n === 1);

  // Link the feedback to the problem from the inbox
  await O.page.click('#tab-inbox'); await O.page.selectOption('.admin-filters select >> nth=0', ''); await O.page.waitForTimeout(400);
  const realCard = O.page.locator('.admin-feedback.source-real').first();
  await realCard.locator('.admin-feedback-controls select').nth(2).selectOption('1');
  await realCard.locator('.insight-save button').click();
  await O.page.waitForTimeout(500);
  const obsCard = O.page.locator('.admin-feedback.source-observation').first();
  await obsCard.locator('.admin-feedback-controls select').nth(2).selectOption('1');
  await obsCard.locator('.insight-save button').click();
  await O.page.waitForTimeout(500);
  check('Feedback + observation linked to the problem', db.prepare('SELECT COUNT(*) n FROM feedback WHERE problem_id = 1').get().n === 2);

  // Copy for AI analysis
  await O.page.click('text=Select all shown');
  await O.page.click('text=Copy selected for AI analysis');
  await O.page.waitForFunction(() => document.querySelector('.insight-copy-status').textContent.includes('Copied'));
  const clip = await O.page.evaluate(() => navigator.clipboard.readText());
  check('Export uses the Feedback Record Format', /Feedback ID: FB-\d+/.test(clip) && clip.includes('Journey Stage:') && clip.includes('Next Decision: Unknown / Not enough evidence'));
  check('Export labels sources and marks unknowns', clip.includes('Real user feedback') && clip.includes('Manual observation') && clip.includes('1 real tester feedback, 1 manual observation'));
  check('Export contains no names or emails', !/Alex|user\.a@|owner@/.test(clip));

  // Experiment + decision
  await O.page.click('#tab-experiments'); await O.page.click('text=+ New experiment');
  const ec = O.page.locator('#panel-experiments .insight-card').first();
  await ec.locator('input').nth(0).fill('Rename Fixed → Can\'t move');
  await ec.locator('select').nth(0).selectOption('1');
  await ec.locator('textarea').nth(0).fill('a clearer label reduces hesitation in Replan');
  await ec.locator('.insight-save button').click();
  await O.page.waitForFunction(() => /E-1 ·/.test(document.getElementById('panel-experiments').textContent));
  check('Admin creates an experiment linked to the problem', db.prepare('SELECT problem_id FROM experiments').get().problem_id === 1);
  await O.page.click('#tab-decisions'); await O.page.click('text=+ Log a decision');
  const dc = O.page.locator('#panel-decisions .insight-card').first();
  await dc.locator('input').nth(0).fill('Test a label change before redesigning Replan');
  await dc.locator('textarea').nth(1).fill('1 real feedback + 1 observation; weak evidence');
  await dc.locator('.insight-save button').click();
  await O.page.waitForFunction(() => document.getElementById('panel-decisions').textContent.includes('Test a label change'));
  check('Admin logs a decision', db.prepare('SELECT COUNT(*) n FROM decisions').get().n === 1);

  await O.page.click('#tab-overview'); await O.page.waitForTimeout(300);
  const ov = await O.page.textContent('#panel-overview');
  check('Overview lists the problem in Top user problems + its theme', ov.includes('P-1 · Replan') && ov.includes('Clarity'));
  check('Overview labels visitor counts as browser IDs, not people', ov.includes('not unique people'));
  await O.page.screenshot({ path: 'acc-admin.png', fullPage: true });
  await O.page.click('#tab-problems'); await O.page.locator('#panel-problems .insight-card summary').first().click(); await O.page.waitForTimeout(200);
  await O.page.screenshot({ path: 'acc-admin-problem.png', fullPage: true });
  await O.page.click('#tab-testers'); await O.page.waitForSelector('#panel-testers tbody tr');
  check('Testers tab lists 3 accounts', (await O.page.$$('#panel-testers tbody tr')).length === 3);
  check('Admin link appears in the owner\'s menu', !!(await O.page.$('a[href="admin.html"]')));
  await A.page.goto(BASE + '/account.html'); await A.page.waitForSelector('#my-feedback .account-feedback');
  const aFb = await A.page.textContent('#my-feedback');
  check('User A sees "Being reviewed" but not the private note', aFb.includes('Being reviewed') && !aFb.includes('Can\'t move'));
  check('User A never sees the observation', !aFb.includes('hover over'));

  console.log('\nSign out');
  await A.page.click('.nav-account-btn'); await A.page.click('.nav-account-menu button');
  await A.page.waitForURL(BASE + '/index.html'); await A.page.waitForSelector('.nav-signin');
  check('Sign out returns home and shows "Sign in"', true);
  const afterOut = await A.page.evaluate(async () => (await fetch('/api/me/weeks')).status);
  check('After sign-out, private data is refused', afterOut === 401);

  console.log('\nExisting site still works');
  const X = await newUser(browser);
  await X.page.goto(BASE + '/practice.html'); await X.page.click('#startPracticeBtn');
  check('Practice quiz starts', await X.page.isVisible('#screenQuiz'));
  await X.page.goto(BASE + '/try.html'); await X.page.click('#replanExampleBtn');
  check('Replan example works for visitors', (await X.page.$$('.replan-row')).length === 4);
  await X.page.goto(BASE + '/'); await X.page.click('text=In my head'); await X.page.click('#earlySubmit');
  await X.page.waitForSelector('#earlyThanks:not([hidden])');
  check('Early-access form still submits', true);
  await X.page.goto(BASE + '/about.html');
  check('About page renders', await X.page.isVisible('#storyboard'));

  console.log('\nMobile');
  const M = await newUser(browser, 390, 844);
  await signInAs(M.page, 'owner', '/');
  await M.page.click('#navToggle'); await M.page.waitForTimeout(300);
  await M.page.screenshot({ path: 'acc-mobile-menu.png' });
  check('Mobile menu shows account links inline', await M.page.isVisible('.nav-account-menu a[href="account.html"]'));
  await M.page.goto(BASE + '/admin.html'); await M.page.waitForSelector('#panel-overview .kpi');
  await M.page.screenshot({ path: 'acc-admin-mobile.png', fullPage: true });
  await M.page.click('#tab-problems'); await M.page.locator('#panel-problems .insight-card summary').first().click(); await M.page.waitForTimeout(200);
  const swp = await M.page.evaluate(() => document.documentElement.scrollWidth);
  check('Problems tab has no sideways scrolling on a phone', swp === 390, swp);
  const sw = await M.page.evaluate(() => document.documentElement.scrollWidth);
  check('Admin page has no sideways scrolling on a phone', sw === 390, sw);
  await M.page.goto(BASE + '/try.html'); await M.page.click('.feedback-fab'); await M.page.waitForTimeout(200);
  await M.page.screenshot({ path: 'acc-feedback-mobile.png' });

  const allErrors = [V, A, B, O, X, M].flatMap((u) => u.page.errors);
  check('No JavaScript errors on any page', allErrors.length === 0, allErrors);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log(fails.join('\n'));
  await browser.close();
})();
