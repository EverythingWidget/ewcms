// A field's revert control (Field.svelte): only when it has a stored value, at the end of the
// 24px label row (no height shift). The unsaved-change dot is separate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test("a field's revert is only shown when it has a value, at the end of the label row", () => {
  const field = read('src/editor/svelte/Field.svelte');
  assert.match(field, /\{#if reset\?\.on\}/);
  assert.doesNotMatch(field, /disabled=\{!reset\.on\}/);
  assert.match(field, /\.tf__reset \{[^}]*margin-left: auto/);
  assert.doesNotMatch(field, /always reserved \(16px\)|always there \(disabled/);
});
