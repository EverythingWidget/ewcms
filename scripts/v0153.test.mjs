// v0.1.53: the overlay's link layer (an svg as big as the page) is sized without counting
// itself, so going from a taller page to a shorter one doesn't keep the taller height.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/editor/overlay.js', import.meta.url), 'utf8');
const draw = src.slice(src.indexOf('function drawLinks()'), src.indexOf('const seen = new Set();'));

test('the link svg collapses before it reads the page size', () => {
  assert.match(draw, /const size = `\$\{body\.scrollWidth\}x\$\{body\.scrollHeight\}`/);
  const zero = draw.indexOf("els.links.setAttribute('height', 0)");
  const read = draw.indexOf("els.links.setAttribute('height', h.scrollHeight)");
  assert.ok(zero > 0 && read > zero);
});
