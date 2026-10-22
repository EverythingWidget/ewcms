import test from 'node:test';
import assert from 'node:assert/strict';
import { circleGap, CIRCLE_CLEAR } from '../src/editor/svelte/toolbar-place.js';

test('the widget toolbar keeps clear of the link circles', () => {
  const box = { x: 100, y: 200, w: 400, h: 100 }; // circles centred at x 300
  assert.equal(circleGap(100, 360, box), CIRCLE_CLEAR); // across the middle
  assert.equal(circleGap(100, 150, box), 8); // ends before the circles
  assert.equal(circleGap(100, 187, box), 8); // 6px short of them
  assert.equal(circleGap(100, 189, box), CIRCLE_CLEAR);
  assert.equal(circleGap(320, 100, { ...box, x: 0, w: 600 }), 8); // starts after them
});
