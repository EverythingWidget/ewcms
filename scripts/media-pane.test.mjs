// The Media pane: one column, its head sticky.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the Media pane: one column, its head (Use this photo) sticky', () => {
  const m = readFileSync(
    new URL('../src/editor/svelte/MediaModal.svelte', import.meta.url),
    'utf8',
  );
  assert.match(m, /\.md-detail \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(m, /\.md-detail__head \{[^}]*position: sticky/);
});
