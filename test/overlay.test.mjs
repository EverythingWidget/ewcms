// The preview overlay: boxes around what shows, the link layer, the edge handles and drags.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { boxOf } from '../src/render/layout/geometry.js';
import { createStore } from '../src/editor/store.js';
import { addSection, placeWidget } from '../src/editor/layout-ops.js';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
const lk = readFileSync(new URL('../src/editor/overlay-links.js', import.meta.url), 'utf8');
const draw = lk.slice(lk.indexOf('function drawLinks()'), lk.indexOf('const seen = new Set();'));
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
  const lk = src('overlay-links.js');
  const draw = lk.slice(lk.indexOf('function drawLinks'), lk.indexOf('function drawLinks') + 3000);
  assert.doesNotMatch(draw, /innerHTML/);
  assert.match(lk, /const linkEls = new Map\(\)/);
  assert.match(lk, /attr\(e\.line, 'd', d\)/);
  assert.match(lk, /if \(size !== svgSize\)/);
  assert.match(lk, /text-anchor', 'end'/, 'the gap label left of the line, clear of the tag');
  // a new layer: the lines kept for the one before dropped
  assert.match(ov, /resetLinks\(\);\s*shadow\.innerHTML = /);
  assert.match(ov, /S\.anims > 0 \|\|\s*now\(\) < S\.idleUntil/);
  // the page's changes wake it, not the editor's own drawing (overlay-idle.test.mjs)
  assert.match(
    ov,
    /new S\.win\.MutationObserver\(\(rs\) => rs\.some\(pageMutation\) && kick\(\)\)/,
  );
  assert.match(ov, /new S\.win\.ResizeObserver\(kick\)/);
  assert.doesNotMatch(ov, /if \(shown\(\)\) (S\.)?raf = (S\.)?win\.requestAnimationFrame/);
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
  assert.match(o, /if \(S\.drag && top && top !== el\) S\.drag\.click = idOf\(top\);/);
  assert.match(
    read('src/editor/overlay-drag.js'),
    /else if \(click\) \(setAnchor\(click\), onpick\(click\)\);/,
  );
  // Size -> Rows from the shown rows (the phone's: doubled)
  assert.match(read('src/editor/widget-layout.js'), /phone \? n \* 2 : n/);
});

