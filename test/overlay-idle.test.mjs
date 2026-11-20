// The overlay's one draw loop idles (step A of the preview performance work): on a stand-in page
// (linkedom) an idle preview runs no frame once it has settled; a pointer move, a scroll, a
// content change or a running animation wakes it; the editor's own writes (the preview's boxes,
// the overlay's layer) never do, and on Element motion neither does a script's motion on an
// element no box is on (an endless drift).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
    import { readFile } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';
    import { compileModule } from '${import.meta.resolve('svelte/compiler')}';
    export async function load(url, context, next) {
      if (url.endsWith('?raw')) {
        const text = await readFile(fileURLToPath(url.slice(0, -4)), 'utf8');
        return { format: 'module', source: 'export default ' + JSON.stringify(text), shortCircuit: true };
      }
      if (!url.endsWith('.svelte.js')) return next(url, context);
      const file = fileURLToPath(url);
      const { js } = compileModule(await readFile(file, 'utf8'), { filename: file, generate: 'client' });
      return { format: 'module', source: js.code, shortCircuit: true };
    }`),
  import.meta.url,
);
const { parseHTML } = await import('linkedom');
globalThis.window ??= globalThis; // the bridge's hook for the site (window.__siteEditor)
const { createOverlay } = await import('../src/editor/overlay.js');
const { createBridge } = await import('../src/editor/preview-runtime.js');

const FRAME = 16; // ms a frame takes on the stand-in clock
const tick = () => new Promise((r) => setTimeout(r, 0)); // mutation records delivered

/**
 * A stand-in preview: a page (one section, two widgets), the editor's bridge connected to it
 * (its style and two boxes, drawn by drawBoxes in the overlay's frame, as main.js wires them),
 * the window's frames queued and run by `run`, a clock that only moves with them. An element's
 * box: 100 x 20 at y 40, moved by its own and its parents' `translate` (the motion a script
 * writes). `p.picked` / `p.hovered`: what the boxes are on.
 */
async function preview({ mode = 'arrange' } = {}) {
  const w = parseHTML(
    `<html><head></head><body>
      <section class="sec" data-sec="s1"><div class="wgt" data-widget="a"><p>Hello</p></div>
      <div class="wgt" data-widget="b"><span class="drift">~</span></div></section>
    </body></html>`,
  );
  const doc = w.document;
  const win = w.window;
  const shift = (el) => {
    let y = 0;
    for (let n = el; n?.style; n = n.parentElement)
      y += parseFloat(n.style.translate?.split(' ')[1]) || 0;
    return y;
  };
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    const top = 40 + shift(this);
    return { left: 10, top, width: 100, height: 20, right: 110, bottom: top + 20, x: 10, y: top };
  };
  let clock = 1000;
  let queued = [];
  let id = 0;
  Object.assign(win, {
    innerWidth: 1200,
    innerHeight: 800,
    scrollX: 0,
    scrollY: 0,
    requestAnimationFrame: (f) => (queued.push(f), ++id),
    cancelAnimationFrame: () => {},
    getComputedStyle: () => ({
      overflow: 'visible',
      animationIterationCount: '1',
      gridTemplateColumns: '',
      gridTemplateRows: '',
      getPropertyValue: () => '',
    }),
    ResizeObserver: class {
      observe() {}
    },
  });
  const ui = {
    widget: null,
    multi: [],
    peek: null,
    hot: null,
    section: null,
    selSection: null,
    mod: false,
    link: null,
  };
  const p = { win, doc, ui, picked: null, hovered: null };
  const realNow = performance.now;
  performance.now = () => clock;
  let overlay = null;
  const bridge = createBridge({
    store: { current: {} },
    labelFor: () => '',
    picked: () => p.picked && { el: p.picked, kind: 'anim' },
    hovered: () => p.hovered,
    clicks: () => mode,
    wake: () => overlay?.wake(),
  });
  globalThis.window.__siteEditor.connect(
    {
      setAnimations() {},
      freeze() {},
      hooks: { beforeMount: new Set(), afterMount: new Set() },
      resolve: () => null,
    },
    win,
  );
  overlay = createOverlay({
    ui,
    clicks: () => mode,
    widgetOf: () => null,
    draw: () => bridge.drawBoxes(),
    boxed: (node) => bridge.boxed(node),
  });
  overlay.attach(win);
  // linkedom: a shadow root's nodes never connected; the overlay's frame runs while its host is
  const layer = doc.getElementById('__ed-layout').shadowRoot.querySelector('.layer');
  Object.defineProperty(layer, 'isConnected', { get: () => true });
  overlay.kick(); // the first frame (attach asked for it before the stand-in could run it)
  /** The frames the page asks for, run as the browser would, for `ms` of clock: how many ran. */
  p.run = async (ms) => {
    let n = 0;
    for (const end = clock + ms; clock < end;) {
      await tick();
      clock += FRAME;
      const fs = queued;
      queued = [];
      for (const f of fs) (n++, f(clock));
    }
    await tick();
    return n;
  };
  p.restore = () => (performance.now = realNow);
  p.queued = () => queued.length;
  p.overlay = overlay;
  p.box = () => doc.querySelector('.__ed-box--sel').style.transform;
  return p;
}

test('an idle preview runs no frame once it has settled (Edit and Element motion, a box shown)', async () => {
  for (const mode of ['arrange', 'animate']) {
    const p = await preview({ mode });
    try {
      p.picked = p.doc.querySelector('.drift');
      p.hovered = p.doc.querySelector('p');
      const settling = await p.run(1000);
      assert.ok(settling > 0 && settling < 60, `${mode}: it settles (${settling} frames)`);
      assert.equal(p.queued(), 0, `${mode}: no frame asked for`);
      assert.equal(await p.run(2000), 0, `${mode}: 0 frames in 2s idle`);
    } finally {
      p.restore();
    }
  }
});

test('a pointer move, a scroll, a resize, a key, a content change and an animation wake it', async () => {
  const p = await preview();
  try {
    await p.run(1000);
    const wakes = {
      pointerdown: () => p.doc.dispatchEvent(new p.win.Event('pointerdown')),
      pointerup: () => p.doc.dispatchEvent(new p.win.Event('pointerup')),
      pointermove: () => p.doc.dispatchEvent(new p.win.Event('pointermove')),
      scroll: () => p.win.dispatchEvent(new p.win.Event('scroll')),
      resize: () => p.win.dispatchEvent(new p.win.Event('resize')),
      keydown: () =>
        p.doc.dispatchEvent(Object.assign(new p.win.Event('keydown'), { key: 'Shift' })),
      text: () => (p.doc.querySelector('p').textContent = 'Hello there'),
      child: () => p.doc.querySelector('.sec').append(p.doc.createElement('div')),
      style: () => (p.doc.querySelector('[data-widget="a"]').style.translate = '0 8px'),
      'the panel (kick)': () => p.overlay.kick(),
    };
    for (const [what, wake] of Object.entries(wakes)) {
      wake();
      const n = await p.run(1000);
      assert.ok(n > 1, `${what} wakes it (${n} frames)`);
      assert.equal(await p.run(1000), 0, `then it idles again (${what})`);
    }
    // a running transition: the loop runs until it ends, however long, then idles
    const a = p.doc.querySelector('[data-widget="a"]');
    a.dispatchEvent(new p.win.Event('transitionrun', { bubbles: true }));
    assert.equal(await p.run(1500), Math.round(1500 / FRAME), 'every frame while it runs');
    a.dispatchEvent(new p.win.Event('transitionend', { bubbles: true }));
    await p.run(1000);
    assert.equal(await p.run(1000), 0, 'it ended: idle');
  } finally {
    p.restore();
  }
});

test("the editor's own writes never wake it: the preview's boxes, its style, the overlay's layer", async () => {
  const p = await preview({ mode: 'animate' });
  try {
    await p.run(1000);
    const own = {
      'a box moved': () => (p.doc.querySelector('.__ed-box--hover').style.width = '50px'),
      'a box shown': () => p.doc.querySelector('.__ed-box--hover').classList.add('is-on'),
      "a box's label": () => (p.doc.querySelector('.__ed-box--hover span').textContent = 'text'),
      'a box added': () => {
        const b = p.doc.createElement('div');
        b.className = '__ed-box';
        p.doc.documentElement.append(b);
      },
      'its style': () => p.doc.getElementById('__ed-style').append('.x{}'),
      "the layer's host": () => p.doc.getElementById('__ed-layout').setAttribute('data-x', '1'),
      "a box's fade": () =>
        p.doc
          .querySelector('.__ed-box--sel')
          .dispatchEvent(new p.win.Event('transitionrun', { bubbles: true })),
    };
    for (const [what, write] of Object.entries(own)) {
      write();
      assert.equal(await p.run(500), 0, `${what}: no frame`);
    }
  } finally {
    p.restore();
  }
});

test('Element motion: a drift on an element no box is on is not followed; the picked one is', async () => {
  const p = await preview({ mode: 'animate' });
  try {
    await p.run(1000);
    const drift = p.doc.querySelector('.drift');
    // a script's endless motion elsewhere: a style written every frame, never followed
    let n = 0;
    for (let i = 0; i < 60; i++) {
      drift.style.translate = `0 ${i}px`;
      n += await p.run(FRAME);
    }
    assert.equal(n, 0, 'an unrelated drift runs no frame');
    // the picked element moving (here its widget, as a motion preview moves it): its box
    // follows every frame
    p.picked = p.doc.querySelector('[data-widget="a"] p');
    p.doc.dispatchEvent(new p.win.Event('pointerup')); // (the click that picked it)
    await p.run(1000);
    assert.equal(p.box(), 'translate(6px, 36px)');
    n = 0;
    for (let i = 1; i <= 30; i++) {
      p.doc.querySelector('[data-widget="a"]').style.translate = `0 ${i}px`;
      n += await p.run(FRAME);
      assert.equal(p.box(), `translate(6px, ${36 + i}px)`, `frame ${i}: the box on it`);
    }
    assert.ok(n >= 30, `${n} frames`);
    await p.run(1000);
    assert.equal(await p.run(1000), 0, 'then idle');
    // a content change is followed whatever it is on
    drift.textContent = '≈';
    assert.ok((await p.run(1000)) > 1, 'a content change wakes it');
  } finally {
    p.restore();
  }
});

test('the boxes write only what changed, and ask for a frame only when they moved', () => {
  const b = readFileSync(new URL('../src/editor/preview-runtime.js', import.meta.url), 'utf8');
  assert.match(
    b,
    /const set = \(k, v\) => was\[k\] !== v && \(\(box\.style\[k\] = was\[k\] = v\), \(changed = true\)\);/,
  );
  assert.match(b, /return a \|\| b;\s*\}/);
  assert.doesNotMatch(b, /return clicks\(\) !== 'visitor';/, 'no frame every frame while editing');
});
