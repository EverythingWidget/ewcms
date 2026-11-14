// Multi-select (v0.1.24): the selection set, the section rule, box select, group moves and deletes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clampDelta, hits, range, selectedIds, toggle } from '../src/editor/multi-select.js';
import { createStore } from '../src/editor/store.js';
import { moveWidgets, removeWidgets } from '../src/editor/layout-ops.js';
import { placeOf, baseOf } from '../src/site/layout/index.js';

const secOf = (id) => (id.startsWith('a') ? 's-a' : 's-b');

test('Ctrl/Cmd+click toggles a widget in and out; no primary', () => {
  let ids = toggle([], 'a1', secOf);
  assert.deepEqual(ids, ['a1']);
  ids = toggle(ids, 'a2', secOf);
  assert.deepEqual(ids, ['a1', 'a2']);
  ids = toggle(ids, 'a1', secOf);
  assert.deepEqual(ids, ['a2'], 'the first one out leaves the other as it was');
  assert.deepEqual(selectedIds({ multi: ['a1', 'a2'], widget: null }), ['a1', 'a2']);
  assert.deepEqual(selectedIds({ multi: [], widget: 'a1' }), ['a1']);
  assert.deepEqual(range(['a1', 'a2', 'a3', 'a4'], 'a3', 'a1'), ['a1', 'a2', 'a3']);
});

test('Ctrl/Cmd held: a widget of another section is refused', () => {
  assert.equal(toggle(['a1', 'a2'], 'b1', secOf), null);
  assert.deepEqual(toggle([], 'b1', secOf), ['b1'], 'nothing selected: any section');
  // the panel and the preview both block it
  const card = readFileSync('src/editor/svelte/SectionCard.svelte', 'utf8');
  assert.match(card, /const blocked = \$derived\(ui\.mod && elsewhere\)/);
  const ov = readFileSync('src/editor/overlay.js', 'utf8');
  assert.match(ov, /closest\?\.\('\.block'\)/);
  assert.match(ov, /cursor: not-allowed/);
});

test('box select: the widgets the box touches', () => {
  const rects = {
    a1: { x: 0, y: 0, w: 100, h: 50 },
    a2: { x: 200, y: 0, w: 100, h: 50 },
    a3: { x: 0, y: 200, w: 100, h: 50 },
  };
  assert.deepEqual(hits(rects, { x: 90, y: 10, w: 120, h: 10 }).sort(), ['a1', 'a2']);
  assert.deepEqual(hits(rects, { x: 120, y: 100, w: 40, h: 40 }), []);
  assert.deepEqual(hits(rects, { x: 50, y: 240, w: 1, h: 1 }), ['a3']);
});

test('group move: clamped by the group bounding box, inside the grid', () => {
  const areas = {
    a1: { col: 3, span: 10, row: 2, rows: 4 },
    a2: { col: 100, span: 20, row: 6, rows: 2 },
  };
  assert.deepEqual(clampDelta(areas, -10, -10, 120), { dc: -2, dr: -1 }, 'left and top edges');
  assert.deepEqual(clampDelta(areas, 5, 3, 120), { dc: 1, dr: 3 }, 'the right edge (col 120)');
  assert.deepEqual(clampDelta(areas, 0, 0, 120), { dc: 0, dr: 0 });
});

const page = () => ({
  sections: [
    {
      id: 's-a',
      widgets: [
        { id: 'a1', type: 'text', layout: { base: { col: 1, span: 10, row: 1, rows: 2 } } },
        { id: 'a2', type: 'text', layout: { base: { col: 20, span: 10, row: 4, rows: 2 } } },
        {
          id: 'a3',
          type: 'text',
          layout: { base: { col: 40, span: 10, row: 1, rows: 2, link: { to: 'a2', gap: 1 } } },
        },
      ],
    },
  ],
});

test('group move: one undo step, every member by the same cells', () => {
  const store = createStore();
  store.load({ 'pages/x.json': page() });
  moveWidgets(store, 'pages/x.json', 0, ['a1', 'a2'], 3, 2);
  const w = store.current['pages/x.json'].sections[0].widgets;
  const p = (widget) => placeOf(baseOf(widget));
  assert.deepEqual([p(w[0]).col, p(w[0]).row], [4, 3]);
  assert.deepEqual([p(w[1]).col, p(w[1]).row], [23, 6]);
  assert.equal(store.dirtyFiles().length, 1);
  store.undo();
  assert.deepEqual(store.current['pages/x.json'], store.base['pages/x.json'], 'one step back');
});

test('group delete: all gone in one undo step, their followers free', () => {
  const store = createStore();
  store.load({ 'pages/x.json': page() });
  removeWidgets(store, 'pages/x.json', 0, ['a1', 'a2']);
  const w = store.current['pages/x.json'].sections[0].widgets;
  assert.deepEqual(
    w.map((widget) => widget.id),
    ['a3'],
  );
  assert.equal(baseOf(w[0]).link, undefined, 'a3 followed a2: free now');
  store.undo();
  assert.deepEqual(store.current['pages/x.json'], store.base['pages/x.json']);
});
