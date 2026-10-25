// v0.1.46: the selected widget is dragged where widgets overlap; Size -> Rows starts from the
// rows it shows. v0.1.48: the layout number fields gone; a link drag keeps the widget's place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('v0.1.46: the selected widget is dragged where widgets overlap; a click picks the top one', () => {
  const o = read('src/editor/overlay.js');
  assert.match(o, /const el = selectedUnder\(e, mod\) \|\| top;/);
  assert.match(o, /else if \(click\) \(\(ui\.anchor = click\), onpick\(click\)\);/);
  // Size -> Rows from the shown rows (the phone's: doubled)
  assert.match(read('src/editor/svelte/WidgetLayout.svelte'), /phoneView \? n \* 2 : n/);
});

test('v0.1.48: a link drag keeps the widget where it is (the gap: the rows between them)', () => {
  const o = read('src/editor/overlay.js');
  assert.match(o, /onlink\(id, near\.id, b\.row - \(a\.row \+ a\.rows\), \{ mobile: phone \}\)/);
  assert.doesNotMatch(o, /onlink\(id, near\.id, 0,/);
});

test('v0.1.48: no layout number fields on a widget (placed and sized in the preview)', () => {
  const l = read('src/editor/svelte/WidgetLayout.svelte');
  for (const label of [
    'Width (columns)',
    'Left (column)',
    'Top (row)',
    'Gap (rows)',
    'label="Rows"',
  ])
    assert.ok(!l.includes(label), label);
  assert.match(l, /Follows \{leader\}, gap \{link\.gap\}/);
  const ops = read('src/editor/layout-ops.js');
  assert.ok(!/export function (setColumns|setGap)\b/.test(ops));
});
