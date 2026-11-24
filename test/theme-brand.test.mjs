// --brand in the theme is the site's fixed brand colour; theme.js tweens --accent only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkContent, contentWarnings } from '../src/render/validate.js';
import { head } from '../src/render/shell/layout.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('--brand is the theme token, fixed; theme.js tweens --accent only', () => {
  assert.match(read('default-site/theme/tokens.scss'), /--brand: #cfc8b8;/);
  assert.doesNotMatch(read('default-site/theme/tokens.scss'), /--site-accent/);
  assert.doesNotMatch(read('src/render/shell/layout.js'), /--site-accent/);
  assert.doesNotMatch(read('src/render/render.js'), /site\.accent/);
  const theme = read('src/client/theme.js').replace(/\/\*\*[\s\S]*?\*\//, '');
  assert.doesNotMatch(theme, /--brand/);
  const chrome = read('src/client/styles/_chrome.scss');
  assert.match(chrome, /&\.is-active \{\s*color: var\(--menu-active-fg, var\(--brand\)\);/); // the phone menu's current page (F96: a token, --brand its default)
});

test('glass follows --brand; the album --accent tints only the background glow (F91)', () => {
  const glass = read('src/client/styles/_glass.scss').replace(/\/\/.*$/gm, '');
  assert.match(
    glass,
    /--glass-fill: color-mix\(in oklab, var\(--brand\) 8%, var\(--glass-base\)\);/,
  );
  assert.match(
    glass,
    /--glass-fill-hover: color-mix\(in oklab, var\(--brand\) 12%, var\(--glass-base-hover\)\);/,
  );
  assert.doesNotMatch(glass, /--accent/);
  assert.match(glass, /\.btn \{[\s\S]*?background: var\(--btn-bg, var\(--glass-fill\)\);/); // .btn, Send
  const base = read('src/client/styles/_base.scss');
  assert.match(base, /color-mix\(in oklab, var\(--accent\) 26%, transparent\)/); // the glow keeps the album tint
  // header pill, dropdowns, phone menu, carousel arrows, Button and Send are all .glass
  const header = read('src/render/shell/header.js');
  assert.match(header, /class="dropdown glass"/);
  assert.match(header, /class="mmenu__panel glass"/);
  assert.match(header, /class="menu-toggle glass"/);
  assert.match(read('src/widgets/list/carousel.js'), /car__arrow car__arrow--prev glass/);
  assert.match(read('src/widgets/form/index.js'), /class="btn glass cform__submit"/);
  assert.match(read('src/widgets/button/index.js'), /class="btn glass"/);
});

test('a leftover site.json accent is only a warning (F91)', () => {
  const site = {
    version: 1,
    name: 'X',
    url: 'https://example.com',
    accent: '#cfc8b8',
  };
  assert.deepEqual(checkContent('site.json', site), []);
  assert.match(contentWarnings().join(), /"accent" is no longer used: set --brand in the theme/);
  const clean = { version: 1, name: 'X', url: 'https://example.com' };
  assert.deepEqual(checkContent('site.json', clean), []);
  assert.deepEqual(contentWarnings(), []);
});

test('the page head sets --accent only for an album colour, never --site-accent (F91)', () => {
  const ctx = { site: { name: 'X', url: 'https://example.com', accent: '#cfc8b8' }, route: {} };
  const album = head(ctx, { page: 'home' }, '#c9a27a');
  assert.match(album, /--accent: #c9a27a/);
  assert.doesNotMatch(album, /--site-accent/);
  const plain = head(ctx, { page: 'home' }, '');
  assert.doesNotMatch(plain, /--accent:/);
  assert.doesNotMatch(plain, /--site-accent/);
});
