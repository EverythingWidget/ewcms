// Opacity on a color theme's fill roles (theme.json colorThemes.<name>.opacity and a template
// entry's opacity: { role: 0-100 }): the CSS writes the colour see-through, the check validates
// it, and contrast blends a see-through fill over what is behind it first (src/render/colors.js;
// the editor: lib/color-themes.js, ColorPart.svelte).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  OPACITY_ROLES,
  TEMPLATE_OPACITY_ROLES,
  blendOver,
  checkColors,
  colorThemeCss,
  contrastResults,
  contrastWarnings,
  opacityOf,
  roleCss,
} from '../src/render/colors.js';
import {
  contrastIndex,
  contrastRow,
  contrastText,
  customCount,
  hasOpacity,
  opacityEdit,
  opacityRow,
  roleResetEdit,
} from '../src/editor/lib/color-themes.js';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const PALETTE = ['#000000', '#101010', '#808080', '#cfc8b8', '#ffffff'];

test('only the fills take an opacity; a whole percent, 100 (or left out) solid', () => {
  assert.deepEqual(OPACITY_ROLES, ['background', 'button', 'line', 'header', 'curtain']);
  assert.deepEqual(TEMPLATE_OPACITY_ROLES, ['background', 'button', 'line']);
  assert.deepEqual(
    opacityOf({ opacity: { line: 20, background: 100, text: 50, header: 1.5, button: -1 } }),
    {
      line: 20,
    },
  );
  assert.deepEqual(opacityOf({}), {});
  assert.equal(roleCss(3, undefined), 'var(--palette-3)');
  assert.equal(roleCss(3, 100), 'var(--palette-3)');
  assert.equal(roleCss(3, 20), 'color-mix(in srgb, var(--palette-3) 20%, transparent)');
  assert.equal(roleCss('#c9a27a', 80), 'color-mix(in srgb, #c9a27a 80%, transparent)');
  // no colour, nothing to make see-through
  assert.equal(roleCss('transparent', 50), 'transparent');
  assert.equal(roleCss('glass', 50), 'transparent');
});

