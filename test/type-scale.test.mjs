// The type scale (src/render/layout/type.js): content/theme.json "typography" over the theme's
// sizes, as CSS variables on the page's :root; Theme › Typography and its Preview, the type
// specimen (src/render/layout/type-specimen.js, /__type/); the preview follows theme.json
// without a reload (src/editor/theme-vars.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TYPE_SCALE,
  TYPE_VARS,
  TYPE_RESERVED,
  TYPE_FONT_OF,
  TEXT_STYLES,
  checkType,
  fontsOf,
  typeFontWarnings,
  typeOf,
  typeVarList,
  typeVars,
} from '../src/render/layout/type.js';
import {
  SPECIMEN_PAGE,
  TYPE_SPECIMEN,
  isTypeSpecimen,
  specimenPage,
  typeSpecimen,
} from '../src/render/layout/type-specimen.js';
import { LINE_STYLES } from '../src/render/text.js';
import { checkContent } from '../src/render/validate.js';
import { IN_PLACE, needsReload, siteKey } from '../src/editor/lib/needs-reload.js';
import { applyThemeVars, themeStyleText } from '../src/editor/theme-vars.js';
import { HEADER, SITE, THEME, pageFile } from '../src/render/files.js';
import { renderOp } from '../src/editor/server/editor-server.mjs';
import * as render from '../src/render/render.js';
import { SITE_A } from './fixtures/index.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const site = (more) => ({ version: 1, name: 'x', url: 'https://x.test', ...more });

test('typeOf / typeVars: only what theme.json typography sets, valid numbers only', () => {
  assert.deepEqual(typeOf({}), {});
  assert.equal(typeVars({}), '');
  assert.deepEqual(typeOf({ type: { heading: { min: 40 } } }), {}); // the old key: not read
  const s = {
    typography: { heading: { min: 40, line: 1.1 }, small: { max: 14 }, huge: { min: 9 } },
  };
  assert.deepEqual(typeOf(s), { heading: { min: 40, line: 1.1 }, small: { max: 14 } });
  assert.equal(
    typeVars(s),
    '--type-heading-min: 40px; --type-heading-lh: 1.1; --type-small-max: 14px',
  );
  assert.deepEqual(typeVarList({ typography: { title: { min: 'big', max: 0, line: 0.9 } } }), [
    ['--type-title-lh', '0.9'],
  ]);
  // every style has min, max, lh and font, plus the two global font tokens
  assert.equal(TYPE_VARS.length, Object.keys(TYPE_SCALE).length * 4 + TYPE_RESERVED.fonts.length);
  assert.ok(TYPE_VARS.includes('--f-display') && TYPE_VARS.includes('--type-heading-font'));
});

test('checkType: styles, keys, numbers, min not over max (theme.json typography)', () => {
  assert.deepEqual(checkType(undefined), []);
  assert.deepEqual(checkType({ heading: { min: 40, max: 90, line: 1 } }), []);
  assert.deepEqual(checkType(3), [
    '"typography" must be an object { fonts?, <style>: { min, max, line, font } }',
  ]);
  assert.deepEqual(checkType({ huge: {}, heading: { min: 0, tracking: 1 }, small: 2 }), [
    'typography: unknown style "huge" (title, heading, subheading, statement, paragraph, label, small)',
    'typography.heading.min must be more than 0',
    'typography.heading: unknown key "tracking"',
    'typography.small must be an object { min, max, line, font }',
  ]);
  // against the theme's default when only one is set
  assert.deepEqual(checkType({ heading: { max: 20 } }), [
    'typography.heading: min (38px) is more than max (20px)',
  ]);
  const theme = (typography) => ({ version: 1, typography });
  assert.deepEqual(checkContent(THEME, theme({ paragraph: { min: 15, max: 18 } })), []);
  assert.match(
    checkContent(THEME, theme({ paragraph: { min: -1 } })).join(),
    /must be more than 0/,
  );
  // site.json's are leftovers: ignored, only warnings
  assert.deepEqual(
    checkContent(SITE, site({ type: { paragraph: { min: -1 } }, typography: {} })),
    [],
  );
  // fonts is reserved (TYPE_RESERVED), not a style; font is a string on a style
  assert.ok(TYPE_RESERVED.fonts.includes('display') && TYPE_RESERVED.fonts.includes('body'));
  assert.deepEqual(checkType({ fonts: { display: 'DM Mono', body: 'Momo Trust Display' } }), []);
  assert.deepEqual(checkType({ fonts: 'DM Mono' }), [
    'typography.fonts must be an object { display, body }',
  ]);
  assert.deepEqual(checkType({ fonts: { display: '', heading: 1 } }), [
    'typography.fonts.display must be a string',
    'typography.fonts: unknown key "heading"',
  ]);
  assert.deepEqual(checkType({ heading: { font: 'DM Mono' } }), []);
  assert.deepEqual(checkType({ heading: { font: 3 } }), ['typography.heading.font must be a string']);
  // an unknown name is kept (not a shape error); typeFontWarnings names it
  assert.deepEqual(checkType({ heading: { font: 'Comic Sans' } }), []);
});

