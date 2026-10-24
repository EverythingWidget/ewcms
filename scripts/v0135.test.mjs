// v0.1.35 (fields v2): a widget's fields one a row in the pop-up, the photo field in the
// pop-up's scheme (variant A), a section's Height / Width as joined button groups
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');

test("a widget's own fields: one a row (only list items pair halves)", () => {
  const g = read('GroupFields.svelte');
  assert.match(g, /\{#each run\.fields as f \(f\.edit\)\}\{@render field\(f, false\)\}/);
  assert.match(g, /pairedHalves\(fields\)/); // a list item's rows
});

test('the photo field in the pop-up: its fill, a 12% thumb, 35% text and icons, 17% hover', () => {
  const p = read('WidgetPopup.svelte');
  assert.match(p, /:global\(\.photo\) \{\s*background: var\(--on-card-fill\);\s*box-shadow: none;/);
  assert.match(p, /:global\(\.photo__thumb\) \{\s*background: var\(--on-card-12\);/);
  assert.match(
    p,
    /:global\(\.photo \.btn--icon:hover:not\(:disabled\)\) \{\s*background: var\(--on-card-hover\);/,
  );
});

test('Height / Width: joined, no padding or gaps, 40px buttons, a hover wash', () => {
  const s = read('SectionSettings.svelte');
  const hset = s.match(/\n {2}\.hset \{[^}]*\}/)[0];
  assert.doesNotMatch(hset, /gap|padding/);
  assert.match(hset, /overflow: hidden/);
  const btn = s.match(/\n {2}\.hset__btn \{[\s\S]*?\n {2}\}/)[0];
  assert.match(btn, /width: 40px/);
  assert.match(btn, /border-radius: 0/);
  assert.match(
    btn,
    /&:hover \{\s*color: var\(--c-text-strong\);\s*background: var\(--c-pop-hover\);/,
  );
});
