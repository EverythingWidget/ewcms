// v0.1.46: Top (row), Gap (rows) and Rows typed; a link drag lands flush (gap 0); the selected
// widget is dragged where widgets overlap; Size -> Rows starts from the rows it shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';
import {
  addSection,
  addWidget,
  linkWidget,
  setColumns,
  setGap,
  setWidget,
} from '../src/editor/layout-ops.js';
import { MAX_MIN_ROWS, baseOf, linkOf } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const F = 'pages/index.json';
const two = () => {
  const store = createStore();
  store.load({ [F]: { version: 1, kind: 'page', id: 'pg-t146', sections: [] } });
  addSection(store, F, 'photo');
  addWidget(store, F, 0, 'photo');
  return store;
};
const w = (store, j) => store.current[F].sections[0].widgets[j];

test('v0.1.46: Top (row) and Rows typed: clamped, one undo step each', () => {
  const store = two();
  setColumns(store, F, 0, 0, { row: 9 }, { key: 'r' });
  assert.equal(baseOf(w(store, 0)).row, 9);
  setColumns(store, F, 0, 0, { row: -4 }, { key: 'r2' });
  assert.equal(baseOf(w(store, 0)).row, 1);
  setColumns(store, F, 0, 0, { rows: 0 }, { key: 'n' }); // a Rows widget (added ones are)
  assert.equal(baseOf(w(store, 0)).rows, 1);
  setColumns(store, F, 0, 0, { rows: 1e6 }, { key: 'n2' });
  assert.equal(baseOf(w(store, 0)).rows, MAX_MIN_ROWS);
  store.undo();
  assert.equal(baseOf(w(store, 0)).rows, 1);
  // an Auto widget stores no rows: Rows typed does nothing
  setWidget(store, F, 0, 1, { size: undefined });
  assert.equal(setColumns(store, F, 0, 1, { rows: 20 }), false);
  assert.deepEqual(checkContent(F, store.current[F]), []);
});

test("v0.1.46: Gap (rows) typed: whole rows, negative down to the leader's top, undo", () => {
  const store = two();
  const lead = w(store, 0).id;
  linkWidget(store, F, 0, 1, lead, -11);
  setGap(store, F, 0, 1, 3, { key: 'g', leaderRows: 6 });
  assert.deepEqual(linkOf(w(store, 1)), { to: lead, gap: 3 });
  setGap(store, F, 0, 1, -50, { key: 'g2', leaderRows: 6 });
  assert.equal(linkOf(w(store, 1)).gap, -6);
  setGap(store, F, 0, 1, -50, { key: 'g3' }); // leader's rows unknown: not above 0
  assert.equal(linkOf(w(store, 1)).gap, 0);
  store.undo();
  assert.equal(linkOf(w(store, 1)).gap, -6);
  assert.equal(setGap(store, F, 0, 0, 2), false); // not following: nothing
});

test('v0.1.46: a link drag onto a new leader: gap 0; the selected widget is dragged', () => {
  const o = read('src/editor/overlay.js');
  assert.match(o, /if \(was\?\.to !== near\.id\) onlink\(id, near\.id, 0, \{ mobile: phone \}\);/);
  assert.match(o, /const el = selectedUnder\(e, mod\) \|\| top;/);
  assert.match(o, /else if \(click\) \(\(ui\.anchor = click\), onpick\(click\)\);/); // a click: the one on top
  const l = read('src/editor/svelte/WidgetLayout.svelte');
  for (const label of ['Top (row)', 'Gap (rows)', 'label="Rows"'])
    assert.ok(l.includes(label), label);
  assert.match(l, /phoneView \? n \* 2 : n/); // Size -> Rows from the shown rows (the phone's: doubled)
});
