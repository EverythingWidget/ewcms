// v0.1.45: a new widget goes below what the section shows (an auto widget's real height); a
// fixed-rows widget's spilt text grows its section; unsaved edits survive the dev server's reload.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';
import { addSection, addWidget } from '../src/editor/layout-ops.js';
import { baseOf } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';
import { KEY, keepUnsaved, keptForReload, restoreUnsaved } from '../src/editor/keep-unsaved.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const F = 'pages/index.json';
const fresh = () => {
  const store = createStore();
  store.load({ [F]: { version: 1, kind: 'page', id: 'pg-t145', sections: [] } });
  return store;
};
const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};

test('v0.1.45: added widgets: col 1, below the lowest one as shown, never on top of each other', () => {
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

test('v0.1.45: a fixed-rows widget whose text spills: the section (not custom) reaches it', () => {
  const rows = read('src/client/modules/rows.js');
  assert.match(rows, /function spilt\(/);
  assert.match(rows, /min \? 0 : spilt\(sec, els, at, row\)/); // custom: its own rows
});

test('v0.1.45: unsaved edits kept over a dev-server reload, put back as one undo step', () => {
  const store = fresh();
  addSection(store, F, 'photo');
  store.markSaved([F]);
  store.set(F, '/meta', { title: 'Typed, not saved' });
  const s = memory();
  assert.equal(keptForReload(), false);
  assert.equal(keepUnsaved(store, s, 1000), true);
  assert.equal(keptForReload(), true); // no "Reload site?" prompt now
  const saved = structuredClone(store.base);
  const next = createStore();
  next.load(saved);
  assert.deepEqual(restoreUnsaved(next, s, 2000), [F]);
  assert.equal(next.current[F].meta.title, 'Typed, not saved');
  assert.deepEqual(next.dirtyFiles(), [F]);
  assert.equal(s.getItem(KEY), null); // once
  next.undo();
  assert.equal(next.current[F].meta, undefined);
  // stale (another visit): dropped
  keepUnsaved(store, s, 0);
  const later = createStore();
  later.load(saved);
  assert.deepEqual(restoreUnsaved(later, s, 120_000), []);
  // nothing unsaved: nothing kept
  assert.equal(keepUnsaved(later, memory()), false);
});

test('v0.1.45: content writes never full-reload; the editor wires the keep', () => {
  const plugin = read('scripts/vite-plugin-static-site.mjs');
  assert.match(plugin, /if \(content\) return \[\];/);
  const main = read('src/editor/main.js');
  assert.match(main, /vite:beforeFullReload', \(\) => keepUnsaved\(store, sessionStorage\)/);
  assert.match(main, /restoreUnsaved\(store, sessionStorage\)/);
  assert.match(read('src/editor/svelte/App.svelte'), /!keptForReload\(\)/);
});
