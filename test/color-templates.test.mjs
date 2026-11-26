// Palette step 4: sub-roles. Text styles (colorThemes.<name>.textStyles) and each template's
// roles (colorThemes.<name>.templates."<id>"); a template made from another gets a copy, once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  colorThemeCss,
  contrastWarnings,
  templateRoleCopies,
  isOldColorToken,
  templateClass,
  templateRolesOf,
} from '../src/render/colors.js';
import { styleMarkup } from '../src/widgets/list/item-style.js';
import { createStore } from '../src/editor/store.js';

const rule = (css, selector) => css.split('\n').find((l) => l.startsWith(`${selector} {`)) || '';

test('no sub-roles: no template rules, no --color-type-* set', () => {
  const css = colorThemeCss({});
  assert.doesNotMatch(css, /\.tpl-/);
  assert.doesNotMatch(css, /--color-type-/);
});

test('a text style set in one theme: the others reset it, so it follows Text', () => {
  const css = colorThemeCss({ colorThemes: { light: { textStyles: { label: 3 } } } });
  assert.match(rule(css, '.ct-light'), /--color-type-label: var\(--palette-3\)/);
  assert.match(rule(css, '.ct-dark'), /--color-type-label: initial/);
  // only the set text style is written
  assert.doesNotMatch(css, /--color-type-paragraph/);
  // the text styles read it, else Text (all of them: Heading is a text style, not a role)
  const scss = fs.readFileSync(new URL('../src/client/styles/_text.scss', import.meta.url), 'utf8');
  assert.match(scss, /color: var\(--color-type-label, var\(--color-text\)\);/);
  assert.match(scss, /color: var\(--color-type-small, var\(--color-text\)\);/);
  assert.match(scss, /color: var\(--color-type-title, var\(--color-text\)\);/);
  assert.doesNotMatch(scss, /--color-heading/);
  assert.doesNotMatch(css, /--color-heading/);
  assert.doesNotMatch(scss, /--type-[a-z]+-color/);
});

test("a template's text style it leaves out: its own Text when it sets one, over the section's text style", () => {
  const theme = {
    colorThemes: {
      dark: {
        textStyles: { title: 3 },
        templates: { 'preset:card': { text: 4 }, 'preset:row': { background: 2 }, 't-ab12': { textStyles: { title: 1 } } },
      },
    },
  };
  const css = colorThemeCss(theme);
  // it sets Text: its Title follows it (the editor shows "follows the template's Text")
  assert.match(rule(css, '.ct-dark .tpl-preset-card'), /--color-type-title: var\(--color-text\);/);
  // no Text of its own: the section's Title
  assert.match(rule(css, '.ct-dark .tpl-preset-row'), /--color-type-title: inherit;/);
  // its own Title wins
  assert.match(rule(css, '.ct-dark .tpl-t-ab12'), /--color-type-title: var\(--palette-1\);/);
});

test("a template's sub-roles apply only inside its items, in that theme", () => {
  const theme = {
    colorThemes: { dark: { templates: { 'preset:card': { background: 3, text: '#333' } } } },
  };
  const css = colorThemeCss(theme);
  const dark = rule(css, '.ct-dark .tpl-preset-card');
  assert.match(dark, /--color-background: var\(--palette-3\)/);
  assert.match(dark, /--color-text: #333/);
  assert.match(dark, /--color-link: inherit/);
  assert.doesNotMatch(dark, /--color-heading/);
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
  assert.equal(styleMarkup({ background: 'transparent' }).vars, '--item-bg:transparent');
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
      dark: { templates: { 'preset:card': { background: 3, textStyles: { title: 5 } } } },
      light: { link: 2 },
    },
  };
  // a template with no entry of its own: the section's roles (no rules), whatever its basedOn
  assert.deepEqual(templateRolesOf(theme, 'dark', 't-aa11'), { roles: {}, textStyles: {} });
  assert.doesNotMatch(colorThemeCss(theme), /tpl-t-aa11/);
  // copied: its own entry, in each theme that had the parent's, as edits to theme.json
  const copies = templateRoleCopies(theme, 'preset:card', 't-aa11');
  assert.deepEqual(copies, [['/colorThemes/dark/templates/t-aa11', { background: 3, textStyles: { title: 5 } }]]);
  assert.equal(theme.colorThemes.dark.templates['t-aa11'], undefined, 'theme.json given is not changed');
  // the editor applies them to its theme.json, unsaved edits too, as one undo step
  const store = createStore();
  store.load({ 'theme.json': theme });
  store.set('theme.json', '/colorThemes/light/link', 3); // an unsaved edit, before
  store.batch(() => copies.forEach(([ptr, v]) => store.set('theme.json', ptr, v)));
  const edited = store.current['theme.json'];
  assert.deepEqual(edited.colorThemes.dark.templates['t-aa11'], { background: 3, textStyles: { title: 5 } });
  assert.match(rule(colorThemeCss(structuredClone(edited)), '.ct-dark .tpl-t-aa11'), /--color-background: var\(--palette-3\)/);
  // then each is its own: the parent's later edit doesn't reach it
  store.set('theme.json', '/colorThemes/dark/templates/preset:card/background', 4);
  assert.equal(edited.colorThemes.dark.templates['t-aa11'].background, 3);
  // undo: the parent's edit, then the copy (one step), and the edit before stays undoable
  assert.ok(store.undo() && store.undo());
  assert.equal(store.current['theme.json'].colorThemes.dark.templates['t-aa11'], undefined);
  assert.equal(store.current['theme.json'].colorThemes.light.link, 3);
  assert.ok(store.undo());
  assert.equal(store.current['theme.json'].colorThemes.light.link, 2);
  // nothing to copy, or an entry of its own already: none
  const copied = structuredClone(theme);
  copied.colorThemes.dark.templates['t-aa11'] = {};
  assert.deepEqual(templateRoleCopies(theme, 'preset:row', 't-bb22'), []);
  assert.deepEqual(templateRoleCopies({}, 'preset:card', 't-bb22'), []);
  assert.deepEqual(templateRoleCopies(copied, 'preset:card', 't-aa11'), []);
  // Duplicate does it in the editor (the server writes only the template file)
  const actions = fs.readFileSync(new URL('../src/editor/svelte/TemplateActions.svelte', import.meta.url), 'utf8');
  assert.match(actions, /templateRoleCopies\(live\.store\.current\[THEME\], templateId, res\.id\)/);
  assert.match(actions, /live\.store\.batch\(\(\) => copies\.forEach/);
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

test('one source: the text styles are layout/text-styles.js\'s, a template id a preset or "t-…" (files.js)', async () => {
  const { checkColors, TEXT_STYLE_PARENT } = await import('../src/render/colors.js');
  const { TEXT_STYLES } = await import('../src/render/layout/text-styles.js');
  const { PRESET_FROM } = await import('../src/render/files.js');
  assert.deepEqual(Object.keys(TEXT_STYLE_PARENT), Object.keys(TEXT_STYLES));
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
  const seeThrough = seeThroughTemplates({ 't-ab12': { style: { background: 'transparent' } }, 't-cd34': { style: {} } });
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
