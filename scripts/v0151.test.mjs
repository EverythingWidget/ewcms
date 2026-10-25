// v0.1.51: a Custom height starts from the rows its section shows (so a typed value at or
// above its content applies); a save's preview reload puts the selection back quietly (the
// widget pop-up never opens by itself).
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
      widgets: [{ id: 'b-a', type: 'text', layout: { base: { col: 1, span: 60 } } }],
    },
  ],
});

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
  assert.match(src('svelte/SectionView.svelte'), /<SectionSettings \{live\} \{bridge\}/);
});

test("a save's reload restores the selection quietly: no pop-up opens", () => {
  const b = src('bridge.js');
  assert.match(b, /bridge\.select\(el, sel\.kind, \{ quiet: true \}\)/);
  assert.match(b, /emit\('select', selected, \{ quiet \}\)/);
  assert.match(src('main.js'), /\.\.\.\(quiet && \{ quiet \}\)/);
  assert.match(src('svelte/ContentPanel.svelte'), /if \(!edit \|\| quiet\) return;/);
});
