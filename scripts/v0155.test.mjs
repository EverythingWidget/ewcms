// v0.1.55: a section's settings open in a floating pop-up (a card's double click or the
// toolbar's gear), a grey copy of the widget's; the slide-in section view is gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
const panel = src('svelte/ContentPanel.svelte');
const pop = src('svelte/SectionPopup.svelte');

test('the slide-in section view is gone', () => {
  assert.ok(!existsSync(new URL('../src/editor/svelte/SectionView.svelte', import.meta.url)));
  assert.doesNotMatch(panel, /SectionView|slide__pane|atWidget|gsap/);
});

test('the pop-up: rows icon, name, Locate, ×; the section settings; 380px, grey', () => {
  assert.match(pop, /fa-grip-lines/);
  assert.match(pop, /fa-location-crosshairs/);
  assert.match(pop, /fa-xmark/);
  assert.match(pop, /<SectionSettings \{live\} \{bridge\} \{file\} \{at\} \{sections\} \/>/);
  assert.match(pop, /width: 380px;/);
  assert.match(pop, /background: var\(--c-card\);/);
  assert.match(pop, /background: var\(--c-sec-pop-head\);/);
  assert.match(pop, /background: var\(--c-text\);\s*color: var\(--c-on-light\);/);
  const tok = src('styles/_tokens.scss');
  for (const v of ['#313131', '#343433', '#6f6f6f']) assert.ok(tok.includes(v), v);
  // Esc: the editor's own Esc skips it (.wpop), it closes itself
  assert.match(pop, /class=\{\['wpop', 'spop'/);
});

test('one settings pop-up at a time; it goes with its section', () => {
  assert.match(panel, /function openSection\(id\) \{\s*selectSection\(id\);\s*ui\.section = id;/);
  assert.match(panel, /function openWidget\(id\) \{\s*ui\.section = null;/);
  assert.match(panel, /sections\.some\(\(s\) => s\?\.id === ui\.section\)/);
});

test('the toolbar: a gear, pressed while open', () => {
  const tb = src('svelte/SectionToolbar.svelte');
  assert.doesNotMatch(tb, /pen-to-square/);
  assert.match(tb, /aria-pressed=\{ui\.section === s\.id\}/);
});
