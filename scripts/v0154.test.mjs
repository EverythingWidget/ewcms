// v0.1.54: the widget toolbar stays up while a widget is moved or resized (its size and
// position readout updates live); it only lets the pointer through so it never takes the drag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(
  new URL('../src/editor/svelte/WidgetToolbar.svelte', import.meta.url),
  'utf8',
);

test('a drag no longer hides the toolbar', () => {
  assert.match(src, /const shown = \$derived\(!!\(where && widget && pos && !peeking\)\);/);
  assert.doesNotMatch(src, /\bhidden = drag\b/);
  assert.match(src, /if \(drag !== dragging\) dragging = drag;/);
});

test('while dragging the bar is see-through for the pointer', () => {
  assert.match(src, /dragging && 'is-dragging'/);
  assert.match(src, /&\.is-dragging \{\s*pointer-events: none;\s*\}/);
});
