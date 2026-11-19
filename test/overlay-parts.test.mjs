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
const { createOverlayDrag } = await import('../src/editor/overlay-drag.js');
const { createOverlaySelect } = await import('../src/editor/overlay-select.js');

/** A classList: its classes in a Set. */
function classes() {
  const set = new Set();
  return {
    set,
    add: (...c) => c.forEach((k) => set.add(k)),
    remove: (...c) => c.forEach((k) => set.delete(k)),
    contains: (c) => set.has(c),
  };
}

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
  const html = { style: { userSelect: '', webkitUserSelect: '' }, scrollHeight: 2000 };
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
    frames: [],
    cancelled: [],
    requestAnimationFrame: (f) => win.frames.push(f),
    cancelAnimationFrame: (id) => win.cancelled.push(id),
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
  // the editor's window: a gesture's Esc is heard there too (the focus can stay in the editor)
  const edOn = new Set();
  const ed = {
    addEventListener: (t, f) => edOn.add(`${t}:${f.name}`),
    removeEventListener: (t, f) => edOn.delete(`${t}:${f.name}`),
  };
  // as overlay.js's escKeys: both windows, capture
  const escKeys = (fn, on) => {
    for (const w of [win, ed])
      w[on ? 'addEventListener' : 'removeEventListener']('keydown', fn, true);
  };
  return { win, doc, on, docOn, attrs, ed, edOn, escKeys };
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
    escKeys: p.escKeys,
    onrows: (...a) => calls.push(a),
  });
  assert.equal(rows.customOf(sec), sec);
  assert.equal(rows.minOf(sec, false), 10);
  const h = spy(p.win);
  const eh = spy(p.ed); // the focus in the editor (a press on the edge keeps it there)
  const before = sec.style.cssText;
  rows.startRows(ev({ clientY: 100 }));
  assert.ok(S.sizing);
  assert.equal(p.attrs.get('data-flow-hold'), '');
  fire(h, 'pointermove', ev({ clientY: 140 })); // 5 rows down
  assert.equal(sec.style.getPropertyValue('--frows'), '15');
  fire(h, 'keydown', ev({ key: 'a' })); // another key: the drag goes on
  assert.ok(S.sizing);
  const esc = ev({ key: 'Escape' });
  assert.equal(p.edOn.size, 1, 'its Esc heard in the editor too');
  fire(eh, 'keydown', esc);
  assert.ok(esc.prevented && esc.stopped);
  assert.equal(sec.style.cssText, before);
  assert.equal(S.sizing, null);
  assert.equal(p.on.size + p.edOn.size, 0, 'its listeners off');
  assert.equal(p.attrs.has('data-flow-hold'), false);
  assert.deepEqual(calls, []);
  // a drag released: one onrows
  rows.startRows(ev({ clientY: 100 }));
  fire(h, 'pointermove', ev({ clientY: 116 }));
  fire(h, 'pointerup', ev());
  assert.deepEqual(calls, [['s1', 12, { phone: false }]]);
  assert.equal(p.on.size + p.edOn.size, 0);
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
    escKeys: p.escKeys,
    onlink: (...x) => calls.push(x),
  });
  const h = spy(p.win);
  const eh = spy(p.ed);
  const near = ev({ clientX: 40, clientY: 24 + DOT }); // a's bottom circle
  links.startLink(ev(), b);
  assert.ok(S.linking);
  assert.equal(targets.length, 2, "a's frame and circle");
  assert.equal(held, 1, 'no page text selected meanwhile');
  fire(h, 'pointermove', near);
  assert.equal(S.linking.near?.id, 'a');
  const esc = ev({ key: 'Escape' });
  fire(eh, 'keydown', esc); // the focus in the editor (a press on the circle keeps it there)
  assert.ok(esc.prevented && esc.stopped);
  assert.equal(S.linking, null);
  assert.deepEqual(targets, []);
  assert.equal(p.on.size + p.edOn.size, 0, 'its listeners off');
  assert.equal(held, 0);
  assert.deepEqual(calls, []);
  links.startLink(ev(), b);
  fire(h, 'pointermove', near);
  fire(h, 'pointerup', ev());
  assert.deepEqual(calls, [['b', 'a', 2, { phone: false }]]);
  assert.equal(p.on.size + p.edOn.size, 0);
  assert.equal(held, 0);
});

