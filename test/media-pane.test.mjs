// The Media pane: one column, its head sticky; uploads, file names, alt text prompts (F72, F74).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');

test('the Media pane: one column, its head (Use this photo) sticky', () => {
  const m = readFileSync(
    new URL('../src/editor/svelte/MediaModal.svelte', import.meta.url),
    'utf8',
  );
  assert.match(m, /\.media-detail \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(m, /\.media-detail__head \{[^}]*position: sticky/);
});

test('Media: one summary after several uploads, file names on tiles, a prompt for alt text (F72, F74)', () => {
  const m = src('MediaModal.svelte');
  assert.match(m, /toast\(`Uploaded \$\{done\} of \$\{total\} photos`/);
  assert.match(m, /<span class="mtile__name" aria-hidden="true">\{photoInfo\(k\)\.name\}<\/span>/);
  assert.match(m, /class="media-alt-missing">None yet: please add one/);
  assert.match(m, /toast\('This photo has no alt text yet'/);
});
