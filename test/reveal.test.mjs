// Reveals: one at the very end of the page plays (every scroll position clamped).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('a reveal at the very end of the page plays: every scroll position clamped', () => {
  const t = readFileSync(new URL('../src/client/anim/types.js', import.meta.url), 'utf8');
  assert.match(
    t,
    /const reach = \(pos\) =>\s+typeof pos === 'string' && !pos\.startsWith\('clamp\('\) \? `clamp\(\$\{pos\}\)` : pos;/,
  );
});