test("a widget's drag: Esc puts the section back, the key stopped, the auto-scroll stopped", () => {
  const p = page();
  const sec = el('--frows: 10;');
  const a = el('--c: 1; --s: 4;', [0, 0, 32, 24]);
  const b = el('--c: 5;', [32, 0, 32, 24]);
  a.dataset.widget = 'a';
  b.dataset.widget = 'b';
  const sel = { classList: classes() };
  let held = 0;
  const S = { doc: p.doc, win: p.win, els: { sel }, drag: null };
  const placed = [];
  const flow = { a: { col: 1, span: 4, row: 1, rows: 3 }, b: { col: 5, span: 4, row: 1, rows: 3 } };
  const drag = createOverlayDrag({
    S,
    idOf: (n) => n.dataset.widget,
    widgetOf: (id) => ({ id, size: 'rows' }),
    secOf: () => sec,
    isPhone: () => false,
    widgetsIn: () => [a, b],
    flowOf: () => flow,
    linkOfEl: () => null,
    minOf: () => 0,
    noSelect: (on) => (held += on ? 1 : -1),
    escKeys: p.escKeys,
    onplace: (...x) => placed.push(x),
    onpick: () => {},
  });
  const h = spy(p.win);
  const before = [sec, a, b].map((n) => n.style.cssText);
  drag.start(ev({ clientX: 10, clientY: 10 }), a);
  assert.ok(S.drag);
  assert.deepEqual([...sel.classList.set], ['is-dragging', 'is-moving'], 'a body move');
  assert.equal(p.attrs.get('data-flow-hold'), 'move');
  assert.equal(held, 1);
  fire(h, 'pointermove', ev({ clientX: 26, clientY: 790 })); // 2 columns right, at the bottom edge
  assert.equal(a.style.getPropertyValue('--c'), '3');
  assert.equal(S.drag.raf, 1, "the auto-scroll's frame, on the one state");
  const esc = ev({ key: 'Escape' });
  fire(h, 'keydown', esc);
  assert.ok(esc.prevented && esc.stopped);
  assert.deepEqual(p.win.cancelled, [1]);
  assert.deepEqual(
    [sec, a, b].map((n) => n.style.cssText),
    before,
  );
  assert.equal(S.drag, null);
  assert.equal(sel.classList.set.size, 0);
  assert.equal(p.attrs.has('data-flow-hold'), false);
  assert.equal(p.on.size + p.edOn.size, 0, 'its listeners off');
  assert.equal(held, 0);
  assert.deepEqual(placed, []);
  // a resize from a handle keeps the handles (no is-moving); a release places it
  drag.start(ev({ clientX: 30, clientY: 10 }), a, 'e');
  assert.deepEqual([...sel.classList.set], ['is-dragging']);
  assert.equal(p.attrs.get('data-flow-hold'), 'resize');
  fire(h, 'pointermove', ev({ clientX: 46, clientY: 10 }));
  fire(h, 'pointerup', ev());
  assert.equal(placed.length, 1);
  assert.deepEqual(placed[0].slice(0, 2), ['a', { col: 1, span: 6, row: 1, rows: 3 }]);
  assert.equal(p.on.size + p.edOn.size, 0);
  assert.equal(held, 0);
});

/** The selection's part on a section of widgets a (cols 1-4) and b (cols 5-8), both selected. */
function selectPart() {
  const p = page();
  const sec = el('--frows: 10;');
  const a = el('--c: 1;', [0, 0, 32, 24]);
  const b = el('--c: 5;', [32, 0, 32, 24]);
  a.dataset.widget = 'a';
  b.dataset.widget = 'b';
  const sel = { classList: classes() };
  const t = { p, sec, a, b, sel, held: 0, calls: [] };
  const flow = { a: { col: 1, span: 4, row: 1, rows: 3 }, b: { col: 5, span: 4, row: 1, rows: 3 } };
  t.S = { doc: p.doc, win: p.win, els: { sel }, group: null, boxing: null };
  t.ui = { widget: null, multi: ['a', 'b'] };
  const setArea = (st, at) => (st.setProperty('--c', at.col), st.setProperty('--r', at.row));
  t.part = createOverlaySelect({
    S: t.S,
    ui: t.ui,
    arranging: () => true,
    tplOpen: () => false,
    idOf: (n) => n.dataset.widget,
    secOf: () => sec,
    widgetEl: (id) => ({ a, b })[id],
    widgetsIn: () => [a, b],
    widgetOf: (id) => ({ id }),
    isPhone: () => false,
    flowOf: () => flow,
    linkOfEl: () => null,
    minOf: () => 0,
    setArea,
    noSelect: (on) => (t.held += on ? 1 : -1),
    kick: () => {},
    escKeys: p.escKeys,
    onpick: (id) => t.calls.push(['pick', id]),
    onselect: (ids) => t.calls.push(['select', ids]),
    onsectionpick: (id) => t.calls.push(['section', id]),
    ongroupmove: (...x) => t.calls.push(['move', ...x.slice(0, 3)]),
  });
  t.h = spy(p.win);
  t.eh = spy(p.ed);
  return t;
}

