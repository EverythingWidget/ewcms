// v0.1.56: the pages list's head in a folder: a whole-row "← Return to /parent/" button (as
// Return to navigation), then the path with + on its own row; the arrow-only back is gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/editor/svelte/PagesList.svelte', import.meta.url), 'utf8');

test('in a folder: one Return to button for the parent, its path as it is', () => {
  assert.doesNotMatch(src, /pl-top__back/);
  assert.match(src, /class="pl-return"[\s\S]*?onclick=\{\(\) => go\(parentId\(level\)\)\}/);
  assert.match(
    src,
    /Return to\s*<span class="pl-return__path">\{pathOfId\(parentId\(level\)\)\}<\/span>/,
  );
  assert.match(src, /\.pl-return__path \{[\s\S]*?text-transform: none;/);
});

test('32px, muted 11px uppercase; hovered: a control-hover fill 8px past each side', () => {
  const css = src.slice(src.indexOf('  .pl-return {'), src.indexOf('  .pl-return__path {'));
  assert.match(css, /height: var\(--size-control\);/);
  assert.match(css, /color: var\(--c-text-muted\);/);
  assert.match(css, /font-size: var\(--fs-sm\);/);
  assert.match(css, /text-transform: uppercase;/);
  assert.match(css, /inset: 0 calc\(-1 \* var\(--space-2\)\);/);
  assert.match(css, /&:hover::before \{\s*background: var\(--c-control-hover\);/);
  assert.match(css, /&:hover \{\s*color: var\(--c-text\);/);
});
