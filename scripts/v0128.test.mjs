// v0.1.28: InfoHelp (i) beside settings: Source, Layer, section Height / Width, Curtain
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');

test('InfoHelp: 16px circle, 11px icon, the surface roles, a 232px note of its own surface', () => {
  const s = src('InfoHelp.svelte');
  assert.match(s, /width: 16px;\s*height: 16px;/);
  assert.match(s, /font-size: var\(--fs-sm\)/); // 11px
  assert.match(s, /color: var\(--text-quiet\);/);
  assert.match(s, /color: var\(--text-strong\);\s*background: var\(--field-hover\);/);
  assert.match(s, /@include surface\(var\(--c-help-note\)\);/);
  assert.doesNotMatch(s, /ih-bg|\bbg\b =/, 'no bg prop');
  assert.match(s, /width: 232px/);
  assert.match(s, /font: 400 var\(--fs-base\) \/ 18px var\(--f-mono\)/);
  assert.match(s, /border-radius: 8px/);
  assert.match(s, /popover="manual"/);
  assert.match(s, /e\.key !== 'Escape'/);
  assert.match(s, /'pointerdown', away/);
  assert.match(s, /const up = /, 'flips above near the bottom');
});

test('placed on Source, Height / Width and the Curtain', () => {
  assert.match(src('WidgetSource.svelte'), /<InfoHelp label="About Source"/);
  // Layer's (v0.1.50): gone, its buttons' tooltips say it
  assert.doesNotMatch(src('WidgetLayout.svelte'), /InfoHelp/);
  const ss = src('SectionSettings.svelte');
  assert.match(ss, /<InfoHelp label="About \{title\}"/);
  assert.match(ss, /<b>Width<\/b>/);
  assert.match(
    src('TransitionPageCurtain.svelte'),
    /<b>Curtain<\/b>: a panel that covers the screen/,
  );
});
