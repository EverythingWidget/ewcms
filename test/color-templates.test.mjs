// Palette step 4: sub-roles. Text styles (colorThemes.<name>.typography) and each template's
// roles (colorThemes.<name>.templates."<id>"); a template made from another gets a copy, once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  colorThemeCss,
  contrastWarnings,
  copyTemplateRoles,
  isOldColorToken,
  templateClass,
  templateRolesOf,
} from '../src/render/colors.js';
import { styleMarkup } from '../src/widgets/list/item-style.js';

const rule = (css, selector) => css.split('\n').find((l) => l.startsWith(`${selector} {`)) || '';

test('no sub-roles: no template rules, no --color-type-* set', () => {
  const css = colorThemeCss({});
  assert.doesNotMatch(css, /\.tpl-/);
  assert.doesNotMatch(css, /--color-type-/);
});

test('a text style set in one theme: the others reset it, so it follows Heading / Text', () => {
  const css = colorThemeCss({ colorThemes: { light: { typography: { label: 3 } } } });
  assert.match(rule(css, '.ct-light'), /--color-type-label: var\(--palette-3\)/);
  assert.match(rule(css, '.ct-dark'), /--color-type-label: initial/);
  // only the set style is written
  assert.doesNotMatch(css, /--color-type-paragraph/);
  // the styles read it, else their parent (Label and Small: Text, not the faded colour)
  const scss = fs.readFileSync(new URL('../src/client/styles/_text.scss', import.meta.url), 'utf8');
  assert.match(scss, /color: var\(--color-type-label, var\(--color-text\)\);/);
  assert.match(scss, /color: var\(--color-type-small, var\(--color-text\)\);/);
  assert.match(scss, /color: var\(--color-type-title, var\(--color-heading\)\);/);
  assert.doesNotMatch(scss, /--type-[a-z]+-color/);
});

