// The Button role's modes: a colour (palette slot, hex), "glass" (the default: the glass pill) or
// "none" (text only). Button text in all of them; hover and pressed the smart colours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BUTTON_BLUR,
  BUTTON_MODES,
  COLOR_THEME_DEFAULTS,
  THEME_NAMES,
  buttonModeOf,
  checkColors,
  colorThemeCss,
  contrastWarnings,
  rolesOf,
} from '../src/render/colors.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const rule = (css, selector) => css.split('\n').find((l) => l.startsWith(`${selector} {`)) || '';
const PALETTE = ['#000000', '#111111', '#777777', '#cccccc', '#ffffff'];

test('modes: a slot or hex is a colour; glass is the default everywhere; only Button takes glass', () => {
  assert.deepEqual(BUTTON_MODES, ['color', 'glass', 'none']);
  assert.equal(buttonModeOf(3), 'color');
  assert.equal(buttonModeOf('#c9a27a'), 'color');
  assert.equal(buttonModeOf('glass'), 'glass');
  assert.equal(buttonModeOf('none'), 'none');
  for (const n of THEME_NAMES) assert.equal(rolesOf({}, n).button, 'glass');
  assert.equal(rolesOf({ colorThemes: { dark: { button: 'glass' } } }, 'dark').button, 'glass');
  assert.equal(rolesOf({ colorThemes: { dark: { background: 'glass' } } }, 'dark').background, COLOR_THEME_DEFAULTS.dark.background);
  assert.deepEqual(checkColors({ colorThemes: { dark: { button: 'glass', templates: { 'preset:card': { button: 'none' } } }, light: { button: '#123456' } } }), []);
  assert.deepEqual(checkColors({ colorThemes: { dark: { line: 'glass', button: 'blue' } } }), [
    `"colorThemes.dark.line" can't be "glass": only Button can`,
    `"colorThemes.dark.button" must be a palette slot 1-5 or a color "#rrggbb", "glass", "none", not "blue"`,
  ]);
});

test('all glass (the engine default): no button rules, the .btn is the stylesheet\'s glass pill', () => {
  const css = colorThemeCss({});
  assert.doesNotMatch(css, /\.btn/);
  assert.match(rule(css, ':root, .ct-darkest'), /--color-button: transparent;/);
  // the chrome works out its smart colours with the site theme's modes
  assert.match(css, /\.header:not\(\[class\*=' ct-'\]\), \.mmenu:not\(\[class\*=' ct-'\]\) \{ --smart-button-hover: color-mix\(in oklab, var\(--color-accent\) 12%/);
  // the .btn: Button text, hover and pressed the smart colours, at rest the glass fill
  const glass = read('src/client/styles/_glass.scss').replace(/\/\/.*$/gm, '');
  assert.match(glass, /\.btn \{[\s\S]*?color: var\(--color-button-text\);/);
  assert.match(glass, /\.btn \{[\s\S]*?background: var\(--glass-fill\);/);
  assert.match(glass, /&:hover \{\s*&::before \{\s*background: var\(--smart-button-hover\);/);
  assert.match(glass, /&:active \{[\s\S]*?&::before \{\s*background: var\(--smart-button-pressed\);/);
  assert.match(read('src/widgets/form/style.scss'), /color: var\(--color-button-text\);/);
  // the blur the rules write for glass is the stylesheet's
  assert.ok(glass.includes(`backdrop-filter: ${BUTTON_BLUR};`));
  // the glass hover is the .glass hover fill (same formula), so the default looks as before
  assert.match(glass, /--glass-fill-hover: color-mix\(in oklab, var\(--color-accent\) 12%, var\(--glass-base-hover\)\);/);
  assert.match(glass, /var\(--color-background\), var\(--color-text\) 20%\) 50%,/);
});

test('a colour or none somewhere: every theme writes its button, the site theme first', () => {
  const css = colorThemeCss({ colorTheme: 'dark', colorThemes: { light: { button: 2 }, accent: { button: 'none' }, lightest: { button: '#c9a27a' } } });
  const lines = css.split('\n').filter((l) => l.includes('.btn'));
  assert.equal(lines.length, 15); // 5 themes × rest, hover, pressed
  assert.match(lines[0], /^:root \.btn::before, \.ct-dark \.btn::before \{ background: var\(--glass-fill\); -webkit-backdrop-filter: var\(--btn-backdrop, blur\(22px\) saturate\(180%\)\);/);
  assert.match(css, /\.ct-light \.btn::before \{ background: var\(--color-button\); -webkit-backdrop-filter: none; backdrop-filter: none \}/);
  assert.match(css, /\.ct-accent \.btn::before \{ background: var\(--color-button\);/); // transparent
  assert.match(css, /\.ct-light \.btn:hover::before \{ background: var\(--smart-button-hover\) \}/);
  assert.match(css, /\.ct-light \.btn:active::before \{ background: var\(--smart-button-pressed\) \}/);
  assert.match(rule(css, '.ct-lightest'), /--color-button: #c9a27a;/);
  // hover stays visible: a colour's is Button toward Button text; none's Text over Background
  assert.doesNotMatch(rule(css, '.ct-light'), /--smart-button-hover/);
  assert.match(rule(css, '.ct-accent'), /--smart-button-hover: color-mix\(in oklab, var\(--color-text\) 10%, var\(--color-background\)\)/);
  // a template's button: its own rules inside its items
  const tpl = colorThemeCss({ colorThemes: { dark: { templates: { 'preset:card': { button: 3 } } } } });
  assert.match(tpl, /\.ct-dark \.tpl-preset-card \.btn::before \{ background: var\(--color-button\); -webkit-backdrop-filter: none;/);
});

test('contrast: Button text on the button colour; glass and none against the section Background', () => {
  const warn = (t) => contrastWarnings({ palette: PALETTE, colorThemes: { dark: t } }).filter((w) => /dark: Button text/.test(w));
  assert.deepEqual(warn({ button: 5, buttonText: 1 }), []);
  assert.equal(warn({ button: 5, buttonText: 5 }).length, 1);
  // dark: Background slot 2 (#111111)
  assert.deepEqual(warn({ button: 'glass' }), []);
  assert.deepEqual(warn({ button: 'none', buttonText: 4 }), []);
  assert.match(warn({ button: 'glass', buttonText: 1 })[0], /Button text on Button has contrast 1\.1:1/);
  assert.equal(warn({ button: 'none', buttonText: 2 }).length, 1);
});

test('a template that sets Text: its glass button\'s text follows it, unless Button text is set', () => {
  const css = colorThemeCss({ colorThemes: { dark: { templates: { 'preset:card': { background: 5, text: 1 } } } } });
  assert.match(rule(css, '.ct-dark .tpl-preset-card'), /--color-button-text: var\(--color-text\);/);
  const own = colorThemeCss({ colorThemes: { dark: { buttonText: 4, templates: { 'preset:card': { text: 1 } } } } });
  assert.match(rule(own, '.ct-dark .tpl-preset-card'), /--color-button-text: inherit;/);
  const solid = colorThemeCss({ colorThemes: { dark: { button: 4, templates: { 'preset:card': { text: 1 } } } } });
  assert.match(rule(solid, '.ct-dark .tpl-preset-card'), /--color-button-text: inherit;/);
});
