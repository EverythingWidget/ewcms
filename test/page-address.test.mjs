// A page's address (PageAddress.svelte, the SEO tab).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');

test('a disabled Rename says to type a new name first (F82)', () => {
  assert.match(
    src('PageAddress.svelte'),
    /title=\{value === name \? 'Type a new name in the field first' : undefined\}/,
  );
});
