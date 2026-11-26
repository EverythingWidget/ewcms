// --brand in the theme is the site's fixed brand colour; theme.js tweens --accent only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';
import { parseHTML } from 'linkedom';
import { applyColorScheme, applyColorThemes, applyThemeVars } from '../src/editor/theme-vars.js';
import { checkContent, contentWarnings } from '../src/render/validate.js';
import { head } from '../src/render/shell/layout.js';
import { brandOf, checkTheme, schemeOf, themeColorOf, themeVarList, themeVars, THEME_VARS } from '../src/render/theme.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('colours are the palette (content/theme.json), not tokens; theme.js tweens --accent only', () => {
  assert.doesNotMatch(read('default-site/theme/tokens.scss'), /^\s*--(brand|accent|fg|bg): /m);
  assert.deepEqual(JSON.parse(read('default-site/content/theme.json')).palette, [
    '#050505',
    '#101010',
    '#212121',
    '#cfc8b8',
    '#f2efe9',
  ]);
  assert.doesNotMatch(read('default-site/theme/tokens.scss'), /--site-accent/);
  assert.doesNotMatch(read('src/render/shell/layout.js'), /--site-accent/);
  assert.doesNotMatch(read('src/render/render.js'), /site\.accent/);
  const theme = read('src/client/theme.js').replace(/\/\*\*[\s\S]*?\*\//, '');
  assert.doesNotMatch(theme, /--brand/);
  const chrome = read('src/client/styles/_chrome.scss');
  assert.match(chrome, /&\.is-active \{\s*color: var\(--color-accent\);/); // the phone menu's current page: Accent
});

