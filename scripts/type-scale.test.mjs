// The type scale (src/site/layout/type.js): site.json "type" over the theme's sizes, as CSS
// variables on the page's :root; Site Settings › Type and its Preview, the type specimen
// (src/site/layout/type-specimen.js, /__type/); the preview follows Type without a reload.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TYPE_SCALE,
  TYPE_VARS,
  TEXT_STYLES,
  checkType,
  typeOf,
  typeVarList,
  typeVars,
} from '../src/site/layout/type.js';
import {
  SPECIMEN_PAGE,
  TYPE_SPECIMEN,
  isTypeSpecimen,
  specimenPage,
  typeSpecimen,
} from '../src/site/layout/type-specimen.js';
import { LINE_STYLES } from '../src/site/text.js';
import { checkContent } from '../src/site/validate.js';
import { needsReload, siteKey } from '../src/editor/lib/needs-reload.js';
import { HEADER, SITE, pageFile } from '../src/site/files.js';
import { renderOp } from './editor-server.mjs';
import * as render from '../src/site/render.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const site = (more) => ({ version: 1, name: 'x', url: 'https://x.test', ...more });

test('typeOf / typeVars: only what site.json sets, valid numbers only', () => {
  assert.deepEqual(typeOf({}), {});
  assert.equal(typeVars({}), '');
  const s = { type: { heading: { min: 40, line: 1.1 }, small: { max: 14 }, huge: { min: 9 } } };
  assert.deepEqual(typeOf(s), { heading: { min: 40, line: 1.1 }, small: { max: 14 } });
  assert.equal(
    typeVars(s),
    '--type-heading-min: 40px; --type-heading-lh: 1.1; --type-small-max: 14px',
  );
  assert.deepEqual(typeVarList({ type: { title: { min: 'big', max: 0, line: 0.9 } } }), [
    ['--type-title-lh', '0.9'],
  ]);
  // every style has three variables
  assert.equal(TYPE_VARS.length, Object.keys(TYPE_SCALE).length * 3);
});

test('checkType: styles, keys, numbers, min not over max; "typography" is gone', () => {
  assert.deepEqual(checkType(undefined), []);
  assert.deepEqual(checkType({ heading: { min: 40, max: 90, line: 1 } }), []);
  assert.deepEqual(checkType(3), ['"type" must be an object { <style>: { min, max, line } }']);
  assert.deepEqual(checkType({ huge: {}, heading: { min: 0, tracking: 1 }, small: 2 }), [
    'type: unknown style "huge" (title, heading, subheading, statement, paragraph, label, small)',
    'type.heading.min must be more than 0',
    'type.heading: unknown key "tracking"',
    'type.small must be an object { min, max, line }',
  ]);
  // against the theme's default when only one is set
  assert.deepEqual(checkType({ heading: { max: 20 } }), [
    'type.heading: min (38px) is more than max (20px)',
  ]);
  assert.deepEqual(checkContent(SITE, site({ type: { paragraph: { min: 15, max: 18 } } })), []);
  assert.match(checkContent(SITE, site({ typography: {} })).join(), /"typography" is gone/);
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
  // no fixed px sizes left in the text styles
  assert.doesNotMatch(text, /font-size: \d+px/);
  // the same styles everywhere
  assert.deepEqual(Object.keys(TYPE_SCALE).sort(), LINE_STYLES.map(([s]) => s).sort());
  assert.deepEqual(Object.keys(TEXT_STYLES).sort(), Object.keys(TYPE_SCALE).sort());
});

test("the page's head: site.json type as :root variables", () => {
  const content = render.typeSpecimen({}).content;
  const shown = {
    ...content,
    site: site({ type: { heading: { min: 44 } } }),
  };
  const { route } = render.typeSpecimen(shown);
  const { head } = render.renderRoute(route, render.typeSpecimen(shown).content);
  assert.match(head, /:root \{[^}]*--type-heading-min: 44px;/);
  const plain = render.renderRoute(
    route,
    render.typeSpecimen({ ...content, site: site() }).content,
  );
  assert.doesNotMatch(plain.head, /--type-/);
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
    read('scripts/vite-plugin-static-site.mjs'),
    /if \(!route && isTypeSpecimen\(pathname\)\)/,
  );
});

test('needsReload: site.json reloads unless only its type changed (siteKey)', () => {
  const a = { [SITE]: site({ type: { heading: { min: 40 } } }) };
  const b = { [SITE]: site({ type: { heading: { min: 50 } } }) };
  const c = { [SITE]: site({ name: 'y', type: { heading: { min: 50 } } }) };
  assert.equal(siteKey(a), siteKey(b));
  assert.notEqual(siteKey(b), siteKey(c));
  assert.equal(siteKey({ [SITE]: site() }), siteKey(a));
  assert.equal(needsReload([SITE], { site: false }), false);
  assert.equal(needsReload([SITE], { site: true }), true);
  assert.equal(needsReload([SITE]), true); // left out: it did
  assert.equal(needsReload([SITE, HEADER], { site: false }), true);
  const main = read('src/editor/main.js');
  assert.match(main, /site: dirty\.includes\(SITE\) && siteKey\(store\.base\) !== siteKey/);
});

test('Site Settings › Type: a row per style with its tag, Preview / Close preview, live in the preview', () => {
  const panel = read('src/editor/svelte/SettingsPanel.svelte');
  assert.match(panel, /title="Type"/);
  assert.doesNotMatch(panel, /typography|Size \(cells\)|Tracking/);
  assert.match(panel, /\{name\} · \{tag\.toUpperCase\(\)\}/);
  for (const label of ['Min (px)', 'Max (px)', "'Line'"]) assert.ok(panel.includes(label), label);
  assert.match(panel, /specimen \? 'Close preview' : 'Preview'/);
  assert.match(panel, /actions\.showSpecimen\(!specimen\)/);
  // the preview's root gets the variables (and loses those cleared); never the editor's
  assert.match(panel, /root\.style\.setProperty\(name, set\.get\(name\)\)/);
  assert.match(panel, /root\.style\.removeProperty\(name\)/);
  assert.match(panel, /bridge\.doc\?\.documentElement/);
  const main = read('src/editor/main.js');
  // the Pages tab closes the specimen, back to the page it replaced
  assert.match(main, /if \(panel === 'nav'\) showSpecimen\(false\);/);
  assert.match(
    main,
    /ui\.specimenFrom = bridge\.path\(\) \|\| ui\.path;\s*bridge\.navigate\(TYPE_SPECIMEN\)/,
  );
  assert.match(
    read('src/editor/svelte/App.svelte'),
    /<SettingsPanel \{live\} \{bridge\} \{actions\} \/>/,
  );
});