const FONTS = [
  { family: 'DM Mono', fallback: "ui-monospace, 'SFMono-Regular', Menlo, monospace" },
  { family: 'Momo Trust Display', fallback: "'Didot', 'Times New Roman', serif" },
];

test('fontsOf / typeVarList: known fonts emit a stack; unknown or empty names are omitted', () => {
  assert.deepEqual(
    fontsOf(FONTS).map((f) => f.family),
    ['DM Mono', 'Momo Trust Display'],
  );
  assert.equal(
    fontsOf(FONTS).find((f) => f.family === 'DM Mono').stack,
    "'DM Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
  );
  assert.deepEqual(fontsOf(undefined), []);
  assert.deepEqual(fontsOf([{ family: '' }, 'nope', { fallback: 'serif' }]), []);
  const theme = {
    typography: {
      fonts: { display: 'Momo Trust Display', body: 'DM Mono' },
      heading: { min: 40, font: 'DM Mono' },
      title: { font: 'Comic Sans' },
      paragraph: { font: '' },
    },
  };
  // without the catalog, font vars are omitted (call sites that pass only theme.json still work)
  assert.deepEqual(typeVarList(theme), [['--type-heading-min', '40px']]);
  assert.deepEqual(typeVarList(theme, FONTS), [
    ['--type-heading-min', '40px'],
    ['--f-display', "'Momo Trust Display', 'Didot', 'Times New Roman', serif"],
    ['--f-body', "'DM Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"],
    ['--type-heading-font', "'DM Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"],
  ]);
  assert.doesNotMatch(typeVars(theme, FONTS), /Comic Sans|--type-title-font|--type-paragraph-font/);
  assert.deepEqual(typeFontWarnings(theme.typography, FONTS), [
    '"typography.title.font" "Comic Sans" is not a font this theme provides (DM Mono, Momo Trust Display)',
  ]);
  assert.deepEqual(typeFontWarnings({ fonts: { body: 'Comic Sans' } }, FONTS), [
    '"typography.fonts.body" "Comic Sans" is not a font this theme provides (DM Mono, Momo Trust Display)',
  ]);
  assert.deepEqual(TYPE_FONT_OF.heading, 'display');
  assert.deepEqual(TYPE_FONT_OF.label, 'body');
  assert.deepEqual(TYPE_FONT_OF.paragraph, 'body');
});

test("the theme's defaults: _tokens.scss is TYPE_SCALE, _text.scss sizes every style by them", () => {
  const tokens = read('src/client/styles/_tokens.scss');
  for (const [k, d] of Object.entries(TYPE_SCALE)) {
    assert.match(tokens, new RegExp(`--type-${k}-min: ${d.min}px;`), k);
    assert.match(tokens, new RegExp(`--type-${k}-max: ${d.max}px;`), k);
    assert.match(tokens, new RegExp(`--type-${k}-lh: ${d.line};`), k);
  }
  const text = read('src/client/styles/_text.scss');
  for (const k of Object.keys(TYPE_SCALE)) {
    assert.match(
      text,
      new RegExp(
        `font-size: clamp\\(var\\(--type-${k}-min\\), [\\d.]+vw, var\\(--type-${k}-max\\)\\)`,
      ),
      k,
    );
    assert.match(text, new RegExp(`line-height: var\\(--type-${k}-lh\\)`), k);
  }
  // a style's font: --type-<style>-font over the global or inherit
  assert.match(text, /\.ts--title \{[^}]*font-family: var\(--type-title-font, var\(--f-display\)\)/);
  assert.match(text, /\.ts--heading \{[^}]*font-family: var\(--type-heading-font, var\(--f-display\)\)/);
  assert.match(text, /\.ts--subheading \{[^}]*font-family: var\(--type-subheading-font, var\(--f-display\)\)/);
  assert.match(text, /\.ts--statement \{[^}]*font-family: var\(--type-statement-font, var\(--f-display\)\)/);
  assert.match(text, /\.ts--label \{[^}]*font-family: var\(--type-label-font, var\(--f-body\)\)/);
  assert.match(text, /\.ts--paragraph \{[^}]*font-family: var\(--type-paragraph-font, inherit\)/);
  assert.match(text, /\.ts--small \{[^}]*font-family: var\(--type-small-font, inherit\)/);
  // no fixed px sizes left in the text styles
  assert.doesNotMatch(text, /font-size: \d+px/);
  // the same styles everywhere
  assert.deepEqual(Object.keys(TYPE_SCALE).sort(), LINE_STYLES.map(([s]) => s).sort());
  assert.deepEqual(Object.keys(TEXT_STYLES).sort(), Object.keys(TYPE_SCALE).sort());
});

