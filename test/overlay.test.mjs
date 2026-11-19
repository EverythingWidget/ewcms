// The preview overlay: boxes around what shows, the link layer, the edge handles and drags.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boxOf } from '../src/render/layout/geometry.js';
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
  assert.match(o, /onlink\(id, near\.id, b\.row - \(a\.row \+ a\.rows\), \{ phone \}\)/);
  assert.doesNotMatch(o, /onlink\(id, near\.id, 0,/);
});

test("a press on a widget's link or button only picks it: no pressed look, Alt still clicks through", () => {
  const b = src('preview-runtime.js');
  const css = b.slice(
    b.indexOf('const INJECTED_CSS'),
    b.indexOf('`;', b.indexOf('const INJECTED_CSS')),
  );
  const rule = css
    .split('\n')
    .find((l) => l.includes('pointer-events: none;') && l.includes('[data-widget] :is(a, button'));
  assert.ok(rule, "the injected CSS takes the pointer off a widget's links and buttons");
  // only with arrange or animate clicks (visitor clicks press as on the site), never while Alt is held
  assert.match(rule, /^html:is\(\.__ed-arrange, \.__ed-animate\):not\(\.__ed-alt\) /);
  // an animated element stays pickable (animate clicks), a text being typed stays clickable
  assert.match(
    rule,
    /:not\(\[data-anim\], :has\(\[data-anim\], \[contenteditable\]\), \[contenteditable\] \*\)/,
  );
  assert.match(src('preview-pointer.js'), /classList\.toggle\('__ed-alt', !!e\.altKey\)/);
  // the site's own styles are untouched: the press look stays for visitors
  assert.match(read('src/client/styles/_glass.scss'), /&:active \{\s*transform: scale\(0\.97\);/);
});

test('G14: Ctrl+Z in the preview is preventDefault before the editor undo runs', () => {
  const b = src('preview-edit.js'); // (the preview's keydown: its editing, then the forward)
  assert.match(b, /e\.preventDefault\(\); \/\/ Ctrl\+Z after a drag/);
  assert.match(b, /e\.preventDefault\(\); \/\/ Ctrl\+Z: the editor's undo/);
});

test('G15: auto-scroll is capped at one row a frame, not 16px (phone rows are shorter)', () => {
  assert.match(ov, /const cap = Math\.max\(1, Math\.round\(row\)\);/);
  assert.match(ov, /drag\.lines\?\.row/);
  assert.doesNotMatch(ov, /Math\.max\(-16, Math\.min\(16, v \/ 3\)\)/);
});

test("a press on a widget's body hides its handles and the toolbar; a resize keeps them", () => {
  const o = read('src/editor/overlay.js');
  // Auto: is-auto uses the already computed flag, so a side resize keeps the side-only handles
  assert.match(o, /els\.sel\.classList\.toggle\('is-auto', auto\)/);
  assert.doesNotMatch(o, /toggle\('is-auto', sizeOf\(widget\) === 'auto' && !dragging\)/);
  // a body move: is-moving at pointerdown (no threshold); a handle resize does not
  assert.match(o, /setAttribute\('data-flow-hold', h \? 'resize' : 'move'\)/);
  assert.match(
    o,
    /els\.sel\.classList\.add\('is-dragging'\);\s*if \(!h\) els\.sel\.classList\.add\('is-moving'\);/,
  );
  assert.match(o, /els\.sel\.classList\.remove\('is-dragging', 'is-moving'\)/);
  // hidden in place: no layout shift
  assert.match(
    o,
    /\.sel\.is-moving \.handle, \.sel\.is-moving \.edge \{ visibility: hidden; pointer-events: none; \}/,
  );
  assert.doesNotMatch(o, /\.sel\.is-moving [^'{]*display: none/);
  // a group move is a body move too
  assert.match(o, /setAttribute\('data-flow-hold', 'move'\)/);
});

test("one draw loop: the preview's boxes are drawn in the overlay's frame, its own drawing idles", () => {
  const o = src('overlay.js');
  // every frame: the boxes (draw()) while they ask for one, the overlay's own only while due
  assert.match(
    o,
    /function frame\(\) \{\s*raf = 0;\s*if \(!root\?\.isConnected\) return;\s*const more = draw\(\);\s*if \(due\) layout\(\);\s*if \(more \|\| due\) raf = win\.requestAnimationFrame\(frame\);/,
  );
  assert.match(o, /function kick\(\) \{\s*idleUntil = now\(\) \+ IDLE;\s*due = true;\s*wake\(\);/);
  assert.match(
    o,
    /due =\s*!!shown\(\) &&\s*!!\(drag \|\| group \|\| boxing \|\| sizing \|\| linking \|\| anims > 0 \|\| now\(\) < idleUntil\);/,
  );
  // the preview runtime asks for frames (wake), it runs no loop of its own
  const b = src('preview-runtime.js');
  assert.doesNotMatch(b, /function loop\(|let raf\b/);
  assert.match(b, /function drawBoxes\(\) \{\s*if \(!boxes\?\.hover\.isConnected\) return false;/);
  assert.match(b, /return clicks\(\) !== 'visitor';\s*\}/);
  assert.equal((b.match(/\bwake\(\);/g) || []).length, 2); // a page mounted, the clicks changed
  const m = src('main.js');
  assert.match(m, /wake: \(\) => overlay\.wake\(\),/);
  assert.match(m, /draw: \(\) => bridge\.drawBoxes\(\),/);
});
