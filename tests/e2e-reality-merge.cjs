// Test-only: Plan vs. Reality has one "Skipped" choice (Swapped merged in). Start tests/local-server.mjs first.
const { chromium } = require('playwright');
const BASE = 'http://localhost:8791';
let pass = 0, fail = 0; const fails = [];
const check = (n, ok, x) => { ok ? pass++ : (fail++, fails.push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''))); console.log((ok ? '  ✓ ' : '  ✗ ') + n); };
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    console.log(`\n${w}px`);
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/fonts\.g|accounts\.google\.com\/gsi/, (r) => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/try.html'); await p.waitForTimeout(500);
    const labels = await p.$$eval('.reality-item:first-child .reality-choice', (els) => els.map((e) => e.textContent.trim()));
    check('Each block has 3 choices: Done, Ran over, Skipped', JSON.stringify(labels) === JSON.stringify(['✓ Done', '⏱ Ran over', '✕ Skipped']), labels);
    check('No "Swapped" anywhere on the page', !(await p.textContent('body')).includes('Swapped'));
    await p.click('.reality-item:first-child .reality-choice.is-skipped');
    check('Skipped asks what got in the way', await p.isVisible('.reality-item:first-child .reality-detail select'));
    await p.click('#realityExampleBtn'); await p.waitForTimeout(1800);
    const legend = await p.textContent('.reality-bar-legend');
    check('Example reflection works, counts skipped together', /Skipped 2/.test(legend) && !/Swapped/.test(legend), legend);
    check('Reflection still detects the cascade', (await p.textContent('#realityResult')).includes('chain reaction'));
    const rowOk = await p.$eval('.reality-item:first-child .reality-choices', (el) => { const r = [...el.children].map((c) => c.getBoundingClientRect().top); return r.every((t) => t === r[0]); });
    check('The 3 buttons sit on one row', rowOk);
    check('No sideways scrolling', !(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
    await p.locator('.reality-item').first().scrollIntoViewIfNeeded();
    await p.screenshot({ path: `rm-${w}.png` });
    check('No page errors', errs.length === 0, errs);
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();
