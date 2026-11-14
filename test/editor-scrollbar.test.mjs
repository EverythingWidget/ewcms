// One scrollbar style in the editor, defined once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('one scrollbar style in the editor, defined once', () => {
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
