// Single-axis Position icons (bars) and the Button label edited in its popup only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the button widget has no inline-edit marker (its label: the popup only)', () => {
  const src = read('src/site/widgets/button/index.js');
  assert.doesNotMatch(src, /widget\.ed\(/);
  assert.match(src, /key: 'label'/);
});

test('the text widget stays editable in the preview', () => {
  assert.match(read('src/site/widgets/text/index.js'), /widget\.ed\('body', 'rich'\)/);
});

test('Position: bars for one axis (trigger and cells), the dot grid for both', () => {
  const src = read('src/editor/svelte/Position.svelte');
  assert.match(src, /\{#snippet bars\(i, size\)\}/);
  assert.match(src, /\{@render bars\(at, 12\)\}/);
  assert.match(src, /\{@render bars\(/);
  assert.match(src, /axes === 'h'/);
  assert.match(src, /\{#if axes === 'both'\}<i class="pos__dot"><\/i>/);
});
