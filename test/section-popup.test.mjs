// A section's settings pop-up (a card's double click or the toolbar's gear).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
const panel = src('svelte/ContentPanel.svelte');
const pop = src('svelte/SectionPopup.svelte');

test('the pop-up: rows icon, name, Locate, ×; the section settings; 380px, grey', () => {
  assert.match(pop, /fa-grip-lines/);
  assert.match(pop, /fa-location-crosshairs/);
  assert.match(pop, /fa-xmark/);
  assert.match(pop, /<SectionSettings \{live\} \{bridge\} \{file\} \{at\} \{sections\} \/>/);
  assert.match(pop, /width: 380px;/);
  // a surface on the cards' grey, its head 9% lighter; fields and quiet text from it (12%: #3c3c3c,
  // 35%: #6f6f6f), the picked option light with black text (_mixins.scss surface())
  assert.match(
    pop,
    /@include surface\(var\(--c-card\), color-mix\(in srgb, var\(--white\) 9%, var\(--c-card\)\)\);/,
  );
  assert.match(pop, /background: var\(--surface-head\);/);
  const mix = src('styles/_mixins.scss');
  assert.match(mix, /--selected-bg: var\(--c-text\);\s*--selected-fg: var\(--c-on-light\);/);
  // Esc: the editor's own Esc skips it (.wpop), it closes itself
  assert.match(pop, /class=\{\['wpop', 'spop'/);
});

test('one settings pop-up at a time; it goes with its section', () => {
  assert.match(panel, /onsection=\{openSectionPopup\}/);
  assert.match(panel, /function openWidget\(id\) \{\s*selectWidgets\(\[id\]\);\s*openPopup\(\);/);
  assert.match(panel, /sections\.some\(\(s\) => s\?\.id === ui\.section\)/);
});

test('the toolbar: a gear, pressed while open', () => {
  const tb = src('svelte/SectionToolbar.svelte');
  assert.doesNotMatch(tb, /pen-to-square/);
  assert.match(tb, /aria-pressed=\{ui\.section === s\.id\}/);
});

test('Height and Width sit side by side without overlapping in the 380px pop-up', () => {
  const ss = src('svelte/SectionSettings.svelte');
  // a row of their own, columns as wide as the button groups — not .fields' 1fr 1fr halves
  assert.match(ss, /<div class="hw">/);
  assert.doesNotMatch(ss, /class=\{\['tf', 'is-half'/);
  const hw = ss.match(/\n {2}\.hw \{[^}]*\}/)[0];
  assert.match(hw, /grid-template-columns: max-content max-content/);
  assert.match(hw, /gap: var\(--gap-fields\)/);
  // five 40px Height buttons + the fields gap + two 40px Width buttons fit in the body
  // (380px, 12px padding each side); still fit if a scrollbar takes ~15px
  const tokens = src('styles/_tokens.scss');
  const space3 = Number(tokens.match(/--space-3: (\d+)px/)[1]);
  const gap = Number(tokens.match(/--gap-fields: (\d+)px/)[1]);
  const buttons = ss.match(/\.hset__btn \{[\s\S]*?width: (\d+)px;/)[1];
  assert.equal(Number(buttons), 40);
  const row = 5 * 40 + gap + 2 * 40;
  const body = 380 - 2 * space3;
  assert.ok(row <= body, `row ${row}px must fit in the ${body}px pop-up body`);
  assert.ok(row <= body - 15, `row ${row}px must still fit with a scrollbar`);
});