test("a template's sub-roles apply only inside its items, in that theme", () => {
  const theme = {
    colorThemes: { dark: { templates: { 'preset:card': { background: 3, text: '#333' } } } },
  };
  const css = colorThemeCss(theme);
  const dark = rule(css, '.ct-dark .tpl-preset-card');
  assert.match(dark, /--color-background: var\(--palette-3\)/);
  assert.match(dark, /--color-text: #333/);
  assert.match(dark, /--color-heading: inherit/);
  // its item paints the Background it sets (a fill its style sets, inline, still wins)
  assert.match(dark, /--item-bg: var\(--color-background\);/);
  assert.doesNotMatch(dark, /--item-bg-hover/); // hover: .li's, its own fill
  // another theme: inherit all, its own fill (not the site theme's rule, which matches everywhere)
  const light = rule(css, '.ct-light .tpl-preset-card');
  assert.match(light, /--color-background: inherit/);
  assert.match(light, /--item-bg: transparent;/);
  assert.doesNotMatch(css, /--item-bg: inherit/);
  // a style's fill wins (inline): None is see-through, Surface a surface of that Background;
  // left empty, nothing inline, so the template's Background shows
  assert.equal(styleMarkup({ background: 'none' }).vars, '--item-bg:transparent');
  assert.match(styleMarkup({ background: 'surface' }).vars, /--item-bg:color-mix\(in oklab, var\(--color-background\)/);
  assert.equal(styleMarkup({}).vars, '');
  // one name: no --item-fill anywhere
  for (const f of ['../src/widgets/list/style.scss', '../src/widgets/list/item-style.js', '../src/render/colors.js'])
    assert.doesNotMatch(fs.readFileSync(new URL(f, import.meta.url), 'utf8'), /--item-fill/, f);
  // a template that sets no Background anywhere: no fill rules
  assert.doesNotMatch(
    colorThemeCss({ colorThemes: { dark: { templates: { 'preset:row': { text: 2 } } } } }),
    /--item-/,
  );
  // the site theme's (darkest) first, as :root: a section's theme comes after it and wins
  const lines = css.split('\n');
  const siteAt = lines.findIndex((l) =>
    l.startsWith(':root .tpl-preset-card, .ct-darkest .tpl-preset-card {'),
  );
  assert.ok(
    siteAt > 0 && siteAt < lines.findIndex((l) => l.startsWith('.ct-dark .tpl-preset-card {')),
  );
  // the smart colours are worked out on the item too
  assert.match(css, /, \.tpl-preset-card \{ --smart-/);
  assert.equal(templateClass('preset:card'), 'tpl-preset-card');
  assert.equal(templateClass('t-ab12'), 'tpl-t-ab12');
});

test("a template is its own: basedOn isn't followed; its parent's are copied once, when it is added", () => {
  const theme = {
    colorThemes: {
      dark: { templates: { 'preset:card': { background: 3, typography: { title: 5 } } } },
      light: { link: 2 },
    },
  };
  // a template with no entry of its own: the section's roles (no rules), whatever its basedOn
  assert.deepEqual(templateRolesOf(theme, 'dark', 't-aa11'), { roles: {}, typography: {} });
  assert.doesNotMatch(colorThemeCss(theme), /tpl-t-aa11/);
  // copied: its own entry, in each theme that had the parent's
  const copy = copyTemplateRoles(theme, 'preset:card', 't-aa11');
  assert.deepEqual(copy.colorThemes.dark.templates['t-aa11'], { background: 3, typography: { title: 5 } });
  assert.equal(copy.colorThemes.light.templates, undefined);
  assert.deepEqual(theme.colorThemes.dark.templates['t-aa11'], undefined, 'theme.json given is not changed');
  assert.match(rule(colorThemeCss(copy), '.ct-dark .tpl-t-aa11'), /--color-background: var\(--palette-3\)/);
  // then each is its own: the parent's later edit doesn't reach it
  copy.colorThemes.dark.templates['preset:card'].background = 4;
  assert.equal(copy.colorThemes.dark.templates['t-aa11'].background, 3);
  // nothing to copy, or an entry of its own already: null
  assert.equal(copyTemplateRoles(theme, 'preset:row', 't-bb22'), null);
  assert.equal(copyTemplateRoles({}, 'preset:card', 't-bb22'), null);
  assert.equal(copyTemplateRoles(copy, 'preset:card', 't-aa11'), null);
});

test("contrast: a template's text against its own Background", () => {
  const palette = ['#000000', '#111111', '#777777', '#cccccc', '#ffffff'];
  const ok = contrastWarnings({
    palette,
    colorThemes: {
      dark: { templates: { 'preset:card': { background: 5, text: 1, heading: 1, link: 1 } } },
    },
  });
  assert.ok(!ok.some((w) => /preset:card/.test(w)), ok.join('\n'));
  // white text on a light card background (the dark theme's text is slot 5)
  const bad = contrastWarnings({
    palette,
    colorThemes: { dark: { templates: { 'preset:card': { background: 4 } } } },
  });
  assert.ok(
    bad.some((w) => /templates\.preset:card: Text on Background/.test(w)),
    bad.join('\n'),
  );
});

test('one source: the text styles are layout/type.js\'s, a template id a preset or "t-…" (files.js)', async () => {
  const { checkColors, TYPE_PARENT } = await import('../src/render/colors.js');
  const { TEXT_STYLES } = await import('../src/render/layout/type.js');
  const { PRESET_FROM } = await import('../src/render/files.js');
  assert.deepEqual(Object.keys(TYPE_PARENT), Object.keys(TEXT_STYLES));
  const tpl = (id) => checkColors({ colorThemes: { dark: { templates: { [id]: { text: 2 } } } } });
  for (const id of [...PRESET_FROM, 't-ab12']) assert.deepEqual(tpl(id), [], id);
  for (const id of ['preset:nope', 't-X', 'card'])
    assert.ok(tpl(id).some((p) => /is not a template id/.test(p)), id);
});

test('contrast: a template whose fill is None is read against the section, not its Background', async () => {
  const { seeThroughTemplates } = await import('../src/widgets/list/item-style.js');
  const palette = ['#000000', '#111111', '#777777', '#cccccc', '#ffffff'];
  // dark text on a light template Background: fine where it shows, not over the dark section
  const theme = { palette, colorThemes: { dark: { templates: { 'preset:plain': { background: 5, text: 1 }, 't-ab12': { background: 5, text: 1, heading: 1, link: 1 } } } } };
  const seeThrough = seeThroughTemplates({ 't-ab12': { style: { background: 'none' } }, 't-cd34': { style: {} } });
  assert.deepEqual(seeThrough, ['preset:plain', 'preset:photo', 't-ab12']);
  const shown = contrastWarnings(theme);
  assert.ok(!shown.some((w) => /templates\.t-ab12: Text/.test(w)), shown.join('\n'));
  const real = contrastWarnings(theme, { seeThrough });
  assert.ok(real.some((w) => /templates\.t-ab12: Text on Background/.test(w)), real.join('\n'));
  assert.ok(real.some((w) => /templates\.preset:plain: Text on Background/.test(w)), real.join('\n'));
  // its Heading it leaves to the section: nothing new to say about it
  assert.ok(!real.some((w) => /templates\.preset:plain: Heading/.test(w)), real.join('\n'));
});

test("an item in another's takes its own template's Background, never the outer item's", () => {
  // each item sets its fill (.li): nothing inherits from an outer item
  const scss = fs.readFileSync(new URL('../src/widgets/list/style.scss', import.meta.url), 'utf8');
  const li = scss.slice(scss.indexOf('\n.li {'), scss.indexOf('&:hover', scss.indexOf('\n.li {')));
  assert.match(li, /--item-bg: transparent;\s*--item-bg-hover: var\(--item-bg\);/);
  // the outer template paints in Dark; the inner one sets none there: transparent (its own), and
  // its own Background where it sets one; never inherit
  const css = colorThemeCss({
    colorThemes: {
      dark: { templates: { 't-out1': { background: 4 } } },
      light: { templates: { 't-in22': { background: 2 } } },
    },
  });
  assert.match(rule(css, '.ct-dark .tpl-t-out1'), /--item-bg: var\(--color-background\)/);
  assert.match(rule(css, '.ct-dark .tpl-t-in22'), /--item-bg: transparent/);
  assert.match(rule(css, '.ct-light .tpl-t-in22'), /--item-bg: var\(--color-background\)/);
  assert.doesNotMatch(css, /--item-bg: inherit/);
  // a site still setting the old item fill tokens: check names them (they colour nothing now)
  assert.ok(isOldColorToken('--item-bg') && isOldColorToken('--item-bg-hover'));
});
