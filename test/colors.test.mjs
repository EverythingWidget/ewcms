// The palette and its color themes (src/render/colors.js): a palette of 5, 12 roles per theme,
// "none" on fills only, smart colours worked out in CSS, the check and its contrast warnings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  COLOR_THEME_DEFAULTS,
  DEFAULT_PALETTE,
  ROLES,
  SMART,
  THEME_NAMES,
  TEXT_STYLE_NAMES,
  TEXT_STYLE_PARENT,
  checkColors,
  colorCssBuilds,
  colorThemeCss,
  contrastOf,
  contrastWarnings,
  paletteOf,
  paletteVarList,
  rolesOf,
  textStyleVar,
} from '../src/render/colors.js';
import { checkContent } from '../src/render/validate.js';
import { themeVarList } from '../src/render/theme.js';
import { head } from '../src/render/shell/layout.js';
import { renderRoute } from '../src/render/render.js';

const root = new URL('..', import.meta.url).pathname;
const PALETTE = ['#050505', '#101010', '#212121', '#cfc8b8', '#f2efe9'];
const rule = (css, selector) => {
  const at = css.split('\n').find((l) => l.startsWith(`${selector} {`));
  return at || '';
};

test('defaults: every theme gives all 11 roles a slot (Button: glass); the engine palette is the default site', () => {
  assert.deepEqual(DEFAULT_PALETTE, PALETTE);
  assert.deepEqual(THEME_NAMES, ['lightest', 'light', 'accent', 'dark', 'darkest']);
  assert.equal(ROLES.length, 11);
  // Heading is a text style, not a role: every text style follows Text
  assert.ok(!ROLES.some((r) => r.key === 'heading'));
  assert.ok(Object.values(TEXT_STYLE_PARENT).every((p) => p === 'text'));
  for (const name of THEME_NAMES) {
    assert.deepEqual(Object.keys(COLOR_THEME_DEFAULTS[name]), ROLES.map((r) => r.key));
    for (const [k, v] of Object.entries(COLOR_THEME_DEFAULTS[name]))
      if (k === 'button') assert.equal(v, 'glass');
      else assert.ok(v >= 1 && v <= 5);
    // the glass pill's text was the theme's Text: its Button text is the same slot
    assert.equal(COLOR_THEME_DEFAULTS[name].buttonText, COLOR_THEME_DEFAULTS[name].text);
  }
  // the Dark and Lightest of the mockup (review-notes/mocks/smart-colors)
  assert.equal(COLOR_THEME_DEFAULTS.dark.background, 2);
  assert.equal(COLOR_THEME_DEFAULTS.lightest.background, 5);
  // a theme set in theme.json overrides only what it sets; a bad value is the default's
  const r = rolesOf({ colorThemes: { dark: { text: 3, link: '#C9A27A', button: 'transparent', accent: 'transparent' } } }, 'dark');
  assert.equal(r.text, 3);
  assert.equal(r.link, '#c9a27a');
  assert.equal(r.button, 'transparent');
  assert.equal(r.accent, COLOR_THEME_DEFAULTS.dark.accent); // "none" is no text colour
});

test('the palette: theme.json\'s 5, else the engine\'s; until then color.brand is slot 4', () => {
  assert.deepEqual(paletteOf({}), PALETTE);
  const own = ['#FFFFFF', '#eeeeee', '#cccccc', '#cc2020', '#111111'];
  assert.deepEqual(paletteOf({ palette: own }), own.map((c) => c.toLowerCase()));
  assert.deepEqual(paletteOf({ palette: ['#fff'] }), PALETTE); // not valid: the engine's
  assert.equal(paletteOf({ color: { brand: '#cc2020' } })[3], '#cc2020');
  assert.equal(paletteOf({ palette: own, color: { brand: '#00ff00' } })[3], '#cc2020'); // a palette wins
  // only what differs is written on :root:root, with the rest of theme.json's variables
  assert.deepEqual(paletteVarList({}), []);
  assert.deepEqual(paletteVarList({ palette: [...PALETTE.slice(0, 4), '#ffffff'] }), [['--palette-5', '#ffffff']]);
  assert.deepEqual(themeVarList({ palette: [...PALETTE.slice(0, 4), '#ffffff'] }), [['--palette-5', '#ffffff']]);
});

