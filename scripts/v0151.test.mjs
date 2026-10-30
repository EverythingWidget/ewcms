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
      widgets: [{ id: 'w-a', type: 'text', layout: { base: { col: 1, span: 60 } } }],
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
  assert.match(src('svelte/SectionPopup.svelte'), /<SectionSettings \{live\} \{bridge\}/);
});

test("a save's reload restores the selection quietly: no pop-up opens", () => {
  const b = src('bridge.js');
  assert.match(b, /emit\('pick', el, sel\.kind, \{ quiet: true \}\)/);
  assert.match(src('main.js'), /bridge\.on\('pick', pickElement\)/);
  assert.match(src('svelte/ui.svelte.js'), /\.\.\.\(quiet && \{ quiet \}\)/);
  assert.match(src('svelte/ContentPanel.svelte'), /if \(!edit \|\| quiet\) return;/);
});

test('the preview pick and hover live in ui only: the bridge reports them, keeps none', () => {
  const b = src('bridge.js');
  assert.doesNotMatch(b, /let (selected|hoverEl)\b/);
  assert.doesNotMatch(b, /\bselect\(el, kind|setHover\(/);
  assert.match(b, /emit\('hover', el\)/);
  const m = src('main.js');
  assert.doesNotMatch(m, /bridge\.(select|selected)\b|on\('select'/);
  assert.match(m, /bridge\.on\('hover', hoverElement\)/);
  assert.match(m, /bridge\.setClickMode\(clicks\);\s*clearPick\(\);/);
  const u = src('svelte/ui.svelte.js');
  for (const fn of ['pickElement', 'hoverElement', 'clearPick', 'clearSelection', 'pickAnim'])
    assert.match(u, new RegExp(`export function ${fn}\\(`));
});

test('Esc and the panels select through the ui helpers', () => {
  const app = src('svelte/App.svelte');
  assert.match(app, /\|\| ui\.selSection\) deselect\(\);/);
  assert.doesNotMatch(app, /ui\.(selection|widget|section|selSection) = null/);
  const u = src('svelte/ui.svelte.js');
  assert.match(
    u,
    /export function deselect\(\) \{[^}]*ui\.selSections = \[\];[^}]*ui\.link = null;/,
  );
  assert.match(src('svelte/SectionsList.svelte'), /peekSection\(id, 'panel'\)/);
  const card = src('svelte/SectionCard.svelte');
  assert.doesNotMatch(card, /ui\.(anchor|hot) =/);
  assert.match(card, /setAnchor\(id\)/);
  assert.doesNotMatch(src('svelte/persist.js'), /ui\.selection =/);
});
