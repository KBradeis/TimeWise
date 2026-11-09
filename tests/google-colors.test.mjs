// Test-only. Checks the "Google Calendar colors as results" rules in script.js
// (the block between the google-color-rules markers). Run: node tests/google-colors.test.mjs
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../script.js', import.meta.url), 'utf8');
const m = src.match(/\/\/ >>> google-color-rules[^\n]*\n([\s\S]*?)\/\/ <<< google-color-rules/);
if (!m) { console.log('FAIL: rules block not found in script.js'); process.exit(1); }
const { googleColorResult, suggestResultColors, validResultColors } = new Function(m[1] + '\nreturn { googleColorResult, suggestResultColors, validResultColors };')();

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('FAIL: ' + name); } };
const now = new Date('2026-11-09T13:00:00');
const past = new Date('2026-11-09T11:00:00');
const future = new Date('2026-11-09T15:00:00');

ok(googleColorResult('10', past, now)?.status === 'done', 'Basil after the block = done');
ok(googleColorResult('2', past, now) === null, 'Sage is not a default result color');
ok(googleColorResult('8', past, now)?.status === 'skipped', 'Graphite after the block = skipped');
ok(googleColorResult(10, past, now)?.status === 'done', 'numeric color ids work too');
ok(googleColorResult('10', future, now) === null, 'not over yet = not marked, even if green');
ok(googleColorResult('8', future, now) === null, 'not over yet = not marked, even if grey');
ok(googleColorResult('10', now, now)?.status === 'done', 'ends exactly now = counts');
for (const c of ['1', '2', '3', '4', '5', '6', '7', '9', '11', '', null, undefined])
  ok(googleColorResult(c, past, now) === null, 'color ' + String(c) + ' = not marked');
ok(googleColorResult('10', new Date('nope'), now) === null, 'bad end time = not marked');
ok(googleColorResult('10', null, now) === null, 'missing end time = not marked');
const r = googleColorResult('8', past, now);
ok(r && r.detail === '', 'skipped has an empty reason (the server accepts that)');

// Personal colors
const mine = { done: '7', skipped: '5' }; // Peacock, Banana
ok(googleColorResult('7', past, now, mine)?.status === 'done', 'custom done color');
ok(googleColorResult('5', past, now, mine)?.status === 'skipped', 'custom skipped color');
ok(googleColorResult('10', past, now, mine) === null, 'default green no longer counts once custom colors are set');
ok(googleColorResult('8', past, now, mine) === null, 'default grey no longer counts once custom colors are set');
ok(googleColorResult('7', future, now, mine) === null, 'custom color on an upcoming block = not marked');
ok(googleColorResult('10', past, now, { done: '7', skipped: '7' })?.status === 'done', 'invalid pair (same color twice) falls back to defaults');
ok(googleColorResult('10', past, now, { done: '99', skipped: '8' })?.status === 'done', 'unknown color id falls back to defaults');
ok(validResultColors({ done: '7', skipped: '5' }) && !validResultColors({ done: '7', skipped: '7' }) && !validResultColors(null), 'pair validation');

// Suggestions
const red = ['4', '6', '11']; // Flamingo, Tangerine, Tomato
let sg = suggestResultColors({});
ok(sg.done === '10' && sg.skipped === '8', 'nothing in use: suggests the defaults');
sg = suggestResultColors({ '10': 4 });
ok(sg.done !== '10' && sg.done === '2', 'Basil in use: suggests Sage for done');
sg = suggestResultColors({ '10': 2, '2': 1, '8': 3 });
ok(sg.done === '7' && sg.skipped === '5', 'Basil, Sage and Graphite in use: Peacock + Banana');
for (let mask = 0; mask < 2048; mask++) {
  const used = {}; for (let i = 0; i < 11; i++) if (mask & (1 << i)) used[String(i + 1)] = 1;
  const r2 = suggestResultColors(used);
  if (!validResultColors(r2)) { ok(false, 'valid pair for mask ' + mask); break; }
  if (red.includes(r2.skipped)) { ok(false, 'never red for skipped (mask ' + mask + ')'); break; }
  const anyFreeDone = ['10', '2', '7', '9', '1'].some((id) => !used[id]);
  if (anyFreeDone && used[r2.done]) { ok(false, 'suggested an in-use done color (mask ' + mask + ')'); break; }
}
ok(true, 'all 2048 combinations of used colors give a valid, non-red, unused-when-possible pair');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