test("the page's head: theme.json typography as :root variables", () => {
  const content = render.typeSpecimen({}).content;
  const shown = {
    ...content,
    site: site({ type: { heading: { min: 99 } } }),
    theme: { typography: { heading: { min: 44 } } },
  };
  const { route } = render.typeSpecimen(shown);
  const { head } = render.renderRoute(route, render.typeSpecimen(shown).content);
  // :root:root: over the theme's :root defaults, whichever stylesheet loads later (G11)
  assert.match(head, /:root:root \{[^}]*--type-heading-min: 44px;/);
  assert.doesNotMatch(head, /99px/); // site.json's type: not read
  const plain = render.renderRoute(
    route,
    render.typeSpecimen({ ...content, site: site() }).content,
  );
  assert.doesNotMatch(plain.head, /--type-/);
  const withFonts = render.renderRoute(
    route,
    render.typeSpecimen({
      ...content,
      site: site(),
      theme: { typography: { fonts: { body: 'DM Mono' }, heading: { font: 'Momo Trust Display' } } },
      fonts: FONTS,
    }).content,
  );
  // the head escapes quotes in the stack (&#39;), so a stack is not a single ;-terminated run
  assert.match(withFonts.head, /--f-body:.*DM Mono.*ui-monospace/s);
  assert.match(withFonts.head, /--type-heading-font:.*Momo Trust Display/s);
  const unknown = render.renderRoute(
    route,
    render.typeSpecimen({
      ...content,
      site: site(),
      theme: { typography: { heading: { font: 'Comic Sans' } } },
      fonts: FONTS,
    }).content,
  );
  assert.doesNotMatch(unknown.head, /Comic Sans|--type-heading-font/);
});

test('the type specimen: one full-width section, a Text widget per style, each following the last', () => {
  assert.equal(TYPE_SPECIMEN, '/__type/');
  assert.ok(isTypeSpecimen('/__type/'));
  assert.ok(!isTypeSpecimen('/__type/x/'));
  assert.ok(!isTypeSpecimen('/'));
  const page = specimenPage();
  assert.equal(page.sections.length, 1);
  const [sec] = page.sections;
  assert.equal(sec.width, 'full');
  assert.equal(sec.height, undefined); // fit
  assert.deepEqual(
    sec.widgets.map((w) => [w.type, w.body[0].style, w.body[0].text[0].t]),
    LINE_STYLES.map(([s, label, tag]) => ['text', s, `${label} · ${tag.toUpperCase()}`]),
  );
  assert.equal(sec.widgets[1].body[0].text[0].t, 'Heading · H2');
  assert.deepEqual(sec.widgets[0].layout.base, { col: 1, span: 120, row: 1 });
  for (const [i, w] of sec.widgets.entries()) {
    assert.equal(w.layout.base.span, 120);
    assert.equal(w.layout.base.rows, undefined); // auto height
    if (i) assert.deepEqual(w.layout.base.link, { to: sec.widgets[i - 1].id, gap: 4 });
  }
  // a valid page, never a file of the content
  assert.deepEqual(
    checkContent(pageFile(SPECIMEN_PAGE), { version: 1, kind: 'page', ...page }),
    [],
  );
  const content = { pages: { home: { sections: [] } } };
  const out = typeSpecimen(content);
  assert.equal(out.route.path, '/__type/');
  assert.equal(out.route.noindex, true);
  assert.ok(out.content.pages[SPECIMEN_PAGE]);
  assert.equal(content.pages[SPECIMEN_PAGE], undefined);
});

