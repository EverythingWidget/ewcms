// --brand in the theme is the site's fixed brand colour; theme.js tweens --accent only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkContent, contentWarnings } from '../src/render/validate.js';
import { head } from '../src/render/shell/layout.js';
import { brandOf, checkTheme, themeColorOf, themeVars, THEME_VARS } from '../src/render/theme.js';

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

test('leftover site.json look keys are only warnings: accent, themeColor, type, typography, layout', () => {
  const site = {
    version: 1,
    name: 'X',
    url: 'https://example.com',
    accent: '#cfc8b8',
    themeColor: '#050505',
    type: { heading: { min: 1 } },
    typography: {},
    layout: { containedCols: 3 },
  };
  assert.deepEqual(checkContent('site.json', site), []);
  const w = contentWarnings().join('\n');
  assert.match(w, /"accent" is no longer used: set the brand color in content\/theme\.json/);
  assert.match(w, /"themeColor" moved to content\/theme\.json "color": \{ "themeColor" \}/);
  assert.match(w, /"type" moved to content\/theme\.json "typography"/);
  assert.match(w, /"typography" is not a site setting/);
  assert.match(w, /"layout" moved to content\/theme\.json "layout"/);
  const clean = { version: 1, name: 'X', url: 'https://example.com' };
  assert.deepEqual(checkContent('site.json', clean), []);
  assert.deepEqual(contentWarnings(), []);
});

test('theme.json: color (#rrggbb only), typography, layout; nothing else', () => {
  const ok = {
    version: 1,
    color: { brand: '#CC2020', themeColor: '#050505' },
    typography: { heading: { min: 30, max: 90, line: 1 } },
    layout: { containedCols: 96, sectionSpace: 2 },
  };
  assert.deepEqual(checkContent('theme.json', ok), []);
  assert.deepEqual(checkContent('theme.json', { version: 1 }), []);
  const { version: _v, ...d } = ok; // eslint-disable-line no-unused-vars
  for (const brand of ['red', '#ggg000', '#fff', '#cfc8b8cc', '#fff; }', 'var(--x)', 12])
    assert.match(
      checkTheme({ ...d, color: { brand } }).join(),
      /"color\.brand" must be a hex color #rrggbb/,
      String(brand),
    );
  assert.match(
    checkTheme({ color: { themeColor: 'black' } }).join(),
    /"color\.themeColor" must be/,
  );
  assert.match(
    checkTheme({ color: { accent: '#ffffff' } }).join(),
    /"color\.accent" is not a color setting/,
  );
  assert.match(checkTheme({ color: '#ffffff' }).join(), /"color" must be an object/);
  assert.match(checkTheme({ type: {} }).join(), /"type" is "typography" now/);
  assert.match(checkTheme({ fonts: {} }).join(), /"fonts" is not a theme setting/);
  assert.match(
    checkTheme({ typography: { heading: { min: 0 } } }).join(),
    /typography\.heading\.min must be more than 0/,
  );
  assert.match(checkTheme({ layout: { containedCols: 200 } }).join(), /layout\.containedCols/);
  // values
  assert.equal(brandOf(ok), '#cc2020');
  assert.equal(brandOf({ color: { brand: 'red' } }), '');
  assert.equal(themeColorOf(ok), '#050505');
  assert.equal(themeColorOf({}), '');
  assert.equal(themeVars({}), '');
  assert.match(
    themeVars(ok),
    /^--brand: #cc2020; --type-heading-min: 30px; .*--contain: 96; --section-space: 2$/,
  );
  assert.ok(THEME_VARS.includes('--brand') && THEME_VARS.includes('--contain'));
});

test('the page head: theme.json brand, typography and layout in :root:root (beats tokens.scss)', () => {
  const site = { name: 'X', url: 'https://example.com', accent: '#123456', themeColor: '#000000' };
  const theme = {
    color: { brand: '#cc2020' },
    typography: { title: { max: 200 } },
    layout: { containedCols: 100 },
  };
  const h = head({ site, theme, route: {} }, { page: 'home' }, '');
  assert.match(
    h,
    /:root:root \{\s*--brand: #cc2020; --type-title-max: 200px; --contain: 100;\s*\}/,
  );
  // nothing from site.json, nothing at all without a theme.json
  const none = head(
    {
      site: { ...site, type: { title: { max: 9 } }, layout: { containedCols: 99 } },
      theme: {},
      route: {},
    },
    { page: 'home' },
    '',
  );
  assert.doesNotMatch(none, /accent-init|--brand|--type-|--contain/);
  // the theme's stylesheet comes after this head in dev and build: :root:root wins over its :root
  assert.match(read('src/render/shell/layout.js'), /:root:root \{/);
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
