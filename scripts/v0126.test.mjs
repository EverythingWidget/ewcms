// v0.1.26: preview selection and the pop-up, row hover <-> preview, a duplicated section shows
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { offscreen, popupStays } from '../src/editor/multi-select.js';
import { createStore } from '../src/editor/store.js';
import { duplicateSection } from '../src/editor/layout-ops.js';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('pop-up: a single click only selects; one selected swaps it, none or several close it', () => {
  assert.equal(popupStays(1), true);
  assert.equal(popupStays(0), false);
  assert.equal(popupStays(2), false);
  const ov = src('overlay.js');
  assert.match(ov, /addEventListener\('dblclick', ondblclick, true\)/, 'double click opens');
  assert.match(ov, /onopen\?\.\(id\)/);
  const main = src('main.js');
  // a selection box (or Ctrl+click) never opens the pop-up
  assert.match(main, /onselect\(ids\) \{\s*ui\.popup = false;/);
  assert.match(src('svelte/ContentPanel.svelte'), /ui\.popup && groups\.find/);
  assert.match(src('svelte/ui.svelte.js'), /if \(!popupStays\(list\.length\)\) ui\.popup = false/);
});

test('list click selects in the preview, scrolled to only when out of view', () => {
  assert.equal(offscreen({ top: 10, bottom: 200 }, 600), false);
  assert.equal(offscreen({ top: -5, bottom: 200 }, 600), true);
  assert.equal(offscreen({ top: 500, bottom: 700 }, 600), true);
  const card = src('svelte/SectionCard.svelte');
  assert.match(card, /selectWidgets\(\[id\]\);\s*reveal\(id\);/);
});

test('row hover outlines the widget in the preview, and the preview lights the row', () => {
  const ov = src('overlay.js');
  assert.match(ov, /ui\.hot\?\.from === 'panel' \? widgetEl\(ui\.hot\.id\)/);
  assert.match(ov, /hotWidget\(id, 'preview'\)/);
  assert.match(src('svelte/ui.svelte.js'), /ui\.hot = \{ id, from \}/);
  const card = src('svelte/SectionCard.svelte');
  assert.match(card, /ui\.hot = \{ id: widget\.id, from: 'panel' \}/);
  assert.match(src('svelte/WidgetRow.svelte'), /hot && 'is-hot'/);
});

test('a duplicated section: its links follow its own copies (else the page fails its check)', () => {
  const store = createStore();
  const page = {
    sections: [
      {
        id: 's-aaaa',
        widgets: [
          { id: 'w-aaaa', type: 'text', layout: { base: { col: 1, span: 10, row: 1, rows: 2 } } },
          {
            id: 'w-bbbb',
            type: 'text',
            layout: {
              base: { col: 1, span: 10, row: 4, rows: 2, link: { to: 'w-aaaa', gap: 1 } },
              phone: { link: { to: 'w-aaaa', gap: 1 } },
            },
          },
        ],
      },
    ],
  };
  store.load({ 'pages/x.json': page });
  duplicateSection(store, 'pages/x.json', 0);
  const [a, b] = store.current['pages/x.json'].sections;
  const ids = b.widgets.map((w) => w.id);
  assert.notEqual(b.id, a.id);
  assert.ok(ids.every((id) => !a.widgets.some((w) => w.id === id)));
  assert.equal(b.widgets[1].layout.base.link.to, ids[0], 'desktop link: its own copy');
  assert.equal(b.widgets[1].layout.phone.link.to, ids[0], 'phone link: its own copy');
  assert.equal(a.widgets[1].layout.base.link.to, 'w-aaaa', 'the original untouched');
});
