// Reveals: one at the very end of the page plays (every scroll position clamped); scroll
// reveals fade with opacity and play when on screen at load (F42, F48).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test('a reveal at the very end of the page plays: every scroll position clamped', () => {
  const t = readFileSync(new URL('../src/client/anim/types.js', import.meta.url), 'utf8');
  assert.match(
    t,
    /const reach = \(pos\) =>\s+typeof pos === 'string' && !pos\.startsWith\('clamp\('\) \? `clamp\(\$\{pos\}\)` : pos;/,
  );
});

test('a scroll reveal fades with opacity, so waiting content stays in the page text (F42)', () => {
  const t = read('client/anim/types.js');
  assert.match(t, /const readable = \(spec, vars\) =>/);
  assert.match(t, /return \{ \.\.\.rest, opacity: autoAlpha \};/);
  assert.equal((t.match(/readable\(spec, spec\.(from|to)\)/g) || []).length, 4);
});

test('a one-shot scroll reveal already on screen at load plays without scrolling (F48)', () => {
  const t = read('client/anim/types.js');
  assert.match(
    t,
    /if \(self\.start <= 0 && self\.scroll\(\) <= 0 && !self\.animation\?\.progress\(\)\)/,
  );
  assert.match(t, /\{ trigger, start, once: true, onRefresh \}/);
});
