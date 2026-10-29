// v0.1.41: the hero fills its widget, a fixed --brand, one editor scrollbar, the panels' spacing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const block = (css, sel) =>
  css.slice(css.indexOf(`${sel} {`), css.indexOf('\n}', css.indexOf(`${sel} {`)));

test('v0.1.41: the hero takes its widget area; an Auto hero what its section leaves', () => {
  const home = read('theme-default/styles/_home.scss');
  const hero = block(home, '\n.hero');
  assert.match(hero, /height: 100%;/);
  assert.doesNotMatch(hero, /svh|min-height/);
  assert.match(
    block(home, '.wgt--auto > .hero'),
    /min-height: calc\(var\(--sec-h, 100svh\) - var\(--nav-h, 0px\)\)/,
  );
  const layout = read('src/client/styles/_layout.scss');
  for (const h of ['third', 'half', 'full'])
    assert.match(layout, new RegExp(`&--h-${h} \\{\\s*--sec-h: `));
});

test('v0.1.41: --brand is the site accent, fixed; theme.js tweens --accent only', () => {
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

test('v0.1.41: one scrollbar style in the editor, defined once', () => {
  const files = [];
  (function walk(d) {
    for (const e of readdirSync(new URL(`../${d}`, import.meta.url), { withFileTypes: true }))
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (/\.(svelte|scss|css|js)$/.test(e.name)) files.push(path.join(d, e.name));
  })('src/editor');
  const hits = files.filter((f) => /scrollbar-(width|color)|::-webkit-scrollbar/.test(read(f)));
  // (and its copy for the preview's page, injected: bridge.js)
  assert.deepEqual(hits, ['src/editor/bridge.js', 'src/editor/styles/editor.scss']);
  assert.match(
    read('src/editor/styles/editor.scss'),
    /:root,\n:root \* \{\n {2}scrollbar-width: thin;/,
  );
});

test('v0.1.41: the panels a step apart; a photo row link without a label above', () => {
  const tokens = read('src/editor/styles/_tokens.scss');
  for (const [k, v] of [
    ['fields', 16],
    ['rows', 8],
    ['items', 12],
    ['cards', 20],
  ])
    assert.match(tokens, new RegExp(`--gap-${k}: ${v}px;`));
  assert.match(read('src/editor/styles/editor.scss'), /gap: var\(--gap-fields\);/);
  const link = read('src/editor/svelte/LinkField.svelte');
  assert.match(
    link,
    /\{#if inline\}\s*<!--[^>]*-->\s*<Select\s[^>]*placeholder=\{label\}\s+aria-label=\{label\}/,
  );
  assert.match(read('src/editor/svelte/GroupFields.svelte'), /\{ inline: true \}/);
});
