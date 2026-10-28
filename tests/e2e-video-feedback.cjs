// Test-only: the how-to video dialog, its anonymous counts, and "Was this video clear?" feedback.
// Start tests/local-server.mjs first, then: node tests/e2e-video-feedback.cjs (needs Playwright).
const { chromium } = require('playwright');
const { DatabaseSync } = require('node:sqlite');
const BASE = 'http://localhost:8791';
let pass = 0, fail = 0; const fails = [];
const check = (n, ok, x) => { ok ? pass++ : (fail++, fails.push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''))); console.log((ok ? '  ✓ ' : '  ✗ ') + n); };

async function newUser(browser, w = 1280, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.route(/fonts\.g|cloudflareinsights|accounts\.google\.com\/gsi/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message));
  page.tracked = []; page.on('request', (r) => { if (r.url().endsWith('/api/track')) { try { page.tracked.push(JSON.parse(r.postData()).event); } catch (e) {} } });
  return { ctx, page };
}
const db = () => new DatabaseSync('/tmp/tw-local.sqlite', { readOnly: true });
const visitorOf = (page) => page.evaluate(() => localStorage.getItem('timewise-visitor-id'));

(async () => {
  const browser = await chromium.launch();

  console.log('\nServer accepts the setup and video counts');
  const S = await newUser(browser);
  await S.page.goto(BASE + '/');
  const codes = await S.page.evaluate(async () => {
    const out = {};
    for (const ev of ['setup_classes_added', 'setup_google_clicked', 'video_opened', 'video_half', 'video_completed', 'video_cta_clicked', 'made_up_event']) {
      const r = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId: 'test-visitor-0001', event: ev }) });
      out[ev] = r.status;
    }
    return out;
  });
  check('All six new events are accepted (204)', ['setup_classes_added', 'setup_google_clicked', 'video_opened', 'video_half', 'video_completed', 'video_cta_clicked'].every((e) => codes[e] === 204), codes);
  check('Unknown events are still rejected (400)', codes.made_up_event === 400, codes.made_up_event);

  console.log('\nVisitor watches the video (signed out)');
  const V = await newUser(browser);
  await V.page.goto(BASE + '/'); await V.page.waitForSelector('.nav-signin', { state: 'attached' });
  check('No video count on page load', !V.page.tracked.some((e) => e.startsWith('video_')), V.page.tracked);
  await V.page.click('#howToVideoBtn'); await V.page.waitForTimeout(600);
  check('Opening the video counts video_opened once', V.page.tracked.filter((e) => e === 'video_opened').length === 1, V.page.tracked);
  check('"Was this video clear?" is shown where feedback works', await V.page.isVisible('#howToVideoFeedbackBtn'));
  // The local test server doesn't answer range requests, so play through at 16x instead of seeking
  await V.page.evaluate(() => { const v = document.getElementById('howToVideo'); v.muted = true; v.playbackRate = 16; return v.play(); });
  await V.page.waitForFunction(() => document.getElementById('howToVideo').currentTime > 44, null, { timeout: 15000 });
  await V.page.waitForTimeout(300);
  check('Passing halfway counts video_half', V.page.tracked.includes('video_half'), V.page.tracked);
  check('Halfway counted only once per page', V.page.tracked.filter((e) => e === 'video_half').length === 1, V.page.tracked);
  await V.page.waitForFunction(() => document.getElementById('howToVideo').ended, null, { timeout: 15000 });
  await V.page.waitForTimeout(300);
  check('Reaching the end counts video_completed', V.page.tracked.includes('video_completed'), V.page.tracked);
  await V.page.click('#howToVideoFeedbackBtn'); await V.page.waitForTimeout(400);
  check('Feedback link closes the video', !(await V.page.$eval('#howToVideoDialog', (d) => d.open)));
  check('Video is paused after closing', await V.page.$eval('#howToVideo', (v) => v.paused));
  check('Signed out: the existing sign-in prompt opens', await V.page.isVisible('.feedback-dialog .feedback-intro') && (await V.page.textContent('.feedback-dialog')).includes('Sign in with Google'));
  await V.page.keyboard.press('Escape');
  const vid = await visitorOf(V.page);
  const rows = db().prepare("SELECT event FROM events WHERE visitor_id = ? AND event LIKE 'video_%' ORDER BY event").all(vid).map((r) => r.event);
  check('Counts stored anonymously, once each', JSON.stringify(rows) === JSON.stringify(['video_completed', 'video_half', 'video_opened']), rows);
  await V.page.click('#howToVideoBtn'); await V.page.waitForTimeout(300);
  await Promise.all([V.page.waitForURL(/try\.html/), V.page.click('#howToVideoCta')]);
  await V.page.waitForTimeout(400);
  check('Start my week under the video counts video_cta_clicked', db().prepare("SELECT 1 FROM events WHERE visitor_id = ? AND event = 'video_cta_clicked'").get(vid) !== undefined);
  check('No page errors (visitor)', V.page.errors.length === 0, V.page.errors);

  console.log('\nSigned-in tester sends feedback about the video');
  const A = await newUser(browser);
  await A.page.goto(BASE + '/'); await A.page.waitForSelector('.nav-signin', { state: 'attached' });
  await A.page.click('.nav-signin'); await A.page.click('#as-a'); await A.page.waitForSelector('.nav-account-btn', { state: 'attached' });
  if (!A.page.url().endsWith('/') && !A.page.url().includes('index')) await A.page.goto(BASE + '/');
  await A.page.click('#howToVideoBtn'); await A.page.waitForTimeout(300);
  await A.page.click('#howToVideoFeedbackBtn'); await A.page.waitForTimeout(400);
  check('Form opens with "How-to video" preselected', (await A.page.$eval('.feedback-dialog select', (s) => s.value)) === 'how_to_video');
  const opts = await A.page.$$eval('.feedback-dialog select option', (o) => o.map((x) => x.textContent));
  check('Part-of-site list uses current names', ['Today', 'Week', 'Look back', 'Why TimeWise', 'Setting up my week', 'How-to video'].every((t) => opts.includes(t)) && !opts.includes('Plan vs. Reality'), opts);
  await A.page.click('.feedback-types label:nth-of-type(2)');
  await A.page.fill('.feedback-dialog textarea', 'Test: the video moved a bit fast in the Replan part.');
  await A.page.click('.feedback-dialog button[type=submit]'); await A.page.waitForSelector('.feedback-thanks');
  const fb = db().prepare("SELECT feature, category FROM feedback ORDER BY id DESC LIMIT 1").get();
  check('Feedback stored with feature how_to_video', fb && fb.feature === 'how_to_video' && fb.category === 'confusing', fb);
  await A.page.keyboard.press('Escape');
  await A.page.click('.feedback-fab'); await A.page.waitForTimeout(300);
  check('Opening Feedback normally does not keep the video preselected', (await A.page.$eval('.feedback-dialog select', (s) => s.value)) === 'home');
  check('No page errors (tester)', A.page.errors.length === 0, A.page.errors);

  console.log('\nPhone');
  const M = await newUser(browser, 390, 844);
  await M.page.goto(BASE + '/'); await M.page.waitForSelector('.nav-signin', { state: 'attached' });
  await M.page.click('#howToVideoBtn'); await M.page.waitForTimeout(400);
  check('No sideways scrolling with the dialog open', (await M.page.evaluate(() => document.documentElement.scrollWidth)) === 390);
  const box = await M.page.locator('#howToVideoFeedbackBtn').boundingBox();
  check('Feedback link is at least 40px tall and inside the screen', box && box.height >= 40 && box.x + box.width <= 390, box);
  await M.page.screenshot({ path: 'video-feedback-phone.png' });

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();
