// Waits that never hang (src/editor/lib/settle.js): Add widget waits for the preview to settle
// before it adds the widget; in a background tab (no frames painted) that wait used to never end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { frameOr, within } from '../src/editor/lib/settle.js';

test('frameOr: the next frame when there is one', async () => {
  let asked = 0;
  const win = { requestAnimationFrame: (f) => (asked++, setTimeout(f, 1)) };
  const t = Date.now();
  await frameOr(win, 1000);
  assert.equal(asked, 1);
  assert.ok(Date.now() - t < 500);
});

test('frameOr: a background tab (no frame ever) still goes on after the time', async () => {
  const win = { requestAnimationFrame: () => {} }; // never called back
  const t = Date.now();
  await frameOr(win, 30);
  assert.ok(Date.now() - t >= 25);
});

test('within: a render that never answers, or fails, ends the wait', async () => {
  const t = Date.now();
  await within(new Promise(() => {}), 30);
  assert.ok(Date.now() - t >= 25);
  await within(Promise.reject(new Error('render failed')), 1000); // no throw
  assert.equal(await within(Promise.resolve(1), 1000), 1);
});

test('the preview settled (Add widget) waits with frameOr and within, not a bare requestAnimationFrame', () => {
  const main = readFileSync(new URL('../src/editor/main.js', import.meta.url), 'utf8');
  const settled = main.match(/hooks\.settled = async \(\) => \{[\s\S]*?\n\};/)[0];
  assert.match(settled, /await within\(/);
  assert.match(settled, /await frameOr\(win\)/);
  assert.doesNotMatch(settled, /requestAnimationFrame/);
});
