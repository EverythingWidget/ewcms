// A section's height: Custom rows, and a fixed-rows widget's spilt text growing its section.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';
import { setSectionRows } from '../src/editor/layout-ops.js';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
const P = 'pages/index.json';
const page = () => ({
  version: 1,
  kind: 'page',
  id: 'pg-home',
  meta: { title: 'H', description: 'x' },
  sections: [
    {
      id: 's-a',
      height: 'custom',
      rows: { min: 57 },
      widgets: [{ id: 'w-a', type: 'text', layout: { base: { col: 1, span: 60 } } }],
    },
  ],
});
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('a typed Custom row count applies (no clamp to the old value)', () => {
  const store = createStore();
  store.load({ [P]: page() });
  assert.ok(setSectionRows(store, P, 0, 64));
  assert.equal(store.current[P].sections[0].rows.min, 64);
});

test('Custom starts from the rows the preview shows (--frows), not the stored guess', () => {
  const s = src('svelte/SectionSettings.svelte');
  assert.match(s, /--frows/);
  assert.match(s, /min: s\.rows\?\.min \|\| shownRows\(s, false\) \|\| rowsOf\(s\)/);
  assert.match(src('svelte/SectionPopup.svelte'), /<SectionSettings \{live\} \{bridge\}/);
});

test('a fixed-rows widget whose text spills: the section (not custom) reaches it', () => {
  const rows = read('src/client/modules/rows.js');
  assert.match(rows, /function spilt\(/);
  assert.match(rows, /min \? 0 : spilt\(sec, els, at, row\)/); // custom: its own rows
});
