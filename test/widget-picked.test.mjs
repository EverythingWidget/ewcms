// A widget picked in the preview: what its tab says, typing into a Text, Add widget, a photo
// shown at once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');

test("a Text's Content tab says its words are typed in the preview (F06, F15)", () => {
  const ins = src('WidgetInspector.svelte');
  assert.match(
    ins,
    /widget\.type === 'text'[\s\S]*Type the text in the preview: with the widget picked, just type/,
  );
  assert.match(src('WidgetSource.svelte'), /<b>None<\/b>: only\s+what you type/);
  assert.match(src('GroupFields.svelte'), /<b>Hide<\/b>: the widget is left out/);
});

test('a picked Text widget: Enter or a character typed edits its text (F45, F54)', () => {
  const main = readFileSync(new URL('../src/editor/main.js', import.meta.url), 'utf8');
  assert.match(
    main,
    /if \(bridge\.editWidget\(selectedIds\(ui\)\[0\], typed\)\) e\.preventDefault\(\);/,
  );
  const bridge = readFileSync(new URL('../src/editor/bridge.js', import.meta.url), 'utf8');
  assert.match(bridge, /if \(typed\) doc\.execCommand\('insertText', false, typed\);/);
  // the preview's keys reach it (not the browser) when not typing
  assert.match(bridge, /\(\(e\.key === 'Enter' \|\| e\.key\.length === 1\) &&/);
});

test('a picked widget has Add widget (to its section) next to its actions (F59)', () => {
  const t = src('SectionToolbar.svelte');
  assert.match(
    t,
    /label="Add widget to this section"[\s\S]*onclick=\{\(\) => onadd\(addOnly \? 0 : group\.at\)\}/,
  );
});

test('a photo picked renders its widget again: its <img> shows at once (F75)', () => {
  assert.match(
    src('MediaModal.svelte'),
    /live\.store\.set\(pick\.file, pick\.ptr, key, \{ source: 'panel', structure: true \}\);/,
  );
  assert.match(src('GroupFields.svelte'), /const structure =\s+f\.type === 'photo' \|\|/);
});
