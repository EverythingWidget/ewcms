// --brand is the site accent, fixed; theme.js tweens --accent only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('--brand is the site accent, fixed; theme.js tweens --accent only', () => {
  assert.match(
    read('theme-default/styles/_tokens.scss'),
    /--brand: var\(--site-accent, #cfc8b8\);/,
  );
  assert.match(
    read('src/site/templates/layout.js'),
    /--site-accent: \$\{esc\(ctx\.site\.accent \|\| accent\)\}/,
  );
  const theme = read('src/client/theme.js').replace(/\/\*\*[\s\S]*?\*\//, '');
  assert.doesNotMatch(theme, /--brand/);
  const chrome = read('theme-default/styles/_chrome.scss');
  assert.match(chrome, /&\.is-active \{\s*color: var\(--brand\);/);
  assert.match(read('theme-default/styles/_glass.scss'), /var\(--accent\) 8%/); // album tint stays
});
