// A widget's fields in the pop-up: one a row, the photo field, Height / Width, no layout numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');
const readRoot = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test("a widget's own fields: one a row (only list items pair halves)", () => {
  const g = read('GroupFields.svelte');
  assert.match(g, /\{#each run\.fields as f \(f\.edit\)\}\{@render field\(f, false\)\}/);
  assert.match(g, /pairedHalves\(fields\)/); // a list item's rows
});

test('the photo field in the pop-up: its fill, a 12% thumb, 35% text and icons, a hover wash', () => {
  // the photo reads the role colours; the pop-up (a surface) sets them
  const f = read('Field.svelte');
  assert.match(f, /\.photo \{[^}]*background: var\(--field-bg\);/);
  assert.match(f, /background: var\(--field-tile\);/);
  const p = read('WidgetPopup.svelte');
  assert.match(p, /@include surface\(/);
  assert.match(
    p,
    /:global\(\.photo \.btn--icon:hover:not\(:disabled\)\),\s*:global\(\.sc \.btn:hover\) \{\s*background: var\(--field-hover\);/,
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
    /&:hover \{\s*color: var\(--text-strong\);\s*background: var\(--field-hover\);/,
  );
});

test('no layout number fields on a widget (placed and sized in the preview)', () => {
  const l = readRoot('src/editor/svelte/WidgetLayout.svelte');
  for (const label of [
    'Width (columns)',
    'Left (column)',
    'Top (row)',
    'Gap (rows)',
    'label="Rows"',
  ])
    assert.ok(!l.includes(label), label);
  assert.match(l, /Follows \{leader\}, gap \{link\.gap\}/);
  const ops = readRoot('src/editor/layout-ops.js');
  assert.ok(!/export function (setColumns|setGap)\b/.test(ops));
});

test('half fields shrink inside the pop-up: .fields items and inputs have min-width 0', () => {
  const css = readRoot('src/editor/styles/editor.scss');
  const fields = css.match(/\.fields \{[\s\S]*?\n\}/)[0];
  assert.match(fields, /> \* \{[\s\S]*?min-width: 0;/);
  assert.match(css, /\.tf \{[\s\S]*?min-width: 0;/);
  assert.match(css, /\.tf__input \{[\s\S]*?min-width: 0;/);
  const lf = read('ListField.svelte');
  assert.match(lf, /\.lf \{[\s\S]*?min-width: 0;/);
  assert.match(lf, /\.lf__item \{[\s\S]*?min-width: 0;/);
});
