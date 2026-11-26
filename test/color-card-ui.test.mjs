// Theme › Color (step 5): the card (ColorPart.svelte) reads colors.js and lib/color-themes.js,
// writes through the store, and keeps its sizes fixed (nothing moves).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { needsReload } from '../src/editor/lib/needs-reload.js';
import { THEME as THEME_FILE } from '../src/render/files.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the card: Theme › Color reads its labels from colors.js and writes through the store (no render job)', () => {
  const panel = read('src/editor/svelte/ColorPart.svelte');
  assert.match(panel, /from '\.\.\/lib\/color-themes\.js'/);
  assert.match(panel, /ROLES/);
  assert.doesNotMatch(panel, /'Background'|'Button text'/); // labels: ROLES'
  assert.match(panel, /live\.store\.set\(THEME/);
  assert.match(panel, /<Popover/); // the custom colour: the shared 190px popover
  assert.match(panel, /<Collapsible/); // the themes: the editor's cards
  assert.match(panel, /class="seg crole__mode"/); // the Button's Glass / Color / None: the editor's .seg
  // theme.json is IN_PLACE: an edit rewrites #color-themes and theme-vars, no reload, no render job
  assert.equal(needsReload([THEME_FILE], { routes: false, site: false }), false);
  assert.match(read('src/editor/main.js'), /if \(files\.every\(\(f\) => f === THEME\)\) return;/);
  // sub-roles folded by default (ui.sections, unset: closed); nothing moves: fixed-size chip,
  // one control's height per picker, the dots hidden (not removed) while Button isn't Color
  assert.match(panel, /const isOpen = \(name, what\) => !!ui\.sections\[foldKey\(name, what\)\];/);
  assert.match(panel, /\.cchip \{[^}]*width: 64px;[^}]*height: 20px;/);
  assert.match(panel, /\.crole__ctl \{[^}]*height: var\(--size-control\);/);
  assert.match(panel, /&\.is-hidden \{\s*visibility: hidden;/);
  // the custom marker: the editor's changed dot, absolute in the row's left padding
  assert.match(read('src/editor/styles/editor.scss'), /:is\(\.xrow, \.mlist__element, \.crole\)\.is-changed::before/);
  const themePanel = read('src/editor/svelte/ThemePanel.svelte');
  assert.match(themePanel, /sub: 'Palette and color themes'/);
  assert.doesNotMatch(themePanel, /label="Brand color"|label="Color scheme"/);
});
