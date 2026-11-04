// The panels a step apart; a photo row link without a label above.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the panels a step apart; a photo row link without a label above', () => {
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
