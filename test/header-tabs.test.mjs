// Header (Pages › Header): Menu and Elements tabs; menu items are border-only cards;
// Elements holds Title, Logo, CTA and Labels as collapsible cards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('Header: Menu and Elements tabs sit above the body, like a page’s tabs', () => {
  const panel = read('editor/svelte/ContentPanel.svelte');
  assert.match(panel, /const isHeader = \$derived\(ui\.target\?\.id === 'header'\)/);
  assert.match(panel, /\['menu', 'Menu'\],\s*\['elements', 'Elements'\]/);
  assert.match(panel, /ui\.sections\.headertab/);
  assert.match(panel, /class="page-tabs"/);
  assert.match(panel, /\{:else if isHeader\}/);
  assert.match(panel, /<HeaderPart \{live\} tab=\{headerTab\}/);
  assert.match(panel, /role=\{isPage \|\| isHeader \? 'tabpanel'/);
});

test('HeaderPart: Menu is card list items; Elements is four collapsible cards', () => {
  const src = read('editor/svelte/HeaderPart.svelte');
  assert.match(src, /tab = 'menu'/);
  assert.match(src, /\{#if tab === 'menu'\}/);
  // Menu: no Menu heading; items and dropdown links are cards
  assert.doesNotMatch(src, /<h3>Menu<\/h3>/);
  assert.match(src, /The nav at the top and the phone menu/);
  assert.match(src, /addLabel="Add link"\s+cards/);
  assert.match(src, /label="Dropdown links"[\s\S]*?cards/);
  // Elements: four collapsibles; CTA switch on the bar
  for (const key of ['header:title', 'header:logo', 'header:cta', 'header:labels']) {
    assert.match(src, new RegExp(`key="${key}"`));
  }
  assert.match(src, /title="Title"/);
  assert.match(src, /title="Logo"/);
  assert.match(src, /title="CTA button"/);
  assert.match(src, /title="Labels"/);
  assert.match(src, /\{#snippet bar\(\)\}/);
  assert.match(src, /aria-label="Show the CTA button"/);
  assert.match(src, /live\.store\.set\(SITE, '\/name'/);
  assert.match(src, /live\.store\.set\(HEADER, '\/logo'/);
  assert.match(src, /live\.store\.set\(HEADER, '\/cta\/show'/);
  assert.match(src, /type="photo"/);
  assert.match(src, /empty="None"/);
});

test('site parts: Header subtitle names the logo and button', () => {
  const parts = read('editor/lib/site-parts.js');
  assert.match(parts, /card: 'Menu, logo and button'/);
  assert.match(parts, /sub: 'The menu, logo and button'/);
});
