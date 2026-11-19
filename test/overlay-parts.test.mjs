// The overlay's parts (src/editor/overlay-*.js) on a stand-in page: each gesture's Esc puts the
// page back, stops the key (preventDefault, stopPropagation), takes its own listeners off and
// leaves the overlay's one state (S) idle; no hold on the page or text selection left behind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
    import { readFile } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';
    import { compileModule } from '${import.meta.resolve('svelte/compiler')}';
    export async function load(url, context, next) {
      if (!url.endsWith('.svelte.js')) return next(url, context);
      const file = fileURLToPath(url);
      const { js } = compileModule(await readFile(file, 'utf8'), { filename: file, generate: 'client' });
      return { format: 'module', source: js.code, shortCircuit: true };
    }`),
  import.meta.url,
);
const { createOverlayRows } = await import('../src/editor/overlay-rows.js');
const { createOverlayLinks, DOT } = await import('../src/editor/overlay-links.js');

/** An element's style: its properties, cssText read and written as a whole. */
function style(css = '') {
  const props = new Map();
  const s = {
    setProperty: (k, v) => props.set(k, String(v)),
    getPropertyValue: (k) => props.get(k) ?? '',
    removeProperty: (k) => props.delete(k),
    get cssText() {
      return [...props].map(([k, v]) => `${k}: ${v};`).join(' ');
    },
    set cssText(t) {
      props.clear();
      for (const d of t.split(';')) {
        const [k, ...v] = d.split(':');
        if (k.trim()) props.set(k.trim(), v.join(':').trim());
      }
    },
  };
  s.cssText = css;
  return s;
}

/** A stand-in element: a box at (x, y, w, h), a 10 × 10 grid of 8px cells. */
function el(css = '', [x, y, w, h] = [0, 0, 80, 80]) {
  return {
    style: style(css),
    hidden: false,
    dataset: {},
    getBoundingClientRect: () => ({
      left: x,
      top: y,
      width: w,
      height: h,
      right: x + w,
      bottom: y + h,
    }),
    children: [],
  };
}

/** The preview's window and document: their listeners and the <html> attributes and style. */
function page() {
  const on = new Set();
  const docOn = new Set();
  const attrs = new Map();
  const html = { style: { userSelect: '', webkitUserSelect: '' } };
  html.setAttribute = (k, v) => attrs.set(k, v);
  html.removeAttribute = (k) => attrs.delete(k);
  const doc = {
    documentElement: html,
    activeElement: null,
    createElement: () => ({ style: {}, className: '', classList: { toggle() {} } }),
    addEventListener: (t, f) => docOn.add(`${t}:${f.name}`),
    removeEventListener: (t, f) => docOn.delete(`${t}:${f.name}`),
  };
  const cells = Array(10).fill('8px').join(' ');
  const win = {
    document: doc,
    scrollX: 0,
    scrollY: 0,
    innerWidth: 1200,
    innerHeight: 800,
    addEventListener: (t, f) => on.add(`${t}:${f.name}`),
    removeEventListener: (t, f) => on.delete(`${t}:${f.name}`),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    getSelection: () => ({ removeAllRanges() {} }),
    getComputedStyle: () => ({
      gridTemplateColumns: cells,
      gridTemplateRows: cells,
      columnGap: '0px',
      rowGap: '0px',
      paddingLeft: '0',
      paddingRight: '0',
      paddingTop: '0',
      paddingBottom: '0',
      borderLeftWidth: '0',
      borderRightWidth: '0',
      borderTopWidth: '0',
      borderBottomWidth: '0',
      getPropertyValue: (k) => (k === '--cell' ? '8' : ''),
    }),
  };
  return { win, doc, on, docOn, attrs };
}

/** A pointer or key event; `e.stopped` and `e.prevented` tell what the handler did. */
function ev(props = {}) {
  const e = { button: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ...props };
  e.preventDefault = () => (e.prevented = true);
  e.stopPropagation = () => (e.stopped = true);
  return e;
}
/** The listener a gesture put on the window for `type`, called as the window would. */
const fire = (handlers, type, e) => handlers[type]?.(e);

/** The window's listeners, by name, as a gesture adds them (to call them as the page would). */
function spy(win) {
  const got = {};
  const add = win.addEventListener;
  win.addEventListener = (t, f, c) => ((got[t] = f), add(t, f, c));
  return got;
}

test("a Custom section's rows: Esc puts its height back, the key stopped, nothing held", () => {
  const p = page();
  const sec = el('--minrows: 10; --frows: 10;');
  const S = { doc: p.doc, win: p.win, hoverSec: sec, drag: null, linking: null, sizing: null };
  const calls = [];
  const rows = createOverlayRows({
    S,
    ui: { widget: null },
    tplOpen: () => false,
    isPhone: () => false,
    secOf: () => null,
    widgetEl: () => null,
    flowOf: () => ({ a: { row: 1, rows: 3 } }),
    secKey: () => 's1',
    kick: () => {},
    onrows: (...a) => calls.push(a),
  });
  assert.equal(rows.customOf(sec), sec);
  assert.equal(rows.minOf(sec, false), 10);
  const h = spy(p.win);
  const before = sec.style.cssText;
  rows.startRows(ev({ clientY: 100 }));
  assert.ok(S.sizing);
  assert.equal(p.attrs.get('data-flow-hold'), '');
  fire(h, 'pointermove', ev({ clientY: 140 })); // 5 rows down
  assert.equal(sec.style.getPropertyValue('--frows'), '15');
  fire(h, 'keydown', ev({ key: 'a' })); // another key: the drag goes on
  assert.ok(S.sizing);
  const esc = ev({ key: 'Escape' });
  fire(h, 'keydown', esc);
  assert.ok(esc.prevented && esc.stopped);
  assert.equal(sec.style.cssText, before);
  assert.equal(S.sizing, null);
  assert.equal(p.on.size, 0, 'its listeners off');
  assert.equal(p.attrs.has('data-flow-hold'), false);
  assert.deepEqual(calls, []);
  // a drag released: one onrows
  rows.startRows(ev({ clientY: 100 }));
  fire(h, 'pointermove', ev({ clientY: 116 }));
  fire(h, 'pointerup', ev());
  assert.deepEqual(calls, [['s1', 12, { phone: false }]]);
  assert.equal(p.on.size, 0);
});

test("a link's drag: Esc drops it, the key stopped, the targets gone; a drop links, keeping the gap", () => {
  const p = page();
  const a = el('', [0, 0, 80, 24]);
  const b = el('', [0, 48, 80, 16]);
  a.dataset.widget = 'a';
  b.dataset.widget = 'b';
  const sec = el();
  let targets = [];
  let held = 0;
  const S = {
    doc: p.doc,
    win: p.win,
    els: { targets: { replaceChildren: (...k) => (targets = k) } },
    linking: null,
    drag: null,
  };
  const calls = [];
  const links = createOverlayLinks({
    S,
    ui: { widget: 'b', link: null },
    arranging: () => true,
    tplOpen: () => false,
    tplSec: () => null,
    live: () => true,
    widgetsIn: () => [a, b],
    widgetEl: (id) => ({ a, b })[id],
    idOf: (n) => n.dataset.widget,
    secOf: () => sec,
    isPhone: () => false,
    widgetOf: (id) => ({ id }),
    flowOf: () => ({ a: { row: 1, rows: 3 }, b: { row: 6, rows: 2 } }),
    linkOfEl: () => null,
    place: () => {},
    noSelect: (on) => (held += on ? 1 : -1),
    kick: () => {},
    onlink: (...x) => calls.push(x),
  });
  const h = spy(p.win);
  const near = ev({ clientX: 40, clientY: 24 + DOT }); // a's bottom circle
  links.startLink(ev(), b);
  assert.ok(S.linking);
  assert.equal(targets.length, 2, "a's frame and circle");
  assert.equal(held, 1, 'no page text selected meanwhile');
  fire(h, 'pointermove', near);
  assert.equal(S.linking.near?.id, 'a');
  const esc = ev({ key: 'Escape' });
  fire(h, 'keydown', esc);
  assert.ok(esc.prevented && esc.stopped);
  assert.equal(S.linking, null);
  assert.deepEqual(targets, []);
  assert.equal(p.on.size, 0, 'its listeners off');
  assert.equal(held, 0);
  assert.deepEqual(calls, []);
  links.startLink(ev(), b);
  fire(h, 'pointermove', near);
  fire(h, 'pointerup', ev());
  assert.deepEqual(calls, [['b', 'a', 2, { phone: false }]]);
  assert.equal(p.on.size, 0);
  assert.equal(held, 0);
});
