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
  assert.match(panel, /class="seg crole__mode"/); // the Button's Color / Glass / Transparent: the editor's .seg
  // theme.json is IN_PLACE: an edit rewrites #color-themes and theme-vars, no reload, no render job
  assert.equal(needsReload([THEME_FILE], { routes: false, site: false }), false);
  assert.match(read('src/editor/main.js'), /if \(files\.every\(\(f\) => f === THEME\)\) return;/);
  // the text styles: one flat list right after Text, in a theme and a template entry (no fold
  // under Heading or Text); Templates folded by default (ui.sections, unset: closed)
  assert.equal(panel.match(/\{#if (r\.key|key) === 'text'\}\s*\{#each TEXT_STYLE_ROWS as textStyle/g).length, 2);
  assert.doesNotMatch(panel, /Text styles \(|textStylesUnder|HEADING_TEXT/);
  assert.match(panel, /style:--fg=\{p\.title /); // the chip's Aa: Title
  // nothing moves: fixed-size chip,
  // one control's height per row (the Button's .seg, its swatches under it), the swatches kept
  // and greyed out (disabled) while Button isn't Color
  assert.match(panel, /const isOpen = \(name, what\) => !!ui\.sections\[foldKey\(name, what\)\];/);
  assert.match(panel, /\.cchip \{[^}]*width: 64px;[^}]*height: 20px;/);
  assert.match(panel, /\.crole__ctl \{[^}]*height: var\(--size-control\);/);
  assert.match(panel, /\.swatches \{[^}]*height: var\(--size-control\);/);
  assert.match(panel, /&\.is-off \{\s*opacity: var\(--o-disabled\);/);
  assert.match(panel, /class=\{\['swatches', !swatches && 'is-off'\]\}/);
  assert.match(panel, /inert=\{!swatches \|\| undefined\}/);
  // field-style swatches on a 7-column grid, every box the same size (a row of 6 leaves the 7th
  // empty, never stretches); the picked one: a 2px inner ring
  assert.match(panel, /\.swatches \{\s*display: grid;\s*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/);
  assert.doesNotMatch(panel, /flex: 1 1 0/);
  assert.match(panel, /\['color', 'Color'\],\s*\['glass', 'Glass'\],\s*\['transparent', 'Transparent'\]/);
  assert.match(panel, /\.swatch \{[^}]*border-radius: var\(--radius-md\);[^}]*background: var\(--swatch, var\(--field-bg\)\);/);
  assert.match(panel, /inset 0 0 0 2px var\(--focus-line\)/);
  assert.doesNotMatch(panel, /class="dot|\.dots \{/);
  // a colour of its own: its reset arrow, no dot; not saved yet: the yellow dot after its label;
  // a theme with any own colour: a reset arrow on its card's bar, in a slot kept while empty
  assert.match(panel, /class=\{\['crole', live\.changed\(THEME, ptr\) && 'is-unsaved'/);
  assert.match(panel, /\{#if row\.custom\}\s*<button\s+type="button"\s+class="crole__reset"/);
  assert.match(panel, /<span class="ctheme__reset">\s*\{#if customCount\(theme\(\), name\) > 0\}/);
  assert.match(panel, /unsaved=\{live\.changed\(THEME, `\/colorThemes\/\$\{name\}`\)\}/);
  assert.match(read('src/editor/styles/editor.scss'), /\.crole\.is-unsaved > \.tf__label::after/);
  const themePanel = read('src/editor/svelte/ThemePanel.svelte');
  assert.match(themePanel, /sub: 'Palette and color themes'/);
  assert.doesNotMatch(themePanel, /label="Brand color"|label="Color scheme"/);
});
