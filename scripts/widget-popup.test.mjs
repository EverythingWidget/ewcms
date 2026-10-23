// The widget settings pop-up (v0.1.23): one only, swapped, closed, placed and kept in place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPopup, anchorPos, clampPos, POP_W } from '../src/editor/widget-popup.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const at = { panel: { left: 1028, top: 12 }, row: { top: 340 }, vw: 1440, vh: 900, h: 400 };

test('open, swap, close: one pop-up, its id', () => {
  const p = createPopup(mem());
  assert.equal(p.id, null);
  assert.deepEqual(p.open('b-1'), { swapped: false });
  assert.equal(p.id, 'b-1');
  assert.deepEqual(p.open('b-2'), { swapped: true }, 'another widget swaps the content');
  assert.equal(p.id, 'b-2');
  assert.deepEqual(p.open('b-2'), { swapped: false });
  assert.equal(p.close(), 'b-2', 'close gives the row to focus');
  assert.equal(p.id, null);
  assert.equal(p.close(), null);
});

test('placed 12px left of the panel, level with the row, inside the window', () => {
  assert.deepEqual(anchorPos(at), { left: 1028 - 12 - POP_W, top: 340 });
  // a row near the bottom: the pop-up lifted to fit
  assert.deepEqual(anchorPos({ ...at, row: { top: 800 } }), { left: 656, top: 900 - 12 - 400 });
  // taller than the window: from its top edge (it scrolls)
  assert.equal(anchorPos({ ...at, h: 2000 }).top, 12);
  assert.deepEqual(clampPos({ left: -50, top: -9 }, { vw: 1440, vh: 900 }), { left: 12, top: 12 });
  assert.deepEqual(clampPos({ left: 5000, top: 0 }, { vw: 1440, vh: 900 }), {
    left: 1068,
    top: 12,
  });
});

test('a dragged place is kept for the session and used for the next widget', () => {
  const store = mem();
  const p = createPopup(store);
  p.open('b-1');
  p.drag({ left: 240.4, top: 96.6 });
  p.open('b-2');
  assert.deepEqual(p.place(at), { left: 240, top: 97 });
  const again = createPopup(store); // the same tab, the editor reloaded
  assert.deepEqual(again.place(at), { left: 240, top: 97 });
  assert.deepEqual(createPopup(mem()).place(at), { left: 656, top: 340 });
});

test('the rows: a double click or Enter opens, a click selects; the open one highlighted', () => {
  const row = readFileSync(
    new URL('../src/editor/svelte/WidgetRow.svelte', import.meta.url),
    'utf8',
  );
  assert.match(row, /ondblclick=/);
  assert.match(row, /e\.key !== 'Enter'/);
  assert.match(row, /open && 'is-open'/);
  const panel = readFileSync(
    new URL('../src/editor/svelte/ContentPanel.svelte', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(panel, /<WidgetInspector/, 'no widget settings in the panel');
  assert.match(panel, /<WidgetPopup/);
});
