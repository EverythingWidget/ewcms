// Add widget: where a new widget goes and its size (Auto or rows); the add waits for the preview.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';
import { addSection, addWidget } from '../src/editor/layout-ops.js';
import { COLS, baseOf } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';

const F = 'pages/index.json';
const fresh = () => {
  const store = createStore();
  store.load({ [F]: { version: 1, kind: 'page', id: 'pg-t145', sections: [] } });
  return store;
};
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const FT = 'content/pages/t.json';

test('an added Hero: all columns, 68 rows (Rows); other widgets still 40 × 6', () => {
  const store = createStore();
  store.load({ [F]: { version: 1, kind: 'page', id: 'pg-t143', sections: [] } });
  addSection(store, F);
  const hero = addWidget(store, F, 0, 'hero');
  assert.deepEqual(hero.layout.base, { col: 1, span: COLS, row: 1, rows: 68 });
  assert.equal(hero.size, 'rows');
  const text = addWidget(store, F, 0, 'photo');
  assert.equal(text.layout.base.span, 40);
  assert.equal(text.layout.base.rows, 6);
  addSection(store, F, 'hero');
  assert.equal(store.current[F].sections[1].widgets[0].layout.base.span, COLS);
  // an empty Hero (no photo, no name) is valid content and renders
  assert.deepEqual(checkContent(F, store.current[F]), []);
});

test('added widgets: col 1, below the lowest one as shown, never on top of each other', () => {
  const store = fresh();
  addSection(store, F, 'photo');
  const sec = () => store.current[F].sections[0];
  // the first one is an auto text at row 12 whose content takes 28 rows in the preview
  sec().widgets[0].size = undefined;
  sec().widgets[0].layout.base = { col: 1, span: 64, row: 12 };
  const a = addWidget(store, F, 0, 'photo', {
    shown: { [sec().widgets[0].id]: { row: 12, rows: 28 } },
  });
  assert.deepEqual([baseOf(a).col, baseOf(a).row], [1, 40]);
  const widget = addWidget(store, F, 0, 'photo');
  assert.equal(baseOf(widget).row, 46); // below a (6 rows); no preview: as stored
  const c = addWidget(store, F, 0, 'photo', { shown: { bogus: { row: 1, rows: 'x' } } });
  assert.equal(baseOf(c).row, 52);
  assert.deepEqual(checkContent(F, store.current[F]), []);
});

test('added text, button, form, lists: Auto (no rows); photo and hero as before', () => {
  const store = createStore();
  store.load({ [FT]: { version: 1, kind: 'page', id: 'pg-t047', sections: [] } });
  addSection(store, FT, 'text');
  for (const t of ['button', 'form', 'albums', 'list', 'photo', 'hero']) addWidget(store, FT, 0, t);
  const ws = store.current[FT].sections[0].widgets;
  const by = Object.fromEntries(ws.map((w) => [w.type, w]));
  for (const t of ['text', 'button', 'form', 'list', 'albums']) {
    assert.equal(by[t].size, undefined, t);
    assert.equal(by[t].layout.base.rows, undefined, t);
  }
  assert.equal(by.photo.size, 'rows');
  assert.equal(by.photo.layout.base.rows, 6);
  assert.equal(by.hero.layout.base.rows, 68);
  // stacked, never on one row
  const rows = ws.map((w) => w.layout.base.row ?? 1);
  assert.equal(new Set(rows).size, rows.length);
  assert.deepEqual(checkContent(FT, store.current[FT]), []);
});

test('Add widget waits for the preview to settle; Auto measured, not its stored --rs', () => {
  const panel = read('src/editor/svelte/ContentPanel.svelte');
  assert.match(panel, /await hooks\.settled\(\);\s*openWidget\(addWidget/);
  assert.match(panel, /classList\.contains\('wgt--auto'\)\s*\?\s*0/);
  assert.match(panel, /getBoundingClientRect\(\)\.height \/ cell/);
  assert.match(read('src/editor/main.js'), /hooks\.settled = async/);
});
