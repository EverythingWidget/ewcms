// Palette step 4: sub-roles. Text styles (colorThemes.<name>.typography) and each template's
// roles (colorThemes.<name>.templates."<id>"), a site template copying its parent's (basedOn).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  colorThemeCss,
  contrastWarnings,
  templateClass,
  templateRolesOf,
} from '../src/render/colors.js';
import { styleMarkup } from '../src/widgets/list/item-style.js';

const rule = (css, selector) => css.split('\n').find((l) => l.startsWith(`${selector} {`)) || '';

test('no sub-roles: no template rules, no --color-type-* set', () => {
  const css = colorThemeCss({}, {});
  assert.doesNotMatch(css, /\.tpl-/);
  assert.doesNotMatch(css, /--color-type-/);
});

test('a text style set in one theme: the others reset it, so it follows Heading / Text', () => {
  const css = colorThemeCss({ colorThemes: { light: { typography: { label: 3 } } } }, {});
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
  const css = colorThemeCss(theme, {});
  const dark = rule(css, '.ct-dark .tpl-preset-card');
  assert.match(dark, /--color-background: var\(--palette-3\)/);
  assert.match(dark, /--color-text: #333/);
  assert.match(dark, /--color-heading: inherit/);
  // its item paints the Background it sets (a template style's inline fill still wins)
  assert.match(
    dark,
    /--item-fill: var\(--color-background\); --item-bg: var\(--item-fill\); --item-bg-hover: var\(--item-fill\)/,
  );
  // another theme: inherit all, its own fill (not the site theme's rule, which matches everywhere)
  const light = rule(css, '.ct-light .tpl-preset-card');
  assert.match(light, /--color-background: inherit/);
  assert.match(light, /--item-bg: inherit; --item-bg-hover: inherit/);
  assert.doesNotMatch(light, /--item-fill/);
  // a style's None is that Background; its Surface (inline) a surface of it; reset per item
  assert.equal(styleMarkup({ background: 'none' }).vars, '--item-bg:var(--item-fill, transparent)');
  const scss = fs.readFileSync(new URL('../src/widgets/list/style.scss', import.meta.url), 'utf8');
  assert.match(scss, /\.li \{[^}]*--item-fill: initial;/);
  // a template that sets no Background anywhere: no fill rules
  assert.doesNotMatch(
    colorThemeCss({ colorThemes: { dark: { templates: { 'preset:row': { text: 2 } } } } }, {}),
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

test("a site template copies its parent's sub-roles (basedOn), and its own win", () => {
  const theme = {
    colorThemes: {
      dark: {
        templates: {
          'preset:card': { background: 3, typography: { title: 5 } },
          't-bb22': { text: 2 },
        },
      },
    },
  };
  const templates = { 't-aa11': { basedOn: 'preset:card' }, 't-bb22': { basedOn: 't-aa11' } };
  const b = templateRolesOf(theme, 'dark', 't-bb22', templates);
  assert.deepEqual(b.roles, { background: 3, text: 2 });
  assert.deepEqual(b.typography, { title: 5 });
  const css = colorThemeCss(theme, templates);
  assert.match(rule(css, '.ct-dark .tpl-t-aa11'), /--color-background: var\(--palette-3\)/);
  assert.match(rule(css, '.ct-dark .tpl-t-aa11'), /--color-type-title: var\(--palette-5\)/);
  // a cycle doesn't loop
  assert.deepEqual(
    templateRolesOf(theme, 'dark', 't-x', { 't-x': { basedOn: 't-y' }, 't-y': { basedOn: 't-x' } })
      .roles,
    {},
  );
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
