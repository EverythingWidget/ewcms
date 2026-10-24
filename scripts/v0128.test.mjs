// v0.1.28: InfoHelp (i) beside settings: Source, Layer, section Height / Width, Curtain
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');

test('InfoHelp: 16px circle, 11px icon, solid rest colour, 17% hover, a 232px note', () => {
  const s = src('InfoHelp.svelte');
  assert.match(s, /width: 16px;\s*height: 16px;/);
  assert.match(s, /font-size: var\(--fs-sm\)/); // 11px
  assert.match(s, /color-mix\(in srgb, var\(--white\) 35%, var\(--ih-bg\)\)/);
  assert.match(s, /background: var\(--white-a17\)/);
  assert.match(s, /width: 232px/);
  assert.match(s, /font: 400 var\(--fs-base\) \/ 18px var\(--f-mono\)/);
  assert.match(s, /border-radius: 8px/);
  assert.match(s, /popover="manual"/);
  assert.match(s, /e\.key !== 'Escape'/);
  assert.match(s, /'pointerdown', away/);
  assert.match(s, /const up = /, 'flips above near the bottom');
});

test('placed on Source, Layer, Height / Width and the Curtain', () => {
  assert.match(src('WidgetSource.svelte'), /<InfoHelp label="About Source"/);
  assert.match(src('WidgetLayout.svelte'), /<InfoHelp label="About Layer"/);
  const ss = src('SectionSettings.svelte');
  assert.match(ss, /<InfoHelp label="About \{title\}"/);
  assert.match(ss, /<b>Width<\/b>/);
  assert.match(src('PageCurtain.svelte'), /<b>Curtain<\/b>: a panel that covers the screen/);
});