test('a group move: Esc puts the section back, the key stopped; a release is one move', () => {
  const t = selectPart();
  const before = [t.sec, t.a, t.b].map((n) => n.style.cssText);
  t.part.startGroup(ev({ clientX: 10, clientY: 10 }), ['a', 'b'], t.a);
  assert.ok(t.S.group);
  assert.deepEqual([...t.sel.classList.set], ['is-dragging', 'is-moving']);
  assert.equal(t.p.attrs.get('data-flow-hold'), 'move');
  fire(t.h, 'pointermove', ev({ clientX: 26, clientY: 26 })); // 2 columns, 2 rows
  assert.equal(t.a.style.getPropertyValue('--c'), '3');
  const esc = ev({ key: 'Escape' });
  fire(t.h, 'keydown', esc);
  assert.ok(esc.prevented && esc.stopped);
  assert.deepEqual(
    [t.sec, t.a, t.b].map((n) => n.style.cssText),
    before,
  );
  assert.equal(t.S.group, null);
  assert.equal(t.sel.classList.set.size, 0);
  assert.equal(t.p.attrs.has('data-flow-hold'), false);
  assert.equal(t.p.on.size + t.p.edOn.size, 0, 'its listeners off');
  assert.equal(t.held, 0);
  assert.deepEqual(t.calls, []);
  t.part.startGroup(ev({ clientX: 10, clientY: 10 }), ['a', 'b'], t.a);
  fire(t.h, 'pointermove', ev({ clientX: 26, clientY: 26 }));
  fire(t.h, 'pointerup', ev());
  assert.deepEqual(t.calls, [['move', ['a', 'b'], 2, 2]]);
  assert.equal(t.p.on.size + t.p.edOn.size, 0);
  assert.equal(t.held, 0);
  // the arrow keys: one move, clamped to the grid (b ends at column 8 of 120)
  t.calls.length = 0;
  assert.equal(t.part.nudge(-1, 0), true);
  assert.deepEqual(t.calls, [], 'a at column 1: no move left');
  t.part.nudge(1, 0);
  assert.deepEqual(t.calls, [['move', ['a', 'b'], 1, 0]]);
});

test('a selection box: Esc gives the selection back, the key stopped; a click picks the section', () => {
  const t = selectPart();
  t.sec.dataset.sec = 's1';
  t.ui.multi = [];
  t.part.startBox(ev({ pageX: 25, pageY: 70 }), t.sec, []);
  assert.ok(t.S.boxing);
  assert.equal(t.held, 1);
  fire(t.h, 'pointermove', ev({ pageX: 20, pageY: 20 })); // over a
  assert.deepEqual(t.calls, [['select', ['a']]]);
  const esc = ev({ key: 'Escape' });
  fire(t.eh, 'keydown', esc); // the focus in the editor
  assert.ok(esc.prevented && esc.stopped);
  assert.deepEqual(t.calls.at(-1), ['select', []]);
  assert.equal(t.S.boxing, null);
  assert.equal(t.p.on.size + t.p.edOn.size, 0, 'its listeners off');
  assert.equal(t.held, 0);
  t.calls.length = 0;
  t.part.startBox(ev({ pageX: 70, pageY: 70 }), t.sec, []);
  fire(t.h, 'pointerup', ev());
  assert.deepEqual(t.calls, [['section', 's1']]);
  assert.equal(t.p.on.size + t.p.edOn.size, 0);
  assert.equal(t.held, 0);
});
