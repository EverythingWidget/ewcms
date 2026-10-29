// The shared popover (Popover.svelte): portalled, fixed, centred 4px under its trigger, 8px inside
// the popup; Aspect's ratios and the Position picker (Position.svelte) use it
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const pov = read('src/editor/svelte/Popover.svelte');
const pos = read('src/editor/svelte/Position.svelte');
const wl = read('src/editor/svelte/WidgetLayout.svelte');
const field = read('src/editor/svelte/Field.svelte');
const tokens = read('src/editor/styles/_tokens.scss');

test('popover: portalled, fixed, centred and clamped, its look', () => {
  assert.match(pov, /document\.body\.appendChild\(node\)/);
  assert.match(pov, /position: fixed/);
  assert.match(pov, /const GAP = 4;/);
  assert.match(pov, /const EDGE = 8;/);
  assert.match(pov, /a\.left \+ a\.width \/ 2 - w \/ 2/);
  assert.match(pov, /width = 190/);
  assert.match(pov, /width === 'anchor'/);
  assert.match(pov, /background: var\(--c-surface\)/);
  assert.match(pov, /0 0 0 1px var\(--c-popover-ring\)/);
  assert.match(pov, /0 12px 32px var\(--c-popover-shadow\)/);
  assert.match(pov, /padding: var\(--space-2\)/);
  assert.match(pov, /border-radius: var\(--radius-md\)/);
  assert.match(pov, /'Escape'/);
  assert.match(pov, /addEventListener\('scroll', follow, true\)/);
  assert.match(tokens, /--c-popover-ring: #262626;/);
  assert.match(tokens, /--c-popover-fill: rgb\(255 255 255 \/ 0\.07\)/);
  assert.match(tokens, /--c-popover-dim: rgb\(255 255 255 \/ 0\.38\)/);
  assert.doesNotMatch(pov + pos, /accent|cyan|green/);
});

test('aspect ratios in the popover, three a row', () => {
  assert.match(wl, /<Popover/);
  assert.match(wl, /Ratio \(width:height\)/);
  assert.match(wl, /repeat\(3, 1fr\)/);
  assert.doesNotMatch(wl, /position: absolute/);
});

test('position picker: a button and a popover grid, axes; a spot field uses it', () => {
  assert.match(pos, /axes = 'both'/);
  assert.match(pos, /axes === 'v' \? 1 : 3/);
  assert.match(pos, /axes === 'h' \? 1 : 3/);
  assert.match(pos, /<Popover/);
  assert.match(pos, /open = false;/);
  assert.match(field, /<Position /);
  assert.doesNotMatch(field, /class="spot"/);
});
