// The ease picker opens in the shared popover: a select's width, neutral selection, the roles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../src/editor/${p}`, import.meta.url), 'utf8');

test('EasePicker: the grid in Popover, anchored to its toggle at its width', () => {
  const s = read('svelte/EasePicker.svelte');
  assert.match(s, /import Popover from '\.\/Popover\.svelte';/);
  assert.match(
    s,
    /<Popover\s+\{open\}\s+anchor=\{btn\}\s+width="anchor"\s+min=\{GRID_W\}[\s\S]*?onclose=/,
  );
  assert.match(s, /min=\{GRID_W\}/);
  assert.match(s, /const GRID_W = 4 \* 62 \+ 3 \* 4 \+ 2 \* 8;/);
  assert.match(s, /<Popover[\s\S]*class="ease__grid"[\s\S]*<\/Popover>/);
  assert.match(
    read('svelte/Popover.svelte'),
    /width === 'anchor' \? Math\.max\(a\.width, min\) : width/,
  );
});

test('ease options: role colours, a neutral selected look, no accent', () => {
  const css = read('styles/editor.scss');
  const opt = css.slice(css.indexOf('.ease__opt {'), css.indexOf('.ease__custom {'));
  assert.doesNotMatch(opt, /c-accent|white-a06|c-text-muted/);
  assert.match(opt, /&:hover \{\s*background: var\(--field-hover\);/);
  assert.match(opt, /&\.is-active \{\s*background: var\(--selected-bg\);/);
  assert.match(opt, /stroke: var\(--selected-fg\);/);
  const grid = css.slice(css.indexOf('.ease__grid {'), css.indexOf('.ease__opt {'));
  assert.doesNotMatch(grid, /background|padding|margin/);
});