test('the type specimen renders: the full page (dev middleware) and its section (renderOp)', () => {
  const { route, content } = render.typeSpecimen({ site: site(), pages: {} });
  const { body } = render.renderRoute(route, content, { editable: true });
  for (const [s] of LINE_STYLES) assert.match(body, new RegExp(`class="ts ts--${s}"`), s);
  assert.match(body, /Statement · P/);
  const file = pageFile(SPECIMEN_PAGE);
  const r = renderOp(render, SITE_A, {}, { path: TYPE_SPECIMEN, file, ids: ['s-type'] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.html['s-type'], /data-sec="s-type"/);
  assert.match(r.body.html['s-type'], /Subheading · H3/);
  assert.equal(
    renderOp(render, SITE_A, {}, { path: TYPE_SPECIMEN, file: pageFile('about'), ids: [] }).status,
    400,
  );
  // the dev middleware alone serves it (only for a path no page has)
  assert.match(
    read('src/cli/vite-plugin-static-site.mjs'),
    /if \(!route && isTypeSpecimen\(pathname\)\)/,
  );
});

test('needsReload: theme.json never reloads; site.json does when it changed (siteKey)', () => {
  assert.ok(IN_PLACE.includes(THEME));
  assert.equal(needsReload([THEME]), false);
  assert.equal(needsReload([THEME, HEADER]), true);
  const a = { [SITE]: site() };
  const b = { [SITE]: site({ name: 'y' }) };
  assert.equal(siteKey(a), siteKey({ [SITE]: site() }));
  assert.notEqual(siteKey(a), siteKey(b));
  assert.equal(siteKey({}), 'null');
  assert.equal(needsReload([SITE], { site: false }), false);
  assert.equal(needsReload([SITE], { site: true }), true);
  assert.equal(needsReload([SITE]), true); // left out: it did
  assert.equal(needsReload([SITE, HEADER], { site: false }), true);
  const main = read('src/editor/main.js');
  assert.match(main, /site: dirty\.includes\(SITE\) && siteKey\(store\.base\) !== siteKey/);
});

test('Theme › Typography: a row per style with its tag, Preview / Close preview, theme.json', () => {
  const panel = read('src/editor/svelte/ThemePanel.svelte');
  assert.match(panel, /<Collapsible key="theme:typography" title="Typography">/);
  assert.doesNotMatch(panel, /title="Type"|\bSITE\b|Size \(cells\)|Tracking/);
  assert.match(panel, /edit="\{THEME\}#\/typography\/\{k\}\/\{key\}"/);
  assert.match(panel, /live\.store\.set\(THEME, '\/typography'/);
  // the section is named Typography wherever the editor points at it
  const toolbar = read('src/editor/svelte/WidgetToolbar.svelte');
  assert.match(toolbar, /· Theme › Typography<\/span/);
  assert.doesNotMatch(toolbar, /Theme › Type</);
  assert.match(panel, /\{name\} · \{tag\.toUpperCase\(\)\}/);
  for (const label of ['Min (px)', 'Max (px)', "'Line'"]) assert.ok(panel.includes(label), label);
  // Display font and Body font at the top; Font per style, empty state names what it follows
  assert.match(panel, /display: 'Display font', body: 'Body font'/);
  assert.match(panel, /edit="\{THEME\}#\/typography\/fonts\/\{role\}"/);
  assert.match(panel, /edit="\{THEME\}#\/typography\/\{k\}\/font"/);
  assert.match(panel, /label="Font"/);
  assert.match(panel, /styleFontPlaceholder\(k\)/);
  assert.match(panel, /`\$\{label\} \(\$\{name\}\)`/);
  assert.match(panel, /key: `text:\$\{THEME\}#\/typography\/fonts\/\$\{role\}`/);
  assert.match(panel, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(panel, /\.style-font \{[^}]*margin-top: var\(--gap-fields\)/);
  assert.match(read('src/editor/svelte/Field.svelte'), /placeholder=\{placeholder \|\| 'Pick…'\}/);
  assert.match(panel, /specimen \? 'Close preview' : 'Preview'/);
  assert.match(panel, /actions\.showSpecimen\(!specimen\)/);
  // the panel only reads the preview's sizes (the placeholders); main.js puts theme.json on it
  assert.doesNotMatch(panel, /setProperty|removeProperty|applyThemeVars/);
  assert.match(panel, /bridge\.doc\?\.documentElement/);
  const main = read('src/editor/main.js');
  // on every theme.json change (an edit, undo, redo) and every page the preview loads
  assert.match(main, /if \(files\.includes\(THEME\)\) applyTheme\(bridge\.doc, store\.current\[THEME\], editorConfig\.fonts\);/);
  assert.match(
    main,
    /pushCurtains\(\);[\s\S]{0,160}applyTheme\(bridge\.doc, store\.current\[THEME\], editorConfig\.fonts\);\s*ui\.previewVersion\+\+;/,
  );
  // another area closes the specimen, back to the page it replaced
  assert.match(main, /if \(panel !== 'theme'\) showSpecimen\(false\);/);
  assert.match(
    main,
    /ui\.specimenFrom = bridge\.path\(\) \|\| ui\.path;\s*bridge\.navigate\(TYPE_SPECIMEN\)/,
  );
  // the panel gets the bridge and actions (App.svelte, from its record in areas.js)
  assert.match(read('src/editor/svelte/App.svelte'), /<Panel \{live\} \{bridge\} \{actions\} \/>/);
  assert.match(read('src/editor/areas.js'), /import\('\.\/svelte\/ThemePanel\.svelte'\)/);
});

test("the preview follows theme.json: its theme-vars style's :root:root block (theme-vars.js)", () => {
  const head = `
      :root { --accent: #123456; }
      :root:root {
        --brand: #cc2020; --contain: 80;
      }
    `;
  // replaced, the album's --accent kept
  const t = themeStyleText(head, { color: { brand: '#00FF00' }, typography: { heading: { min: 40 } } });
  assert.match(t, /:root \{ --accent: #123456; \}/);
  assert.match(t, /:root:root \{\s*--brand: #00ff00; --type-heading-min: 40px;\s*\}/);
  assert.doesNotMatch(t, /#cc2020|--contain/);
  assert.equal(t.match(/:root:root/g).length, 1);
  // all cleared: no block, so tokens.scss's defaults show
  const none = themeStyleText(head, {});
  assert.doesNotMatch(none, /:root:root|--brand/);
  assert.match(none, /--accent: #123456/);
  assert.equal(themeStyleText(themeStyleText(head, {}), { layout: { containedCols: 80 } }).match(/:root:root/g).length, 1);
  // applied again and again: the same text (nothing piles up)
  const v = { color: { brand: '#cc2020' } };
  assert.equal(themeStyleText(themeStyleText(head, v), v), themeStyleText(head, v));
  // on a document: the page's style, or a new one when the page had none
  const els = {};
  const doc = {
    head: { prepend: (el) => (els[el.id] = el) },
    getElementById: (id) => els[id] || null,
    createElement: () => ({ id: '', textContent: '' }),
  };
  applyThemeVars(doc, {});
  assert.equal(els['theme-vars'], undefined);
  applyThemeVars(doc, { color: { brand: '#cc2020' } });
  assert.match(els['theme-vars'].textContent, /:root:root \{\s*--brand: #cc2020;\s*\}/);
  applyThemeVars(doc, {});
  assert.doesNotMatch(els['theme-vars'].textContent, /--brand/);
  applyThemeVars(null, {}); // no preview yet: nothing
  // typography fonts: a known name writes the stack; clearing or an unknown name drops the var
  const fonts = [
    { family: 'DM Mono', fallback: 'monospace' },
    { family: 'Momo Trust Display', fallback: 'serif' },
  ];
  applyThemeVars(
    doc,
    { typography: { fonts: { body: 'DM Mono' }, heading: { font: 'Momo Trust Display' } } },
    fonts,
  );
  assert.match(els['theme-vars'].textContent, /--f-body: 'DM Mono', monospace/);
  assert.match(els['theme-vars'].textContent, /--type-heading-font: 'Momo Trust Display', serif/);
  applyThemeVars(doc, { typography: { heading: { font: 'Comic Sans' } } }, fonts);
  assert.doesNotMatch(els['theme-vars'].textContent, /--f-body|--type-heading-font|Comic Sans/);
  applyThemeVars(doc, { typography: { fonts: { body: 'DM Mono' } } }, fonts);
  applyThemeVars(doc, { typography: {} }, fonts);
  assert.doesNotMatch(els['theme-vars'].textContent, /--f-body/);
});
