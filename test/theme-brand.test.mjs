// --brand is the site accent, fixed; theme.js tweens --accent only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('--brand is the site accent, fixed; theme.js tweens --accent only', () => {
  assert.match(read('default-site/theme/tokens.scss'), /--brand: var\(--site-accent, #cfc8b8\);/);
  assert.match(
    read('src/render/shell/layout.js'),
    /--site-accent: \$\{esc\(ctx\.site\.accent \|\| accent\)\}/,
  );
  const theme = read('src/client/theme.js').replace(/\/\*\*[\s\S]*?\*\//, '');
  assert.doesNotMatch(theme, /--brand/);
  const chrome = read('src/client/styles/_chrome.scss');
  assert.match(chrome, /&\.is-active \{\s*color: var\(--menu-active-fg, var\(--brand\)\);/); // the phone menu's current page (F96: a token, --brand its default)
  assert.match(read('src/client/styles/_glass.scss'), /var\(--accent\) 8%/); // album tint stays
});
