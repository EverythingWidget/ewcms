// The Grid Engine: an item template's widgets dragged, resized and linked on the template
// editor's preview grid, as a page's (src/editor/overlay.js), its Layout tab as a page widget's,
// and a template's Text one line (another line: a Text of its own on the grid).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { onGrid, template } from './grid-helper.mjs';
import { createStore } from '../src/editor/store.js';
import { linkWidget, placePhone, placeWidget, setSectionRows } from '../src/editor/layout-ops.js';
import { addAt } from '../src/editor/lib/item-template.js';
import { flowAreas } from '../src/site/layout/geometry.js';
import { checkContent } from '../src/site/validate.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const T = 'templates/t-ab12.json';
const tpl = (section = {}) =>
  template({
    name: 'Card',
    section,
    widgets: onGrid([
      { type: 'photo', role: 'photo', src: [{ property: 'cover' }] },
      { type: 'text', role: 'title', body: [{ style: 'heading', text: [{ property: 'title' }] }] },
      { type: 'text', role: 'facts', body: [{ style: 'label', text: [{ property: 'place' }] }] },
    ]),
  });
const storeOf = (data) => {
  const store = createStore();
  store.load({ [T]: data });
  return store;
};
const widgets = (store) => store.current[T].sections[0].widgets;

test("the overlay arranges an open template's item: its own [data-tw] widgets, not the page's", () => {
  const ov = read('src/editor/overlay.js');
  assert.match(ov, /const tplOpen = \(\) => ui\.target\?\.kind === 'item-template'/);
  assert.match(ov, /doc\.querySelector\('\.sec--item'\)/);
  assert.match(ov, /:scope > \[data-tw="\$\{CSS\.escape\(id\)\}"\]/);
  // an inner List's items (inside the item) are not its widgets
  assert.match(
    ov,
    /while \(n && n\.parentElement !== sec\) n = n\.parentElement\?\.closest\('\[data-tw\]'\)/,
  );
  // drag, resize, links and the selection box all start (no select-only branch)
  assert.doesNotMatch(ov, /templateEl/);
  assert.match(ov, /start\(e, el\);/);
  // no section of its own to pick: a click on its empty grid drops the selection
  assert.match(ov, /if \(tplOpen\(\)\) onpick\(null\);/);
  // its phone rows are its desktop rows halved: no bottom edge on the phone
  assert.match(ov, /!\(tplOpen\(\) && isPhone\(\)\)/);
  // the writes: main.js finds the widget in the template's file (/sections/0)
  assert.match(read('src/editor/main.js'), /ui\.target\?\.kind === 'item-template'\s+\? 0/);
});

test('flowAreas: an item template item passes its own widget elements and ids', () => {
  const { document } = parseHTML(
    '<div class="sec sec--item"><div data-tw="w-a" style="--fr:3;--frs:4"></div>' +
      '<div data-tw="w-b"></div><div class="sec sec--item"><div data-tw="w-x"></div></div></div>',
  );
  const sec = document.querySelector('.sec--item');
  const els = [...sec.children].filter((n) => n.matches('[data-tw]'));
  const model = {
    'w-a': { layout: { base: { col: 1, span: 60, row: 1 } } },
    'w-b': { layout: { base: { col: 61, span: 60, row: 2, rows: 5 } }, size: 'rows' },
  };
  const flow = flowAreas(
    sec,
    false,
    (id) => model[id],
    els,
    (el) => el.dataset.tw,
  );
  assert.deepEqual(Object.keys(flow), ['w-a', 'w-b']);
  assert.deepEqual(flow['w-a'], { col: 1, span: 60, row: 3, rows: 4 });
  assert.equal(flow['w-b'].col, 61);
});

test('a template widget placed on the desktop grid: its file, one section, nothing more', () => {
  const store = storeOf(tpl());
  placeWidget(store, T, 0, 0, { col: 61, span: 60, row: 1, rows: 30 });
  const w = widgets(store)[0];
  assert.deepEqual({ col: w.layout.base.col, span: w.layout.base.span }, { col: 61, span: 60 });
  assert.deepEqual(checkContent(T, store.current[T]), []);
  // a link drawn: it follows (the gap the rows between them)
  linkWidget(store, T, 0, 2, 'w-g001', 4);
  assert.deepEqual(widgets(store)[2].layout.base.link, { to: 'w-g001', gap: 4 });
  assert.deepEqual(checkContent(T, store.current[T]), []);
});

