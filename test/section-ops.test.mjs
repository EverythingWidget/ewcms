// Section operations: duplicate (links follow the copies) and delete (several in one undo step).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';
import { duplicateSection, removeSections } from '../src/editor/layout-ops.js';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
const P = 'pages/index.json';
const w = (id, base, extra = {}) => ({ id, type: 'text', layout: { base }, ...extra });
const page = () => ({
  version: 1,
  kind: 'page',
  id: 'pg-home',
  meta: { title: 'Home', description: 'x' },
  sections: [
    {
      id: 's-aaaa',
      widgets: [
        w('w-aaaa', { col: 1, span: 24, row: 1 }),
        w('w-bbbb', { col: 1, span: 24, row: 8 }),
        w('w-cccc', { col: 30, span: 24, row: 1, rows: 6 }, { size: 'rows' }),
      ],
    },
    { id: 's-bbbb', widgets: [] },
  ],
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

test('sections deleted at once, several in one undo step', () => {
  const F = P;
  const store = createStore();
  store.load({ [F]: page() });
  assert.equal(removeSections(store, F, ['s-aaaa', 's-bbbb']), true);
  assert.deepEqual(store.current[F].sections, []);
  store.undo();
  assert.deepEqual(store.current[F], page());
  assert.equal(removeSections(store, F, ['s-zzzz']), false);
  const card = src('svelte/SectionCard.svelte');
  assert.doesNotMatch(card, /alertdialog|deleting/);
  const tb = src('svelte/SectionToolbar.svelte');
  assert.match(tb, /label="Delete \{title\}"\s+onclick=\{\(\) => removeSelected\(\[s\.id\]\)\}/);
  assert.match(tb, /label="Delete \{many\.length\} sections"/);
});
