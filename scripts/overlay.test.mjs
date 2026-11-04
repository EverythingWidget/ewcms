// The preview overlay: boxes around what shows, the link layer, the edge handles and drags.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boxOf } from '../src/site/layout/geometry.js';
import { createStore } from '../src/editor/store.js';
import { addSection, placeWidget } from '../src/editor/layout-ops.js';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
const ov = readFileSync(new URL('../src/editor/overlay.js', import.meta.url), 'utf8');
const draw = ov.slice(ov.indexOf('function drawLinks()'), ov.indexOf('const seen = new Set();'));
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const F = 'pages/index.json';

test('boxes wrap what shows: a child over the edge counts, a clipping one does not', () => {
  const R = (left, top, w, h) => ({
    left,
    top,
    right: left + w,
    bottom: top + h,
    width: w,
    height: h,
  });
  const kid = { getBoundingClientRect: () => R(90, 100, 113, 40), children: [] };
  const el = { getBoundingClientRect: () => R(100, 100, 85, 40), children: [kid] };
  const win = { scrollX: 0, scrollY: 50, getComputedStyle: () => ({ overflow: 'visible' }) };
  assert.deepEqual(boxOf(el, win), { x: 90, y: 150, w: 113, h: 40 });
  const clip = { ...win, getComputedStyle: (n) => ({ overflow: n === el ? 'hidden' : 'visible' }) };
  assert.deepEqual(boxOf(el, clip), { x: 100, y: 150, w: 85, h: 40 });
  const ov = src('overlay.js');
  assert.doesNotMatch(ov, /rectOf\((sel|el|lead|n|hover)\b/, 'widgets boxed with boxOf');
});

test('links: kept paths by id, d set on change, no innerHTML; the loop idles', () => {
  const ov = src('overlay.js');
  const draw = ov.slice(ov.indexOf('function drawLinks'), ov.indexOf('function drawLinks') + 3000);
  assert.doesNotMatch(draw, /innerHTML/);
  assert.match(ov, /const linkEls = new Map\(\)/);
  assert.match(ov, /attr\(e\.line, 'd', d\)/);
  assert.match(ov, /if \(size !== svgSize\)/);
  assert.match(ov, /text-anchor', 'end'/, 'the gap label left of the line, clear of the tag');
  assert.match(ov, /anims > 0 \|\| now\(\) < idleUntil/);
  assert.match(ov, /new win\.MutationObserver\(kick\)/);
  assert.match(ov, /new win\.ResizeObserver\(kick\)/);
  assert.doesNotMatch(ov, /if \(shown\(\)\) raf = win\.requestAnimationFrame/);
});

test('the link svg collapses before it reads the page size', () => {
  assert.match(draw, /const size = `\$\{body\.scrollWidth\}x\$\{body\.scrollHeight\}`/);
  const zero = draw.indexOf("els.links.setAttribute('height', 0)");
  const read = draw.indexOf("els.links.setAttribute('height', h.scrollHeight)");
  assert.ok(zero > 0 && read > zero);
});

test("an Auto widget's top / bottom edge strips stay inside its box (the next widget stays clickable)", () => {
  const ov = src('overlay.js');
  assert.match(ov, /\.edge\[data-h='n'\], \.edge\[data-h='s'\] \{[^}]*height: 8px; translate: 0;/);
  assert.match(ov, /\.edge\[data-h='s'\] \{ top: 100%; translate: 0 -100%; \}/);
});

test("a selected widget's whole left / right edge resizes it", () => {
  const o = read('src/editor/overlay.js');
  assert.match(o, /<i class="edge" data-h="w"><\/i><i class="edge" data-h="e"><\/i>/);
  assert.match(o, /\.edge \{ position: absolute; top: 0; bottom: 0;[^}]*cursor: ew-resize; \}/);
});

test("every handle shows on a selected widget; an Auto one's height dragged: Rows", () => {
  const o = read('src/editor/overlay.js');
  assert.match(o, /\.sel\.is-free\.is-phone \.handle:not/); // hidden on the phone only
  assert.doesNotMatch(o, /\.sel\.is-free \.handle:not/);
  const store = createStore();
  store.load({ [F]: { version: 1, kind: 'page', id: 'pg-t145', sections: [] } });
  addSection(store, F, 'photo');
  const widget = () => store.current[F].sections[0].widgets[0];
  store.current[F].sections[0].widgets[0].size = undefined;
  placeWidget(store, F, 0, 0, { col: 1, span: 40, row: 1, rows: 20 }, undefined, { size: 'rows' });
  assert.equal(widget().size, 'rows');
  assert.equal(widget().layout.base.rows, 20);
});

test('the selected widget is dragged where widgets overlap; a click picks the top one', () => {
  const o = read('src/editor/overlay.js');
  assert.match(o, /const el = selectedUnder\(e, mod\) \|\| top;/);
  assert.match(o, /else if \(click\) \(setAnchor\(click\), onpick\(click\)\);/);
  // Size -> Rows from the shown rows (the phone's: doubled)
  assert.match(read('src/editor/widget-layout.js'), /phone \? n \* 2 : n/);
});

test('a link drag keeps the widget where it is (the gap: the rows between them)', () => {
  const o = read('src/editor/overlay.js');
  assert.match(o, /onlink\(id, near\.id, b\.row - \(a\.row \+ a\.rows\), \{ mobile: phone \}\)/);
  assert.doesNotMatch(o, /onlink\(id, near\.id, 0,/);
});