test('a link drag keeps the widget where it is (the gap: the rows between them)', () => {
  const o = read('src/editor/overlay-links.js');
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

test("G14: a preview key reaches keys.js before its default is prevented (Ctrl+Z still the store's undo)", () => {
  const b = src('preview-edit.js'); // (the preview's keydown: its editing, then the forward)
  // (forwarded first, then prevented: keys.js sees an arrow or Enter as one in the editor)
  assert.match(
    b,
    /Ctrl\+Z after a drag: the store's undo on the first press, G14\)\s*emit\('key', e\);\s*e\.preventDefault\(\);/,
  );
  assert.match(b, /e\.preventDefault\(\); \/\/ Ctrl\+Z: the editor's undo/);
});

test('G15: auto-scroll is capped at one row a frame, not 16px (phone rows are shorter)', () => {
  const dg = src('overlay-drag.js');
  assert.match(dg, /const cap = Math\.max\(1, Math\.round\(row\)\);/);
  assert.match(dg, /drag\.lines\?\.row/);
  assert.doesNotMatch(dg, /Math\.max\(-16, Math\.min\(16, v \/ 3\)\)/);
});

test("a press on a widget's body hides its handles and the toolbar; a resize keeps them", () => {
  const o = read('src/editor/overlay.js');
  // Auto: is-auto uses the already computed flag, so a side resize keeps the side-only handles
  assert.match(o, /S\.els\.sel\.classList\.toggle\('is-auto', auto\)/);
  assert.doesNotMatch(o, /toggle\('is-auto', sizeOf\(widget\) === 'auto' && !dragging\)/);
  // a body move: is-moving at pointerdown (no threshold); a handle resize does not
  const dg = read('src/editor/overlay-drag.js');
  assert.match(dg, /setAttribute\('data-flow-hold', h \? 'resize' : 'move'\)/);
  assert.match(
    dg,
    /S\.els\.sel\.classList\.add\('is-dragging'\);\s*if \(!h\) S\.els\.sel\.classList\.add\('is-moving'\);/,
  );
  assert.match(dg, /S\.els\.sel\.classList\.remove\('is-dragging', 'is-moving'\)/);
  // hidden in place: no layout shift
  assert.match(
    o,
    /\.sel\.is-moving \.handle, \.sel\.is-moving \.edge \{ visibility: hidden; pointer-events: none; \}/,
  );
  assert.doesNotMatch(o, /\.sel\.is-moving [^'{]*display: none/);
  // a group move is a body move too
  assert.match(read('src/editor/overlay-select.js'), /setAttribute\('data-flow-hold', 'move'\)/);
});

test("one draw loop: the preview's boxes are drawn in the overlay's frame, its own drawing idles", () => {
  const o = src('overlay.js');
  // every frame while something moves (busy()) or a box just moved: the boxes (draw()), the
  // overlay's own only while due; then no frame is asked for
  assert.match(
    o,
    /function frame\(\) \{\s*S\.raf = 0;\s*if \(!S\.root\?\.isConnected\) return;\s*const more = draw\(\);\s*if \(S\.due\) layout\(\);\s*afterFrame\(\);\s*if \(more \|\| S\.due \|\| \(clicks\(\) !== 'visitor' && busy\(\)\)\)\s*S\.raf = S\.win\.requestAnimationFrame\(frame\);/,
  );
  assert.match(
    o,
    /function kick\(\) \{\s*S\.idleUntil = now\(\) \+ IDLE;\s*S\.due = true;\s*wake\(\);/,
  );
  assert.match(
    o,
    /const busy = \(\) =>\s*!!\(\s*S\.drag \|\|\s*S\.group \|\|\s*S\.boxing \|\|\s*S\.sizing \|\|\s*S\.linking \|\|\s*S\.anims > 0 \|\|\s*now\(\) < S\.idleUntil\s*\);/,
  );
  assert.match(o, /S\.due = !!shown\(\) && busy\(\);/);
  // the preview runtime asks for frames (wake), it runs no loop of its own
  const b = src('preview-runtime.js');
  assert.doesNotMatch(b, /function loop\(|let raf\b/);
  assert.match(b, /function drawBoxes\(\) \{\s*if \(!boxes\?\.hover\.isConnected\) return false;/);
  assert.match(b, /return a \|\| b;\s*\}/); // a box moved: one more frame
  assert.equal((b.match(/\bwake\(\);/g) || []).length, 3); // a page mounted, the clicks changed, onFrame
  const m = src('main.js');
  assert.match(m, /wake: \(\) => overlay\.wake\(\),/);
  assert.match(m, /draw: \(\) => bridge\.drawBoxes\(\),/);
  assert.match(m, /boxed: \(node\) => bridge\.boxed\(node\),/);
  assert.match(m, /afterFrame: \(\) => bridge\.framed\(\),/);
});

test("the overlay's parts (overlay-*.js): factories over its one state, none imports overlay.js", () => {
  const parts = readdirSync(new URL('../src/editor/', import.meta.url)).filter((n) =>
    /^overlay-[\w-]+\.js$/.test(n),
  );
  assert.ok(parts.length);
  const o = src('overlay.js');
  assert.match(o, /const S = \{/);
  for (const f of parts) {
    const p = src(f);
    const name = `createOverlay${f.slice(8, -3).replace(/(^|-)(\w)/g, (_, _d, c) => c.toUpperCase())}`;
    assert.match(p, new RegExp(`export function ${name}\\(ctx\\) \\{`), f);
    assert.match(
      o,
      new RegExp(`import \\{ ${name}\\b[^}]*\\} from '\\./${f.replace('.', '\\.')}';`),
      f,
    );
    assert.match(o, new RegExp(`Object\\.assign\\(\\s*ctx,\\s*${name}\\(ctx\\),?\\s*\\)`), f);
    // no import of the overlay (no cycle), no state of its own beside S (never a copy)
    assert.doesNotMatch(p, /from '\.\/overlay(-[\w-]+)?\.js'/, f);
    assert.doesNotMatch(
      p,
      /\b(let|const) (S|doc|win|root|els|drag|group|boxing|sizing|linking)\b/,
      f,
    );
  }
});

test("a gesture's Esc is heard wherever the focus is, before keys.js (the selection stays)", () => {
  const o = src('overlay.js');
  // the preview's window and the editor's, capture
  assert.match(o, /const editorWin = typeof window === 'undefined' \? null : window;/);
  assert.match(
    o,
    /for \(const w of new Set\(\[S\.win, editorWin\]\)\)\s*w\?\.\[on \? 'addEventListener' : 'removeEventListener'\]\('keydown', fn, true\);/,
  );
  // keys.js listens on the editor's window in the bubble phase: a gesture's capture Esc, which
  // stops the key, comes first
  assert.match(src('main.js'), /window\.addEventListener\('keydown', onKey\);/);
  const parts = readdirSync(new URL('../src/editor/', import.meta.url)).filter((n) =>
    /^overlay-[\w-]+\.js$/.test(n),
  );
  for (const f of parts) {
    const p = src(f);
    assert.doesNotMatch(p, /addEventListener\('keydown'/, `${f}: its Esc through escKeys`);
    const on = p.match(/escKeys\((\w+), true\)/g) || [];
    const off = p.match(/escKeys\((\w+), false\)/g) || [];
    assert.equal(on.length, off.length, `${f}: every Esc taken off again`);
    for (const c of p.match(/function cancel\w*\(e\) \{[^]*?\n {2}\}/g) || [])
      assert.match(
        c,
        /e\.preventDefault\(\);\s*e\.stopPropagation\(\);/,
        `${f}: its Esc stops the key`,
      );
  }
});

test("the overlay's parts are wired in order: each reads only what ctx has when it is made", () => {
  const o = src('overlay.js');
  const lit = o.match(/const ctx = \{([^}]*)\};/)[1];
  const have = new Set(
    lit
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  // the parts in the order overlay.js makes them
  const order = [...o.matchAll(/Object\.assign\(\s*ctx,\s*(createOverlay\w+)\(ctx\)/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(order, [
    'createOverlayRows',
    'createOverlayDrag',
    'createOverlaySelect',
    'createOverlayLinks',
  ]);
  for (const name of order) {
    const f = `overlay-${name.slice(13).replace(/[A-Z]/g, (c, i) => (i ? '-' : '') + c.toLowerCase())}.js`;
    const p = src(f);
    const reads = p.match(/export function \w+\(ctx\) \{\s*const \{([^}]*)\} = ctx;/)[1];
    for (const k of reads
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean))
      assert.ok(have.has(k), `${f} reads ${k} before ctx has it`);
    const gives = p.match(/\n {2}return \{([^}]*)\};\n\}/)[1];
    for (const k of gives
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean))
      have.add(k);
  }
  // drag reads minOf (rows), select reads minOf and setArea (drag)
  assert.ok(order.indexOf('createOverlayRows') < order.indexOf('createOverlayDrag'));
  assert.ok(order.indexOf('createOverlayDrag') < order.indexOf('createOverlaySelect'));
});

test('a section card hovered keeps the selected widget\'s box, handles and grid', () => {
  const ov = src('overlay.js');
  assert.match(ov, /const arrange = arranging\(\);/);
  assert.doesNotMatch(ov, /arranging\(\) && !peeking/);
  assert.doesNotMatch(ov, /is-peeking/);
  const bar = read('src/editor/svelte/WidgetToolbar.svelte');
  assert.match(bar, /const shown = \$derived\(!!\(where && widget && pos\)\)/);
  assert.doesNotMatch(bar, /!peeking/);
});

test("the overlay is clipped to the page so a selected widget's circle cannot grow it", () => {
  const ov = src('overlay.js');
  assert.match(ov, /function clipHost\(\)/);
  assert.match(ov, /overflow:hidden/);
  assert.match(ov, /clipHost\(\);\s*drawGrids\(\)/);
});
