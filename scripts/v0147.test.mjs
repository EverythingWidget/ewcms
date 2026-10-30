// v0.1.47: added text-like widgets are Auto; the add waits for the preview; the toolbar menus fit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';
import { addWidget, addSection } from '../src/editor/layout-ops.js';
import { checkContent } from '../src/site/validate.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const F = 'content/pages/t.json';

test('v0.1.47: added text, button, form, lists: Auto (no rows); image and hero as before', () => {
  const store = createStore();
  store.load({ [F]: { version: 1, kind: 'page', id: 'pg-t047', sections: [] } });
  addSection(store, F, 'text');
  for (const t of ['button', 'form', 'projects', 'albums', 'image', 'hero'])
    addWidget(store, F, 0, t);
  const ws = store.current[F].sections[0].widgets;
  const by = Object.fromEntries(ws.map((w) => [w.type, w]));
  for (const t of ['text', 'button', 'form', 'projects', 'albums']) {
    assert.equal(by[t].size, undefined, t);
    assert.equal(by[t].layout.base.rows, undefined, t);
  }
  assert.equal(by.image.size, 'rows');
  assert.equal(by.image.layout.base.rows, 6);
  assert.equal(by.hero.layout.base.rows, 68);
  // stacked, never on one row
  const rows = ws.map((w) => w.layout.base.row ?? 1);
  assert.equal(new Set(rows).size, rows.length);
  assert.deepEqual(checkContent(F, store.current[F]), []);
});

test('v0.1.47: Add widget waits for the preview to settle; Auto measured, not its stored --rs', () => {
  const panel = read('src/editor/svelte/ContentPanel.svelte');
  assert.match(panel, /await hooks\.settled\(\);\s*openWidget\(addWidget/);
  assert.match(panel, /classList\.contains\('wgt--auto'\)\s*\?\s*0/);
  assert.match(panel, /getBoundingClientRect\(\)\.height \/ cell/);
  assert.match(read('src/editor/main.js'), /hooks\.settled = async/);
});

test('v0.1.47: the text toolbar menu: out of the flow, over the bar when there is no room under it', () => {
  const bar = read('src/editor/svelte/WidgetToolbar.svelte');
  assert.match(bar, /popUp = need > below && above > below/);
  assert.match(bar, /Math\.min\(stage\.bottom, innerHeight\)/);
  assert.match(bar, /\.btb__pop \{[^}]*position: absolute;/);
});
