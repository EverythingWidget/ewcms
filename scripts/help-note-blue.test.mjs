// The help note: a slate-blue surface, a 1px ring (shadow, also on the arrow), the pop-ups' shadow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../src/editor/${p}`, import.meta.url), 'utf8');

test('help note tokens and its surface', () => {
  const t = read('styles/_tokens.scss');
  assert.match(t, /--c-help-note: #16202e;/);
  assert.match(t, /--c-help-note-ring: #26324a;/);
  assert.match(t, /--c-text: var\(--sand-50\);/);
  assert.match(t, /--sand-50: #f2efe9;/);
  const s = read('svelte/InfoHelp.svelte');
  assert.match(s, /@include surface\(var\(--c-help-note\)\);/);
  assert.match(s, /box-shadow:\s*0 0 0 1px var\(--c-help-note-ring\),\s*var\(--shadow-pop\);/);
  assert.match(s, /box-shadow: -1px -1px 0 0 var\(--c-help-note-ring\);/);
  assert.match(s, /box-shadow: 1px 1px 0 0 var\(--c-help-note-ring\);/);
  assert.match(s, /:global\(b\) \{\s*color: var\(--text-strong\);/);
  assert.doesNotMatch(s, /border: 1px|border: solid/);
});
