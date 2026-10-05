// Test-only browser checks for "Copy last week", the Work category and "Customize colors".
// Start tests/local-server.mjs first (fresh /tmp/tw-local.sqlite), then: node tests/e2e-week-tools.cjs (needs Playwright).
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
async function signInAs(page, who) {
  await page.goto(BASE + '/try.html'); await page.waitForSelector('.nav-signin', { state: 'attached' });
  if (!(await page.isVisible('.nav-signin'))) { await page.click('#navToggle'); await page.waitForTimeout(250); }
  await page.click('.nav-signin');
  await page.click('#as-' + who);
  await page.waitForSelector('.nav-account-btn', { state: 'attached' });
  await page.waitForFunction(() => /save automatically|Loaded/.test(document.getElementById('weekSaveStatus').textContent), null, { timeout: 5000 });
}
const borderOf = (page, title) => page.$$eval('.week-event', (els, t) => {
  const el = els.find((e) => e.querySelector('.week-event-title').textContent === t);
  return el ? { cls: el.className, border: getComputedStyle(el).borderLeftColor } : null;
}, title);
const status = (page) => page.textContent('#weekSaveStatus');

(async () => {
  const browser = await chromium.launch();

  console.log('\nWork category + colors (visitor)');
  const V = await newUser(browser);
  await V.page.goto(BASE + '/try.html'); await V.page.waitForTimeout(500);
  check('Copy last week is hidden when signed out', !(await V.page.isVisible('#weekCopyBtn')));
  check('Legend lists Work', (await V.page.textContent('.week-grid-legend')).includes('Work'));
  check('Quick-add offers a Work type', (await V.page.$$eval('#quickAddCategory option', (o) => o.map((x) => x.value))).includes('work'));
  await V.page.fill('#quickAddTitle', 'Library desk'); await V.page.selectOption('#quickAddCategory', 'work'); await V.page.fill('#quickAddStart', '14:00');
  await V.page.click('.quick-add-submit');
  let chip = await borderOf(V.page, 'Library desk');
  check('Work event gets the Work style (teal)', chip && chip.cls.includes('week-event-work') && chip.border === 'rgb(13, 148, 136)', chip);
  const d = new Date(); const p = (n) => String(n).padStart(2, '0'); const ds = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Campus job shift\r\nDTSTART:${ds}T090000\r\nDTEND:${ds}T120000\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:2\r\nSUMMARY:Workout\r\nDTSTART:${ds}T070000\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  await V.page.setInputFiles('#icsFileInput', { name: 't.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics) });
  await V.page.waitForTimeout(400);
  check('Imported "Campus job shift" is guessed as Work', ((await borderOf(V.page, 'Campus job shift')) || {}).cls.includes('week-event-work'));
  check('Imported "Workout" is NOT guessed as Work', !((await borderOf(V.page, 'Workout')) || { cls: 'week-event-work' }).cls.includes('week-event-work'));

  check('Color panel starts closed', !(await V.page.isVisible('#colorSettingsGrid')));
  await V.page.click('#colorSettings summary');
  check('Color panel has 5 category pickers', (await V.page.$$('#colorSettingsGrid input[type=color]')).length === 5);
  await V.page.$eval('input[data-category="work"]', (i) => { i.value = '#e11d48'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  chip = await borderOf(V.page, 'Library desk');
  check('Changing Work color recolors Work events right away', chip.border === 'rgb(225, 29, 72)', chip);
  const legendDot = await V.page.$eval('.week-legend-dot.week-event-work', (e) => getComputedStyle(e).borderLeftColor);
  check('Legend follows the new color', legendDot === 'rgb(225, 29, 72)', legendDot);
  await V.page.screenshot({ path: 'wt-colors-desktop.png', fullPage: false });
  await V.page.reload(); await V.page.waitForTimeout(500);
  const afterReload = await V.page.$eval('.week-legend-dot.week-event-work', (e) => getComputedStyle(e).borderLeftColor);
  check('Custom color is remembered after reload', afterReload === 'rgb(225, 29, 72)', afterReload);
  check('Only the changed color is stored', (await V.page.evaluate(() => localStorage.getItem('timewise-category-colors'))) === '{"work":"#e11d48"}');
  await V.page.evaluate(() => localStorage.setItem('timewise-category-colors', '{"class":"red;}body{display:none","work":"#123"}'));
  await V.page.reload(); await V.page.waitForTimeout(500);
  const bad = await V.page.$eval('.week-legend-dot.week-event-class', (e) => getComputedStyle(e).borderLeftColor);
  check('Invalid stored colors are ignored (defaults used)', bad === 'rgb(108, 92, 231)' && (await V.page.isVisible('body')), bad);
  await V.page.click('#colorSettings summary'); await V.page.click('#colorResetBtn');
  const reset = await V.page.$eval('.week-legend-dot.week-event-work', (e) => getComputedStyle(e).borderLeftColor);
  check('Reset restores default colors and clears storage', reset === 'rgb(13, 148, 136)' && (await V.page.evaluate(() => localStorage.getItem('timewise-category-colors'))) === null, reset);
  check('No page errors (visitor)', V.page.errors.length === 0, V.page.errors);

  console.log('\nCopy last week (signed in)');
  const A = await newUser(browser);
  await signInAs(A.page, 'a');
  check('Copy last week button shows when signed in', await A.page.isVisible('#weekCopyBtn'));
  await A.page.click('#weekCopyBtn');
  await A.page.waitForFunction(() => /No earlier week/.test(document.getElementById('weekSaveStatus').textContent), null, { timeout: 5000 });
  check('With nothing saved before, it says so', true);

  const lastWeek = await A.page.evaluate(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const seed = await A.page.evaluate(async (week) => (await fetch('/api/me/week', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekStart: week, events: [
      { title: 'Weekly chem lab', dayIndex: 1, startMinutes: 600, endMinutes: 720, allDay: false, category: 'class', source: 'manual', reality: { status: 'over', detail: 30 } },
      { title: 'Library desk shift', dayIndex: 3, startMinutes: 960, endMinutes: 1140, allDay: false, category: 'work', source: 'manual', reality: null },
      { title: 'Study block (TimeWise)', dayIndex: 2, startMinutes: 1200, endMinutes: 1260, allDay: false, category: 'timewise', source: 'timewise', reality: null },
      { title: 'Google-only dentist', dayIndex: 4, startMinutes: 540, endMinutes: 600, allDay: false, category: 'personal', source: 'google', reality: null }
    ] })
  })).status, lastWeek);
  check('Seeded a saved week for last week', seed === 200, seed);

  await A.page.click('#weekCopyBtn');
  await A.page.waitForFunction(() => /Copied|already/.test(document.getElementById('weekSaveStatus').textContent), null, { timeout: 5000 });
  const msg = await status(A.page);
  check('Copies 3 blocks and explains connected events were skipped', msg.includes('Copied 3 blocks') && msg.includes("weren't copied"), msg);
  let titles = await A.page.$$eval('.week-event-title', (els) => els.map((e) => e.textContent));
  check('Copied events are on the grid', ['Weekly chem lab', 'Library desk shift', 'Study block (TimeWise)'].every((t) => titles.includes(t)), titles);
  check('Google event was not copied', !titles.includes('Google-only dentist'));
  check("Maya's sample week was cleared", titles.length === 3, titles.length);
  const labChip = await borderOf(A.page, 'Weekly chem lab');
  check('Last week\'s check-in (ran over) is not copied', !/is-over/.test(labChip.cls), labChip.cls);
  await A.page.waitForFunction(() => /Saved/.test(document.getElementById('weekSaveStatus').textContent), null, { timeout: 5000 });
  check('Copied week autosaves', true);

  await A.page.click('#weekCopyBtn');
  await A.page.waitForFunction(() => /already on your grid/.test(document.getElementById('weekSaveStatus').textContent), null, { timeout: 5000 });
  check('Copying twice does not duplicate', (await A.page.$$('.week-event')).length === 3);

  await A.page.reload();
  await A.page.waitForFunction(() => /Loaded/.test(document.getElementById('weekSaveStatus').textContent), null, { timeout: 5000 });
  titles = await A.page.$$eval('.week-event-title', (els) => els.map((e) => e.textContent));
  check('After reload the copied week is still there', titles.length === 3 && titles.includes('Library desk shift'), titles);
  check('No page errors (signed in)', A.page.errors.length === 0, A.page.errors);

  console.log('\nPhone layout');
  const M = await newUser(browser, 390, 844);
  await signInAs(M.page, 'a');
  await M.page.click('#colorSettings summary');
  const overflow = await M.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check('No sideways scrolling on a phone', !overflow);
  await M.page.locator('.week-grid-header').scrollIntoViewIfNeeded();
  await M.page.screenshot({ path: 'wt-mobile-header.png' });
  await M.page.locator('#colorSettings').scrollIntoViewIfNeeded();
  await M.page.screenshot({ path: 'wt-mobile-colors.png' });

  console.log('\nTracking');
  const db = new DatabaseSync('/tmp/tw-local.sqlite');
  const ev = db.prepare("SELECT event, COUNT(*) n FROM events WHERE event IN ('week_copied','colors_customized') GROUP BY event").all();
  const got = Object.fromEntries(ev.map((r) => [r.event, r.n]));
  check('week_copied and colors_customized were counted', got.week_copied >= 1 && got.colors_customized >= 1, got);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log('\nFailures:\n' + fails.join('\n')); process.exit(1); }
})();