test('the CSS: a theme role and a template sub-role see-through; a template inherits the other half', () => {
  const css = colorThemeCss({
    colorThemes: {
      darkest: {
        line: 5,
        opacity: { line: 20 },
        templates: {
          'preset:card': { background: 3, opacity: { background: 80 } },
          't-aa11': { opacity: { line: 50 } },
        },
      },
      dark: { opacity: { background: 90, text: 10 } },
    },
  });
  assert.match(
    css,
    /:root, \.ct-darkest \{[^}]*--color-line: color-mix\(in srgb, var\(--palette-5\) 20%, transparent\)/,
  );
  assert.match(
    css,
    /\.ct-dark \{[^}]*--color-background: color-mix\(in srgb, var\(--palette-2\) 90%, transparent\)/,
  );
  // not on text (ignored, the check names it)
  assert.match(css, /\.ct-dark \{[^}]*--color-text: var\(--palette-5\);/);
  const card = css.split('\n').find((l) => l.startsWith(':root .tpl-preset-card'));
  assert.match(
    card,
    /--color-background: color-mix\(in srgb, var\(--palette-3\) 80%, transparent\)/,
  );
  assert.match(card, /--item-bg: var\(--color-background\)/);
  // only an opacity: the section's colour at its own opacity
  const own = css.split('\n').find((l) => l.startsWith(':root .tpl-t-aa11'));
  assert.match(own, /--color-line: color-mix\(in srgb, var\(--palette-5\) 50%, transparent\)/);
  assert.match(own, /--color-background: inherit/);
  // no opacity anywhere: the CSS is as it was (no color-mix in srgb)
  assert.doesNotMatch(
    colorThemeCss({ colorThemes: { dark: { line: 4 } } }),
    /in srgb, var\(--palette/,
  );
});

test('ewcms check: opacity is an object of fills, each a whole percent 0-100', () => {
  assert.deepEqual(
    checkColors({ colorThemes: { dark: { opacity: { line: 20, background: 0, curtain: 100 } } } }),
    [],
  );
  assert.deepEqual(
    checkColors({
      colorThemes: {
        dark: {
          opacity: { text: 50, line: 120, glow: 3, header: 12.5 },
          templates: {
            'preset:card': { opacity: { header: 5, background: 50 } },
            't-aa11': { opacity: 3 },
          },
        },
        light: { opacity: [] },
      },
    }),
    [
      '"colorThemes.dark.opacity.text": only a fill can have an opacity (background, button, line, header, curtain), not Text',
      '"colorThemes.dark.opacity.line" must be a whole percent 0-100, not 120',
      '"colorThemes.dark.opacity.glow" is not a role with an opacity (background, button, line, header, curtain)',
      '"colorThemes.dark.opacity.header" must be a whole percent 0-100, not 12.5',
      '"colorThemes.dark.templates.preset:card.opacity.header": only a fill can have an opacity (background, button, line), not Header',
      '"colorThemes.dark.templates.t-aa11.opacity" must be an object { "<role>": 0-100 } (a whole percent; the fills background, button, line)',
      '"colorThemes.light.opacity" must be an object { "<role>": 0-100 } (a whole percent; the fills background, button, line, header, curtain)',
    ],
  );
});

test('blendOver: opacity × colour + (1 − opacity) × behind, in sRGB; unknown behind: null', () => {
  assert.equal(blendOver('#ffffff', 30, '#000000'), '#4d4d4d');
  assert.equal(blendOver('#f2efe9', 20, '#050505'), '#343433');
  assert.equal(blendOver('#abc', undefined, null), '#aabbcc');
  assert.equal(blendOver('#ffffff', 100, null), '#ffffff');
  assert.equal(blendOver('#ffffff', 50, null), null);
  assert.equal(blendOver(null, 50, '#000000'), null);
});

test('contrast: a see-through fill is blended over what is behind it before the ratio', () => {
  const theme = {
    palette: PALETTE,
    colorThemes: { dark: { background: 5, text: 1, opacity: { background: 30 } } },
  };
  // solid white under black text: 21:1; at 30% over the site's black (#000): #4d4d4d, a fail
  const textWarn = (t) => contrastWarnings(t).filter((m) => /^colorThemes\.dark: Text /.test(m));
  assert.deepEqual(textWarn({ ...theme, colorThemes: { dark: { background: 5, text: 1 } } }), []);
  const w = contrastWarnings(theme);
  assert.ok(
    w.some((m) =>
      /^colorThemes\.dark: Text on Background has contrast 2\.\d:1 \(needs 4\.5:1\)/.test(m),
    ),
    w.join('\n'),
  );
  const text = contrastResults(theme, 'dark').find((c) => c.key === 'text');
  assert.equal(text.bg, '#4d4d4d');
  assert.equal(text.seeThrough, true);
  // Line at 20% over Darkest (the mock's): blended, then 3:1
  const line = contrastResults(
    { colorThemes: { darkest: { line: 5, opacity: { line: 20 } } } },
    'darkest',
  ).find((c) => c.key === 'line');
  assert.equal(line.fg, '#343433');
  assert.equal(line.bg, '#050505');
  assert.equal(line.pass, false);
  // Line never warns in the check (rules are decorative there); the editor shows it
  assert.ok(
    !contrastWarnings({ palette: PALETTE, colorThemes: { darkest: { line: 1 } } }).some((m) =>
      /Line/.test(m),
    ),
  );
});

test("contrast: a template's see-through Background over its section's; a see-through site Background isn't checked", () => {
  const card = {
    palette: PALETTE,
    colorThemes: {
      darkest: {
        templates: { 'preset:card': { background: 5, opacity: { background: 80 }, text: 1 } },
      },
    },
  };
  const text = contrastResults(card, 'darkest', { template: 'preset:card' }).find(
    (c) => c.key === 'text',
  );
  assert.equal(text.bg, '#cccccc'); // 80% white over the section's black
  assert.equal(text.pass, true);
  // its items show no Background (item style Transparent): the section's
  const through = contrastResults(card, 'darkest', {
    template: 'preset:card',
    seeThrough: ['preset:card'],
  }).find((c) => c.key === 'text');
  assert.equal(through.bg, '#000000');
  // the site's own Background see-through: what is behind the page (the canvas, a backdrop
  // photo) isn't known, so its text (and a section see-through over it) is not checked
  const site = {
    palette: PALETTE,
    colorThemes: {
      darkest: { text: 2, opacity: { background: 50 } },
      dark: { background: 5, opacity: { background: 50 } },
    },
  };
  assert.deepEqual(
    contrastWarnings(site).filter((m) =>
      /^colorThemes\.darkest: |^colorThemes\.dark: Text /.test(m),
    ),
    [],
  );
  assert.equal(contrastResults(site, 'darkest').find((c) => c.key === 'text').ratio, null);
  assert.equal(contrastResults(site, 'dark').find((c) => c.key === 'text').ratio, null);
  // a template that only sets its Background's opacity is checked against it
  const only = {
    palette: PALETTE,
    colorThemes: {
      dark: { background: 5, text: 3, templates: { 't-aa11': { opacity: { background: 10 } } } },
    },
  };
  assert.ok(
    contrastWarnings(only).some((m) =>
      /^colorThemes\.dark\.templates\.t-aa11: Text on Background/.test(m),
    ),
  );
});

test('the editor: a fill row has an opacity (empty: 100, a template the section’s); text rows none', () => {
  const theme = {
    colorThemes: {
      darkest: {
        line: 5,
        opacity: { line: 20 },
        templates: { 'preset:card': { opacity: { background: 80 } } },
      },
    },
  };
  assert.equal(hasOpacity({ theme: 'darkest', key: 'text' }), false);
  assert.equal(hasOpacity({ theme: 'darkest', textStyle: 'title' }), false);
  assert.equal(hasOpacity({ theme: 'darkest', key: 'header', template: 'preset:card' }), false);
  assert.deepEqual(opacityRow(theme, { theme: 'darkest', key: 'line' }), {
    own: 20,
    inherited: 100,
    shown: 20,
    off: false,
  });
  assert.deepEqual(opacityRow(theme, { theme: 'darkest', key: 'line', template: 'preset:card' }), {
    own: undefined,
    inherited: 20,
    shown: 20,
    off: false,
  });
  assert.equal(opacityRow(theme, { theme: 'darkest', key: 'button' }).off, true); // glass
  assert.equal(opacityRow(theme, { theme: 'darkest', key: 'text' }), null);
  // edits: a theme's 100 is left out, a template's kept; out of range: null
  assert.deepEqual(opacityEdit(theme, { theme: 'darkest', key: 'line' }, 100), {
    ptr: '/colorThemes/darkest/opacity/line',
    value: undefined,
  });
  assert.deepEqual(
    opacityEdit(theme, { theme: 'darkest', key: 'line', template: 'preset:card' }, 100),
    {
      ptr: '/colorThemes/darkest/templates/preset:card/opacity/line',
      value: 100,
    },
  );
  assert.equal(opacityEdit(theme, { theme: 'darkest', key: 'line' }, 101), null);
  assert.equal(opacityEdit(theme, { theme: 'darkest', key: 'text' }, 50), null);
  // the reset: colour and opacity in one edit, empty objects left out
  assert.deepEqual(roleResetEdit(theme, { theme: 'darkest', key: 'line' }), {
    ptr: '/colorThemes/darkest',
    value: { templates: { 'preset:card': { opacity: { background: 80 } } } },
  });
  assert.deepEqual(
    roleResetEdit(theme, { theme: 'darkest', key: 'background', template: 'preset:card' }),
    {
      ptr: '/colorThemes/darkest/templates/preset:card',
      value: undefined,
    },
  );
  // the card's count: line, its opacity and the template's opacity
  assert.equal(customCount(theme, 'darkest'), 3);
  // contrast in words
  const c = contrastText(contrastRow(theme, { theme: 'darkest', key: 'line' }));
  // Line is decorative: its ratio as a hint, never a Fail
  assert.deepEqual(c, {
    ratio: '1.6:1',
    verdict: '',
    need: 'on Background (blended) · a hint: 3:1 shows well',
  });
  assert.equal(contrastRow(theme, { theme: 'darkest', textStyle: 'title' }), null);
  assert.equal(contrastRow(theme, { theme: 'darkest', key: 'background' }), null);
});

test('ColorPart: the opacity in a fill row’s label row, its reset slot kept, a contrast line always there', () => {
  const part = read('src/editor/svelte/ColorPart.svelte');
  assert.match(part, /\{@const op = opacityRow\(theme\(\), spec\)\}/);
  assert.match(part, /\{#if op\}\{@render opacity\(spec, row, op\)\}\{\/if\}/);
  assert.match(part, /<span class="crole__end">\{@render reset\(spec, row, resettable\)\}<\/span>/);
  assert.match(part, /live\.changed\(THEME, ptr\) \|\| \(op && live\.changed\(THEME, opPtr\)\)/);
  assert.match(part, /placeholder=\{String\(op\.inherited\)\}/);
  assert.match(part, /tabindex="-1"[\s\S]*?onmousedown=\{\(e\) => e\.preventDefault\(\)\}/);
  assert.match(part, /<p class=\{\['crole__contrast'/);
  assert.match(part, /\.crole__end \{[^}]*width: 16px;/);
  assert.match(part, /\.copa \{[^}]*height: 20px;[^}]*margin-left: auto;/);
  assert.match(part, /\.crole__contrast \{[^}]*line-height: 16px;/);
});

test('docs and changelog describe opacity on roles', () => {
  const docs = read('docs/COLORS.md');
  assert.match(docs, /## Opacity on a fill/);
  assert.match(docs, /"opacity": \{ "line": 20 \}/);
  assert.match(read('CHANGELOG.md'), /Opacity on a color theme's fill roles/);
});

test("the site theme's see-through Header and Curtain are read over its own Background", () => {
  // the repro: Darkest (the site's) + Header 50% was "Not checked", Dark + Header 50% 17.7:1
  for (const name of ['darkest', 'dark']) {
    const all = contrastResults(
      { colorThemes: { [name]: { opacity: { header: 50, curtain: 50 } } } },
      name,
    );
    for (const key of ['headerText', 'curtainText']) {
      const c = all.find((r) => r.key === key);
      assert.ok(c.ratio > 4.5, `${name} ${key}: ${c.ratio}`);
      assert.equal(c.seeThrough, true);
    }
  }
  // Darkest: Header slot 2 (#101010) at 50% over its Background slot 1 (#050505)
  const h = contrastResults(
    { colorThemes: { darkest: { opacity: { header: 50 } } } },
    'darkest',
  ).find((r) => r.key === 'headerText');
  assert.equal(h.bg, '#0b0b0b');
  // its own Background see-through: what is behind the page isn't known, so still not checked
  const unknown = contrastResults(
    { colorThemes: { darkest: { opacity: { background: 50, header: 50 } } } },
    'darkest',
  ).find((r) => r.key === 'headerText');
  assert.equal(unknown.ratio, null);
  assert.deepEqual(contrastText(unknown), {
    ratio: '',
    verdict: 'Not checked',
    need: "what's behind the page isn't known",
  });
});

test('contrast is a hint: text roles Pass / Fail, Line its ratio only; worked out once per theme', () => {
  const theme = { palette: PALETTE, colorThemes: { dark: { background: 5, text: 3, line: 5 } } };
  const index = contrastIndex(theme, 'dark');
  assert.ok(index instanceof Map);
  assert.equal(contrastText(index.get('text')).verdict, 'Fail');
  const line = contrastText(index.get('line'));
  assert.equal(line.verdict, '');
  assert.match(line.ratio, /^1\.0:1$/);
  assert.equal(index.get('line').hint, true);
  assert.deepEqual(contrastRow(theme, { theme: 'dark', key: 'text' }), index.get('text'));
  // the panel: one index per theme (and per template a fold shows), each row a lookup
  const part = read('src/editor/svelte/ColorPart.svelte');
  assert.match(part, /const contrasts = \$derived\.by\(\(\) => \{/);
  assert.match(part, /out\[name\] = contrastIndex\(t, name, null, seeThrough\);/);
  assert.match(part, /if \(isOpen\(name, 'templates'\)\) \{/);
  assert.doesNotMatch(part, /contrastRow\(/);
  assert.match(part, /\{#if contrast\.verdict\}<b>\{contrast\.verdict\}<\/b>\{\/if\}/);
});
