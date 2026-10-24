// v0.1.43: a new Hero is the section's width and a screen tall; an empty Hero renders; the
// overlay's edges resize; the preview never asks to render a page it isn't on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from '../src/editor/store.js';
import { addSection, addWidget } from '../src/editor/layout-ops.js';
import { COLS } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';
import { renderOp } from './editor-server.mjs';
import * as render from '../src/site/render.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SITE_A = path.join(path.dirname(fileURLToPath(import.meta.url)), '../test/fixtures/site-a');
const F = 'pages/index.json';

test('v0.1.43: an added Hero: all columns, 68 rows (Rows); other widgets still 40 × 6', () => {
  const store = createStore();
  store.load({ [F]: { version: 1, kind: 'page', id: 'pg-t143', sections: [] } });
  addSection(store, F);
  const hero = addWidget(store, F, 0, 'hero');
  assert.deepEqual(hero.layout.base, { col: 1, span: COLS, row: 1, rows: 68 });
  assert.equal(hero.size, 'rows');
  const text = addWidget(store, F, 0, 'text');
  assert.equal(text.layout.base.span, 40);
  assert.equal(text.layout.base.rows, 6);
  addSection(store, F, 'hero');
  assert.equal(store.current[F].sections[1].widgets[0].layout.base.span, COLS);
  // an empty Hero (no photo, no name) is valid content and renders
  assert.deepEqual(checkContent(F, store.current[F]), []);
});

test('v0.1.43: an unfilled Hero renders in the preview; no path is a plain error', () => {
  const file = 'pages/about/index.json';
  const data = JSON.parse(read('test/fixtures/site-a/content/en/pages/about/index.json'));
  const store = createStore();
  store.load({ [file]: data });
  addSection(store, file);
  const at = store.current[file].sections.length - 1;
  addWidget(store, file, at, 'hero');
  const s = store.current[file].sections[at];
  const r = renderOp(
    render,
    SITE_A,
    {},
    { path: '/about/', file, data: store.current[file], ids: [s.id] },
  );
  assert.equal(r.status, 200);
  assert.match(r.body.html[s.id], /class="hero hero--scattered"/);
  const none = renderOp(
    render,
    SITE_A,
    {},
    { path: null, file, data: store.current[file], ids: [s.id] },
  );
  assert.equal(none.status, 400);
  assert.equal(none.body.error, 'No page path');
  // the editor doesn't ask while the preview has no page (reloading)
  assert.match(
    read('src/editor/main.js'),
    /if \(!path \|\| !file \|\| !root\.isConnected\) return;/,
  );
});

test("v0.1.43: a selected widget's whole left / right edge resizes it", () => {
  const o = read('src/editor/overlay.js');
  assert.match(o, /<i class="edge" data-h="w"><\/i><i class="edge" data-h="e"><\/i>/);
  assert.match(o, /\.edge \{ position: absolute; top: 0; bottom: 0;[^}]*cursor: ew-resize; \}/);
});
