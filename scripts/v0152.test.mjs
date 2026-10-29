// v0.1.52: the widget toolbar collapses its marks by the preview's width (not the widget's);
// its end holds the layout part (Auto toggle, size and place), the on-widget tag is gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tagParts } from '../src/editor/widget-tag.js';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('the marks go into … by the frame width only', () => {
  const s = src('svelte/WidgetToolbar.svelte');
  assert.match(s, /const room = box\.frameRight - box\.frameLeft - 16;/);
  assert.doesNotMatch(s, /Math\.max\(box\.w, 280\)/);
});

test('every widget gets the toolbar: divider (text only), Auto, its size', () => {
  const s = src('svelte/WidgetToolbar.svelte');
  assert.match(s, /const shown = \$derived\(!!\(where && widget && pos && !peeking\)\)/);
  assert.match(s, /\{#if hasText\}<span class="btb__div"/);
  assert.match(s, /fa-solid fa-up-down/);
  assert.match(s, /class="btb__size"/);
  assert.match(s, /width: 16ch;/);
});

test('the size text', () => {
  const p = { col: 1, span: 64, row: 4, rows: 22 };
  assert.equal(tagParts(p).size, '64×22');
  assert.equal(tagParts(p, null, true).size, '64×auto');
});

test('the on-widget tag is hidden', () => {
  assert.match(src('overlay.js'), /\.label \{ display: none;/);
});
