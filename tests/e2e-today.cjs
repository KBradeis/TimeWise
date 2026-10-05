// Test-only: the redesigned Today view, walked through like a student would use it.
// Start tests/local-server.mjs first, then: node tests/e2e-today.cjs (needs Playwright).
// The clock is pinned to Monday 1:20 PM so "now" and "next" are predictable.
const { chromium } = require('playwright');
const BASE = 'http://localhost:8791';
let pass = 0, fail = 0; const fails = [];
const check = (n, ok, x) => { ok ? pass++ : (fail++, fails.push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''))); console.log((ok ? '  ✓ ' : '  ✗ ') + n); };

function mondayAt(h, m) {
  const d = new Date(); d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // this week's Monday
  return d;
}

async function open(browser, w, h, at) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.route(/fonts\.g|cloudflareinsights|accounts\.google\.com\/gsi/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  await page.clock.setFixedTime(at);
  await page.goto(BASE + '/try.html'); await page.waitForTimeout(500);
  return { ctx, page };
}
const texts = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));

(async () => {
  const browser = await chromium.launch();

  console.log('\nReview today (Maya, Monday 1:20 PM)');
  const { page } = await open(browser, 1280, 900, mondayAt(13, 20));
  check('Today is the first thing on the page', await page.isVisible('#todayList') && (await page.textContent('#todayTitle')).includes('Monday'));
  check('Sample-week note says this is Maya\'s week', await page.isVisible('#todaySampleNote'));
  const next = await page.textContent('.today-item.is-next');
  check('The next block (2:00 shift) is highlighted as Next', next.includes('Shift at Campus Café') && next.includes('starts in 40 min'), next);
  check('Exactly one block gets the coral treatment', (await page.$$('.today-item.is-next, .today-item.is-now')).length === 1);
  check('A "now" line is drawn', await page.isVisible('.today-now-time') && (await page.textContent('.today-now-time')) === '1:20');
  check('Free time after the shift is shown, with a hint about the next deadline', (await page.textContent('.today-free')).includes('Econ problem set'));
  const glance = await page.textContent('#todayGlance');
  check('At a glance: free time before 11 PM and hours planned today', /free before 11 PM/.test(glance) && /planned today/.test(glance), glance);

  console.log('\nLook ahead');
  const heads = await page.textContent('#todayHeadsUp');
  check('Heads up: Thursday overlap is flagged', /Thursday .*overlaps/.test(heads), heads);
  check('Heads up: Wednesday is packed', heads.includes('Wednesday is packed'), heads);
  check('Week strip has 7 days, today outlined, Wednesday marked packed', (await page.$$('.load-day')).length === 7 && !!(await page.$('.load-day.is-today')) && !!(await page.$('.load-day.is-packed')));
  check('Week strip says how much time is blocked for the next deadline', (await page.textContent('#weekLoadNote')).includes('is due Thursday'));
  check('Overlapping blocks are marked in the week grid', (await page.$$('.week-event.is-conflict')).length === 2);

  console.log('\nMark complete, miss a task, recover');
  const pastBtns = await page.$$('.today-item.is-past .today-check-btn');
  check('Blocks that already ended ask how they went', pastBtns.length === 4, pastBtns.length);
  await page.click('.today-item.is-past:nth-child(1) .today-check-btn:has-text("Done")');
  check('"Done" marks the lecture done', (await page.textContent('.today-item.is-past')).includes('✓ Done'));
  await page.click('.today-item.is-past:has-text("Econ problem set") .today-check-btn:has-text("Didn\'t happen")');
  const missed = await page.textContent('#todayHeadsUp');
  check('A missed block gets a no-guilt recovery offer', missed.includes("Econ problem set didn't happen today. That's fine."), missed);
  check('Plan vs. Reality picked up the same check-ins', (await page.$$('.reality-choice.is-skipped[aria-pressed="true"]')).length === 1);
  const putBack = await page.$('.headsup.is-missed .link-btn');
  const label = await putBack.textContent();
  await putBack.click();
  check('"Put it on …" adds it back at a free time', /Put it on (Today|Tue|Wed|Thu|Fri|Sat|Sun) /.test(label) && (await page.textContent('#todayAnnounce')).includes('is back on'), label);
  check('…and the offer goes away', !(await page.textContent('#todayHeadsUp')).includes("didn't happen today"));

  console.log('\nAdd a task and a conflict');
  await page.click('#todayAddBtn'); await page.waitForTimeout(500);
  check('"+ Add" takes you to the add form and focuses it', await page.evaluate(() => document.activeElement && document.activeElement.id === 'quickAddTitle'));
  await page.fill('#quickAddTitle', 'Advising appointment');
  await page.selectOption('#quickAddCategory', 'personal');
  await page.fill('#quickAddStart', '16:00'); await page.fill('#quickAddEnd', '16:30');
  await page.click('.quick-add-submit'); await page.waitForTimeout(200);
  check('New event shows up in Today', (await texts(page, '.today-title')).some((t) => t.includes('Advising appointment')));
  check('It overlaps the shift, so Today warns about it', (await page.textContent('#todayHeadsUp')).includes('Advising appointment overlaps Shift at Campus Café'));

  console.log('\nReschedule (running behind)');
  await page.click('#todayBehindBtn'); await page.waitForTimeout(400);
  check('"I\'m running behind" opens Replan set to today', (await page.inputValue('#replanDay')) === '0');

  console.log('\nEmpty state');
  await page.click('#weekClearBtn'); await page.waitForTimeout(200);
  check('Empty week explains what to do next', (await page.textContent('#todayList')).includes('Your week is empty.'));
  await page.click('.today-empty-actions button');
  check('"Show Maya\'s sample week" brings it back', (await page.$$('.today-item')).length > 3);
  check('No page errors (desktop)', page.errors.length === 0, page.errors);

  console.log('\nPhone');
  const M = await open(browser, 390, 844, mondayAt(13, 20));
  check('Bottom tab bar is visible on a phone', await M.page.isVisible('#appTabs') && (await M.page.$eval('#appTabs', (e) => getComputedStyle(e).position)) === 'fixed');
  check('No sideways scrolling', (await M.page.evaluate(() => document.documentElement.scrollWidth)) === 390);
  check('Next block is visible without scrolling', await M.page.evaluate(() => document.querySelector('.today-item.is-next').getBoundingClientRect().bottom < innerHeight));
  await M.page.click('#appTabs a[href="#calendars"]'); await M.page.waitForTimeout(900);
  check('Week tab jumps to the week, which is a vertical day list', (await M.page.$eval('#weekGrid', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 1);
  check('Week tab becomes the active tab', (await M.page.getAttribute('#appTabs a[href="#calendars"]', 'aria-current')) === 'true');
  check('Action buttons fit on one line each', await M.page.evaluate(() => [...document.querySelectorAll('.today-actions .btn')].every((b) => b.getBoundingClientRect().height < 56)));
  await M.page.screenshot({ path: 'rd-mobile-week.png' });
  check('No page errors (phone)', M.page.errors.length === 0, M.page.errors);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();