test('glass follows the color theme (Accent tint) on each glass element; the album --accent tints only the glow (F91)', () => {
  const glass = read('src/client/styles/_glass.scss').replace(/\/\/.*$/gm, '');
  assert.match(
    glass,
    /\.glass \{[\s\S]*?--glass-fill: color-mix\(in oklab, var\(--color-accent\) 8%, var\(--glass-base\)\);/,
  );
  assert.match(
    glass,
    /--glass-fill-hover: color-mix\(in oklab, var\(--color-accent\) 12%, var\(--glass-base-hover\)\);/,
  );
  assert.doesNotMatch(glass, /:root \{/); // not once on :root: a section's theme re-tints its glass
  assert.doesNotMatch(glass, /--accent/);
  assert.match(glass, /\.btn \{[\s\S]*?background: var\(--glass-fill\);/); // .btn, Send
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
    color: { brand: '#CC2020', themeColor: '#050505', scheme: 'dark' },
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
  assert.match(
    checkTheme({ color: { scheme: 'blue' } }).join(),
    /"color\.scheme" must be/,
  );
  assert.deepEqual(checkTheme({ color: { scheme: 'Light Dark' } }), []);
  // values
  assert.equal(brandOf(ok), '#cc2020');
  assert.equal(brandOf({ color: { brand: 'red' } }), '');
  assert.equal(themeColorOf(ok), '#050505');
  assert.equal(themeColorOf({}), '');
  assert.equal(schemeOf(ok), 'dark');
  assert.equal(schemeOf({ color: { scheme: 'Light Dark' } }), 'light dark');
  assert.equal(schemeOf({}), '');
  assert.equal(schemeOf({ color: { scheme: 'blue' } }), '');
  assert.equal(themeVars({}), '');
  assert.match(
    themeVars(ok),
    /^--brand: #cc2020; --palette-4: #cc2020; --type-heading-min: 30px; .*--contain: 96; --section-space: 2$/,
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
    /:root:root \{\s*--brand: #cc2020; --palette-4: #cc2020; --type-title-max: 200px; --contain: 100;\s*\}/,
  );
  // the block's style is <style id="theme-vars"> (the editor's preview rewrites it: theme-vars.js)
  assert.match(h, /<style id="theme-vars">/);
  assert.doesNotMatch(h, /accent-init/);
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
  // (the color themes' static style always comes: src/render/colors.js)
  assert.doesNotMatch(none.replace(/<style id="color-themes">[\s\S]*?<\/style>/, ''), /theme-vars|--brand|--type-|--contain/);
  // the theme's stylesheet comes after this head in dev and build: :root:root wins over its :root
  assert.match(read('src/render/shell/layout.js'), /:root:root \{/);
});

test('the page head sets --accent only for an album colour, never --site-accent (F91)', () => {
  const ctx = { site: { name: 'X', url: 'https://example.com', accent: '#cfc8b8' }, route: {} };
  const album = head(ctx, { page: 'home' }, '#c9a27a');
  assert.match(album, /--accent: #c9a27a/);
  assert.doesNotMatch(album, /--site-accent/);
  const plain = head(ctx, { page: 'home' }, '').replace(/<style id="color-themes">[\s\S]*?<\/style>/, '');
  assert.doesNotMatch(plain, /--accent:/);
  assert.doesNotMatch(plain, /--site-accent/);
});

test('Theme › Color: Brand color edits theme.json color.brand, #rrggbb only, a swatch picks it', () => {
  const panel = read('src/editor/svelte/ThemePanel.svelte');
  assert.match(panel, /id: 'color', icon: 'droplet', name: 'Color'/);
  assert.match(panel, /part === 'color'/);
  assert.doesNotMatch(panel, /<Collapsible|key="theme:color"/);
  assert.match(panel, /edit="\{THEME\}#\/color\/brand"/);
  assert.match(panel, /label="Brand color"/);
  // only a #rrggbb is stored (lowercase); empty clears it (the theme's --brand)
  assert.match(panel, /if \(v && !isThemeColor\(v\)\) return;\s*set\('color\/brand', v \? v\.toLowerCase\(\) : undefined\);/);
  // the swatch: the native picker, its value always #rrggbb
  assert.match(panel, /<input\s+type="color"\s+value=\{pickerValue\}/);
  assert.match(panel, /oninput=\{\(e\) => setBrand\(e\.currentTarget\.value\)\}/);
  // unset: the placeholder is the theme's --brand, read from the preview
  assert.match(panel, /getPropertyValue\('--brand'\)/);
  assert.match(panel, /placeholder=\{themeBrand\}/);
  // the reset goes back to the theme's
  assert.match(panel, /run: \(\) => setBrand\(''\)/);
  // set, typed or picked: the preview gets it with no reload (theme-vars.js via main.js)
  const t = themeVarList({ color: { brand: '#CC2020' } });
  assert.deepEqual(t, [['--brand', '#cc2020'], ['--palette-4', '#cc2020']]); // until a palette: slot 4 (colors.js)
});

test('a color picker dragged: one undo step, no page pass, the style written only when it differs', () => {
  // ThemePanel's set: one coalescing key per value, like a typed field (text:<file>#<ptr>)
  const panel = read('src/editor/svelte/ThemePanel.svelte');
  assert.match(panel, /key: `text:\$\{THEME\}#\/\$\{key\}`, source: 'panel'/);
  const store = createStore();
  store.load({ 'theme.json': { version: 1 } });
  const seen = [];
  store.on((e) => seen.push(e.files));
  for (let i = 0; i < 40; i++) {
    const v = `#${(0x200000 + i * 0x030201).toString(16).padStart(6, '0')}`;
    store.set('theme.json', '/color/brand', v, { key: 'text:theme.json#/color/brand', source: 'panel' });
  }
  assert.equal(seen.length, 40);
  assert.ok(store.undo());
  assert.equal(store.current['theme.json'].color?.brand, undefined); // all 40 in one step
  assert.equal(store.canUndo(), false);
  // main.js: theme.json alone stops after the variables and the draft (no text or section pass)
  const main = read('src/editor/main.js');
  const on = main.slice(main.indexOf('store.on(({ files, source: src'));
  assert.ok(on.indexOf('applyTheme(') < on.indexOf("if (files.every((f) => f === THEME)) return;"));
  assert.ok(on.indexOf("if (files.every((f) => f === THEME)) return;") < on.indexOf('patchTexts('));
  // the placeholders' effect follows the typography only (a string), not every theme.json edit
  assert.match(panel, /const ownKey = \$derived\(JSON\.stringify\(typeOf\(theme\(\)\)\)\);/);
  // the preview's style: written only when its text changes
  let writes = 0;
  let text = '';
  const el = { id: 'theme-vars', get textContent() { return text; }, set textContent(v) { writes++; text = v; } };
  const doc = { head: { prepend() {} }, getElementById: () => el };
  applyThemeVars(doc, { color: { brand: '#cc2020' } });
  applyThemeVars(doc, { color: { brand: '#cc2020' } });
  applyThemeVars(doc, { color: { brand: '#cc2020' }, typography: {} });
  assert.equal(writes, 1);
  applyThemeVars(doc, { color: { brand: '#2050cc' } });
  assert.equal(writes, 2);
});

test('Theme › Color: Color scheme edits theme.json color.scheme, in place, no reload', () => {
  const panel = read('src/editor/svelte/ThemePanel.svelte');
  assert.match(panel, /id: 'color', icon: 'droplet', name: 'Color'/);
  assert.match(panel, /part === 'color'/);
  assert.doesNotMatch(panel, /<Collapsible|key="theme:color"/);
  assert.match(panel, /edit="\{THEME\}#\/color\/scheme"/);
  assert.match(panel, /label="Color scheme"/);
  assert.match(panel, /type="select"/);
  assert.match(panel, /set\('color\/scheme', v \|\| undefined\)/);
  assert.match(panel, /run: \(\) => setScheme\(''\)/);
  // main.js: theme.json applies the look (variables and the color-scheme meta) and returns
  const main = read('src/editor/main.js');
  const on = main.slice(main.indexOf('store.on(({ files, source: src'));
  assert.ok(on.indexOf('applyTheme(') < on.indexOf("if (files.every((f) => f === THEME)) return;"));
  assert.match(main, /if \(files\.includes\(THEME\)\) applyTheme\(/);
  // the meta is written, updated or removed, only when it differs; it sits after theme-color
  const { document } = parseHTML(
    '<!doctype html><html><head><meta name="theme-color" content="#050505" /></head><body></body></html>',
  );
  applyColorScheme(document, { color: { scheme: 'dark' } });
  const el = document.querySelector('meta[name="color-scheme"]');
  assert.equal(el.getAttribute('content'), 'dark');
  assert.equal(el.previousElementSibling?.getAttribute('name'), 'theme-color');
  applyColorScheme(document, { color: { scheme: 'dark' } });
  assert.equal(document.querySelectorAll('meta[name="color-scheme"]').length, 1);
  applyColorScheme(document, { color: { scheme: 'Light' } });
  assert.equal(document.querySelector('meta[name="color-scheme"]').getAttribute('content'), 'light');
  applyColorScheme(document, {});
  assert.equal(document.querySelector('meta[name="color-scheme"]'), null);
});

test('M4: the editor puts theme.json\'s color themes on the preview in place (the #color-themes style)', async () => {
  const { parseHTML } = await import('linkedom');
  const { colorThemeCss } = await import('../src/render/colors.js');
  const theme = { colorThemes: { dark: { link: '#c9a27a' } } };
  // the style the head rendered: the same text, nothing written
  const { document } = parseHTML(
    `<!doctype html><html><head><style id="color-themes">\n      ${colorThemeCss({})}\n    </style></head><body></body></html>`,
  );
  const el = document.getElementById('color-themes');
  const before = el.textContent;
  applyColorThemes(document, {});
  assert.equal(el.textContent, before);
  // an edit (theme.json changes in place in the editor: not the cached CSS)
  applyColorThemes(document, theme);
  assert.match(el.textContent, /\.ct-dark \{[^}]*--color-link: #c9a27a/);
  theme.colorThemes.dark.link = '#333333';
  applyColorThemes(document, theme);
  assert.match(el.textContent, /\.ct-dark \{[^}]*--color-link: #333333/);
  assert.equal(document.querySelectorAll('#color-themes').length, 1);
  // no style yet: one is made
  const bare = parseHTML('<!doctype html><html><head></head><body></body></html>').document;
  applyColorThemes(bare, theme);
  assert.match(bare.getElementById('color-themes').textContent, /--palette-1/);
  // main.js applies the whole theme on a theme.json change
  assert.match(read('src/editor/theme-vars.js'), /export function applyTheme\(doc, theme, fonts\) \{\s*applyColorThemes\(doc, theme\);/);
});