test('the CSS: palette defaults, each theme\'s roles as --color-*, the site theme on :root too', () => {
  const css = colorThemeCss({ colorTheme: 'dark' });
  assert.match(css, /^:root \{ --palette-1: #050505; .* --palette-5: #f2efe9; --accent: var\(--color-accent\) \}/);
  assert.match(rule(css, ':root, .ct-dark'), /--color-background: var\(--palette-2\); --color-text: var\(--palette-5\);/);
  assert.match(rule(css, '.ct-darkest'), /--color-background: var\(--palette-1\)/);
  assert.equal(rule(css, ':root, .ct-darkest'), '');
  for (const r of ROLES) assert.match(rule(css, '.ct-light'), new RegExp(`${r.css}: `));
  assert.match(ROLES.find((r) => r.key === 'buttonText').css, /^--color-button-text$/);
  assert.match(ROLES.find((r) => r.key === 'curtainText').css, /^--color-curtain-text$/);
  // a custom colour stays as it is (it doesn't follow the palette); none is transparent
  const own = colorThemeCss({ colorThemes: { light: { link: '#333', button: 'transparent' } } });
  assert.match(rule(own, '.ct-light'), /--color-link: #333;/);
  assert.match(rule(own, '.ct-light'), /--color-button: transparent;/);
});

test('smart colours: worked out from the roles on every theme element; "none" has its own rule', () => {
  const css = colorThemeCss({ colorThemes: { lightest: { button: 'transparent', line: 'transparent' } } });
  const smart = rule(css, ':root, .ct-lightest, .ct-light, .ct-accent, .ct-dark, .ct-darkest, .header, .mmenu');
  for (const s of SMART) assert.match(smart, new RegExp(`${s.var}: `));
  assert.match(smart, /--smart-button-hover: color-mix\(in oklab, var\(--color-button\), var\(--color-button-text\) 12%\)/);
  assert.match(smart, /--smart-link-hover: color-mix\(in oklab, var\(--color-link\) 65%, var\(--color-background\)\)/);
  assert.match(smart, /--smart-faded: color-mix\(in oklab, var\(--color-text\) 60%, var\(--color-background\)\)/);
  // a no-fill button: its text at 10% (hover) and 18% (pressed); a no line's hover: none
  const lightest = rule(css, '.ct-lightest');
  assert.match(lightest, /--smart-button-hover: color-mix\(in oklab, var\(--color-text\) 10%, var\(--color-background\)\)/);
  assert.match(lightest, /--smart-button-pressed: color-mix\(in oklab, var\(--color-text\) 18%, var\(--color-background\)\)/);
  assert.match(lightest, /--smart-line-hover: transparent/);
  // the default button, glass: its hover and pressed are the glass a step and two lighter
  assert.match(rule(css, '.ct-light'), /--smart-button-hover: color-mix\(in oklab, var\(--color-accent\) 12%, color-mix\(in oklab, color-mix\(in oklab, var\(--color-background\), var\(--color-text\) 20%\) 50%, transparent\)\);/);
  assert.match(rule(css, '.ct-light'), /--smart-button-pressed: color-mix\(in oklab, var\(--color-accent\) 16%,/);
  assert.doesNotMatch(rule(css, '.ct-light'), /--smart-line-hover/); // the base rule's
  // a colour button: the base rule's, nothing on the theme
  const solid = colorThemeCss({ colorThemes: { light: { button: 2 } } });
  assert.doesNotMatch(rule(solid, '.ct-light'), /--smart-/);
  // no fixed colour in any smart rule: only roles
  for (const s of SMART) assert.doesNotMatch(`${s.css} ${s.transparent || ''} ${s.glass || ''}`, /#|rgb|hsl/);
});

test('check: palette, color themes, roles, slots; "none" only on fills', () => {
  assert.deepEqual(checkColors({ palette: PALETTE, colorTheme: 'dark', colorThemes: { dark: { button: 'transparent', line: 'transparent', header: 'transparent', background: 'transparent', text: '#333', textStyles: { label: 4 } } } }), []);
  const bad = checkColors({
    palette: ['#fff', '#000'],
    colorTheme: 'blue',
    colorThemes: { dark: { text: 'transparent', curtain: 'transparent', link: 6, glow: 1, textStyles: { label: 'transparent', note: 2 } }, blue: {} },
  });
  // the text-style colours are "textStyles": the old key is not a role
  assert.match(checkColors({ colorThemes: { dark: { typography: { label: 4 } } } }).join(), /"colorThemes\.dark\.typography" is not a role/);
  // Heading was a role: the check says where it went, in a theme and in a template entry
  assert.deepEqual(checkColors({ colorThemes: { dark: { heading: 4, templates: { 'preset:card': { heading: 2 } } } } }), [
    '"colorThemes.dark.heading" is not a role any more: Heading is a text style ("colorThemes.dark.textStyles": { "heading": … }, as Title, Subheading and Statement); left out, a text style follows Text',
    '"colorThemes.dark.templates.preset:card.heading" is not a role any more: Heading is a text style ("colorThemes.dark.templates.preset:card.textStyles": { "heading": … }, as Title, Subheading and Statement); left out, a text style follows Text',
  ]);
  // "none" was renamed "transparent": a leftover one says so (a fill), and is never a colour
  assert.deepEqual(
    checkColors({ colorThemes: { dark: { button: 'none', text: 'none', templates: { 'preset:card': { background: 'none' } } } } }),
    [
      '"colorThemes.dark.button" is "none": use "transparent" (no fill; "none" was renamed)',
      `"colorThemes.dark.text" can't be "none" (now "transparent"): only a fill can be transparent (Background, Button, Line, Header)`,
      '"colorThemes.dark.templates.preset:card.background" is "none": use "transparent" (no fill; "none" was renamed)',
    ],
  );
  assert.equal(rolesOf({ colorThemes: { dark: { button: 'none' } } }, 'dark').button, 'glass');
  assert.deepEqual(bad, [
    '"palette" must be 5 colors "#rrggbb", slot 1 first',
    '"colorTheme" must be a color theme: "lightest", "light", "accent", "dark", "darkest", not "blue"',
    `"colorThemes.dark.text" can't be "transparent": only a fill can (Background, Button, Line, Header)`,
    `"colorThemes.dark.curtain" can't be "transparent": only a fill can (Background, Button, Line, Header)`,
    '"colorThemes.dark.link" must be a palette slot 1-5 or a color "#rrggbb", not 6',
    '"colorThemes.dark.glow" is not a role (background, text, link, accent, button, buttonText, line, header, headerText, curtain, curtainText, textStyles, templates, opacity)',
    `"colorThemes.dark.textStyles.label" can't be "transparent": only a fill can (Background, Button, Line, Header)`,
    '"colorThemes.dark.textStyles.note" is not a text style (title, heading, paragraph, label, subheading, statement, small)',
    '"colorThemes.blue" is not a color theme (lightest, light, accent, dark, darkest)',
  ]);
  // through theme.json's check (validate.js)
  assert.deepEqual(checkContent('theme.json', { version: 1, palette: PALETTE, colorThemes: { dark: { text: 4 } }, colorTheme: 'dark' }), []);
  assert.match(checkContent('theme.json', { version: 1, colorTheme: 'blue' }).join('\n'), /"colorTheme" must be/);
});

test('contrast: text against its nearest real background; "none" sees through; 3:1 for heading text styles', () => {
  assert.equal(Math.round(contrastOf('#000', '#fff')), 21);
  assert.deepEqual(contrastWarnings({}), []); // no palette or themes of its own: nothing to say
  assert.deepEqual(contrastWarnings({ palette: PALETTE }), []); // the engine's themes pass
  const w = contrastWarnings({
    palette: PALETTE,
    colorThemes: {
      // dark: no fill, so Text is read against the site theme's (darkest) background #050505
      dark: { background: 'transparent', text: 2, button: 'transparent', buttonText: 1, textStyles: { title: 3, statement: 1 } },
      light: { curtainText: 5, textStyles: { small: 5 } },
    },
  });
  assert.ok(w.some((m) => /^colorThemes\.dark: Text on Background has contrast 1\.\d:1 \(needs 4\.5:1\)/.test(m)), w.join('\n'));
  assert.ok(w.some((m) => /^colorThemes\.dark: the title text style on Background has contrast 1\.\d:1 \(needs 3:1\)/.test(m)), w.join('\n'));
  // Statement (#050505 on #050505) too, at 3:1: a heading text style
  assert.ok(w.some((m) => /^colorThemes\.dark: the statement text style on Background has contrast 1\.0:1 \(needs 3:1\)/.test(m)));
  // a no-fill button: its text against the background (#050505)
  assert.ok(w.some((m) => /^colorThemes\.dark: Button text on Button has contrast 1\.0:1/.test(m)));
  assert.ok(w.some((m) => /^colorThemes\.light: Curtain text on Curtain/.test(m)));
  assert.ok(w.some((m) => /^colorThemes\.light: the small text style on Background/.test(m)));
});

test('the page head: one static color-themes style, built once per theme.json', () => {
  const theme = { palette: PALETTE, colorTheme: 'dark' };
  const content = { site: { name: 'X', url: 'https://x.com', lang: 'en' }, theme, pages: { home: { sections: [] } } };
  const route = { id: 'home', path: '/', page: 'page', title: 'X' };
  const before = colorCssBuilds();
  const a = renderRoute(route, content);
  renderRoute(route, content);
  renderRoute(route, content);
  assert.equal(colorCssBuilds() - before, 1);
  assert.match(a.head, /<style id="color-themes">\s*:root \{ --palette-1/);
  assert.match(a.head, /:root, \.ct-dark \{/);
  assert.equal(a.head.match(/id="color-themes"/g).length, 1);
  // a site with no theme.json still gets the engine's
  assert.match(head({ site: { name: 'X', url: '' } }, route), /:root, \.ct-darkest \{ --color-background: var\(--palette-1\)/);
});

test('one name per concept: every --color-* and --smart-* in the engine comes from the one table', () => {
  const known = new Set([...ROLES.map((r) => r.css), ...TEXT_STYLE_NAMES.map(textStyleVar), ...SMART.map((s) => s.var)]);
  const files = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(js|mjs|scss|svelte)$/.test(f.name)) files.push(p);
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'default-site'));
  const unknown = [];
  for (const f of files)
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/--(?:color|smart)-[a-z][a-z-]*[a-z]/g))
      if (!known.has(m[0]) && !f.endsWith('colors.js')) unknown.push(`${path.relative(root, f)}: ${m[0]}`);
  assert.deepEqual(unknown, []);
  // and the CSS writes nothing else
  const css = colorThemeCss({ colorThemes: { dark: { textStyles: { label: 4 } } } });
  for (const m of css.matchAll(/--(?:color|smart)-[a-z-]+(?=:)/g)) assert.ok(known.has(m[0]), m[0]);
});