test("a template's phone edit: its widgets keep their desktop area halved, no phone rows of its own", () => {
  const store = storeOf(tpl({ height: 'custom', rows: { min: 40 } }));
  const before = widgets(store).map((w) => structuredClone(w.layout.base));
  placePhone(store, T, 0, 1, { col: 1, span: 30, row: 2, rows: 4 });
  const ws = widgets(store);
  // the others: their desktop area halved (as the item showed them), their link with them
  const half = (b) => ({
    col: Math.floor((b.col - 1) / 2) + 1,
    span: Math.ceil((b.col + b.span - 1) / 2) - Math.floor((b.col - 1) / 2),
  });
  assert.deepEqual({ col: ws[0].layout.phone.col, span: ws[0].layout.phone.span }, half(before[0]));
  assert.equal(ws[2].layout.phone.link.to, 'w-g002');
  assert.equal(ws[1].layout.phone.span, 30);
  // the section: no phone key (a template's has none); a taller phone content grows its desktop rows
  const s = store.current[T].sections[0];
  assert.equal(s.phone, undefined);
  assert.deepEqual(checkContent(T, store.current[T]), []);
  placePhone(store, T, 0, 0, { col: 1, span: 60, row: 1, rows: 4 }, { rows: 30 });
  assert.equal(store.current[T].sections[0].rows.min, 60);
  assert.equal(store.current[T].sections[0].phone, undefined);
  // its bottom edge on the desktop: its rows
  assert.equal(setSectionRows(store, T, 0, 70), true);
  assert.equal(store.current[T].sections[0].rows.min, 70);
});

test('Add widget: on the grid, following the lowest widget the preview shows', () => {
  const ws = tpl().sections[0].widgets;
  // nothing measured: the last one
  assert.equal(addAt(ws, { type: 'text', body: [] }).at(-1).layout.base.link.to, 'w-g003');
  // the photo shows lowest: under it
  const shown = {
    'w-g001': { row: 1, rows: 90 },
    'w-g002': { row: 4, rows: 6 },
    'w-g003': { row: 12, rows: 3 },
  };
  const next = addAt(ws, { type: 'text', body: [] }, shown);
  assert.equal(next.at(-1).layout.base.link.to, 'w-g001');
  assert.equal(next.at(-1).layout.base.span, 120);
});

test("the template editor: a widget's Content | Layout tabs, its Text one line", () => {
  const panel = read('src/editor/svelte/TemplatePanel.svelte');
  assert.match(panel, /tabs=\{WIDGET_TABS\}/);
  assert.match(
    panel,
    /<WidgetLayout\s+\{live\}\s+\{bridge\}\s+\{file\}\s+at=\{0\}\s+j=\{selectedAt\}/,
  );
  // both panes in one cell: no shift on a switch
  assert.match(panel, /\.tp__pane \{[^}]*grid-area: 1 \/ 1;/);
  assert.match(panel, /\.tp__pane\.is-hidden \{\s*visibility: hidden;/);
  // the Line fields are gone: one Style + Text
  assert.doesNotMatch(panel, /Add line|Remove line|label="Line/);
  assert.match(panel, /label="Style"/);
  assert.match(panel, /set\(`\$\{b\}\/body`, \[next\]\)/);
  // its rows in the preview: the template's [data-tw] too (a size given keeps its height)
  assert.match(read('src/editor/widget-layout.js'), /\.sec--item > \[data-tw=/);
});

test("a template's Text has one line: a second one is refused", () => {
  const data = tpl();
  assert.deepEqual(checkContent(T, data), []);
  data.sections[0].widgets[1].body.push({ style: 'paragraph', text: [{ property: 'body' }] });
  assert.match(
    checkContent(T, data).join('\n'),
    /a template's Text has one line \(this one has 2\)/,
  );
});

test('a reload of the preview: the loop starts again, the text sizes skip a document gone', async () => {
  // a frame asked of the old document never comes: attach() starts the loop afresh
  assert.match(read('src/editor/overlay.js'), /attach\(siteWin\) \{\s*\/\/[^\n]*\n\s*raf = 0;/);
  const { textSizes } = await import('../src/editor/lib/small-text.js');
  const gone = { querySelectorAll: () => [{}], defaultView: null };
  assert.deepEqual(textSizes(gone), {});
});
