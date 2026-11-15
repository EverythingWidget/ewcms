// F24/F11: an edit's sections swapped into the preview keep its scroll (layout-sync.js holdScroll).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holdScroll } from '../src/editor/layout-sync.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** A page scrolled to `y`, `height` tall, whose swap clamps or anchors the scroll elsewhere. */
function page(y, height) {
  const win = {
    scrollY: y,
    scrollTo(_x, top) {
      this.scrollY = top;
    },
  };
  const html = { scrollHeight: height, style: { minHeight: '', overflowAnchor: '' } };
  return { win, html, doc: { documentElement: html, defaultView: win } };
}

test('holdScroll: height and anchoring held during the swap, the scroll put back after', () => {
  const { win, html, doc } = page(500, 2400);
  const release = holdScroll(doc);
  assert.equal(html.style.minHeight, '2400px');
  assert.equal(html.style.overflowAnchor, 'none');
  win.scrollY = 0; // the swapped section's stored rows, or its anchor gone: the jump
  release();
  assert.equal(win.scrollY, 500);
  assert.deepEqual(html.style, { minHeight: '', overflowAnchor: '' });
});

test('holdScroll: nothing moved, nothing written; no document, no-op', () => {
  const { win, doc } = page(120, 900);
  let calls = 0;
  win.scrollTo = () => calls++;
  holdScroll(doc)();
  assert.equal(calls, 0);
  assert.doesNotThrow(() => holdScroll(null)());
});

test('renderSections swaps and remounts inside holdScroll', () => {
  const src = read('src/editor/main.js');
  const at = src.indexOf('function renderSections');
  const body = src.slice(at, src.indexOf('\n}\n', at));
  const hold = body.indexOf('holdScroll(bridge.doc)');
  assert.ok(hold > 0, 'renderSections holds the scroll');
  assert.ok(body.indexOf('swapSections(', hold) > hold);
  assert.ok(body.indexOf('remountView()', hold) > hold);
  assert.ok(body.indexOf('release()', hold) > body.indexOf('remountView()', hold));
});
