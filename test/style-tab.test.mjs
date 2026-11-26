// The page's Style tab (its own palette) and the Header's Style tab (its height in grid rows):
// the content format, ewcms check, the render (nothing when unset: a site renders as before),
// the client and the editor's preview taking them in place, and the panels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import {
  PALETTE_SIZE,
  checkPagePalette,
  pagePaletteAttr,
  pagePaletteOf,
  pagePaletteVarList,
} from '../src/render/colors.js';
import {
  MAX_HEADER_ROWS,
  checkHeaderRows,
  headerRowsCss,
  headerRowsOf,
} from '../src/render/header-rows.js';
import { gridRowPx } from '../src/render/layout/contain.js';
import { checkContent } from '../src/render/validate.js';
import { renderRoute } from '../src/render/render.js';
import { applyPalette } from '../src/client/palette.js';
import { applyHeaderRows, applyPagePalette } from '../src/editor/theme-vars.js';
import { headerKey, needsReload } from '../src/editor/lib/needs-reload.js';
import { pagePaletteEdit, pagePaletteShown } from '../src/editor/lib/color-themes.js';
import { HEADER } from '../src/render/files.js';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const SITE = ['#050505', '#101010', '#212121', '#cfc8b8', '#f2efe9'];
const OWN = [null, '#2A241E', null, null, null];

test("a page's palette: 5 slots, each a colour or null (the site's); left out: the site's", () => {
  assert.equal(pagePaletteOf({}), null);
  assert.equal(pagePaletteOf({ palette: [null, null, null, null, null] }), null);
  assert.deepEqual(pagePaletteOf({ palette: OWN }), [null, '#2a241e', null, null, null]);
  assert.equal(pagePaletteOf({ palette: ['#123456'] }), null, 'not 5');
  assert.equal(pagePaletteOf({ palette: [null, '#abc', null, null, null] }), null, '#rrggbb only');
  assert.deepEqual(pagePaletteVarList({ palette: OWN }), [['--palette-2', '#2a241e']]);
  assert.equal(pagePaletteAttr({ palette: OWN }), ',#2a241e,,,');
  assert.equal(pagePaletteAttr({}), '');
  assert.equal(PALETTE_SIZE, 5);
  assert.match(read('client/palette.js'), /const SIZE = 5;/); // PALETTE_SIZE, kept equal
});

test('ewcms check: a page palette and the header rows', () => {
  assert.deepEqual(checkPagePalette(undefined), []);
  assert.deepEqual(checkPagePalette(OWN), []);
  for (const bad of [
    ['#123456'],
    'x',
    [1, null, null, null, null],
    [null, '#abc', null, null, null],
  ])
    assert.match(checkPagePalette(bad).join(''), /"palette" must be 5 entries/);
  const page = { version: 1, kind: 'page', id: 'pg-abcd', sections: [] };
  assert.deepEqual(checkContent('pages/index.json', { ...page, palette: OWN }), []);
  assert.match(
    checkContent('pages/index.json', { ...page, palette: ['#fff'] }).join(''),
    /"palette"/,
  );
  // the header: whole rows from 1 to the max
  const header = { version: 1, header: [] };
  assert.deepEqual(checkContent(HEADER, { ...header, rows: 8, rowsPhone: 11 }), []);
  assert.equal(MAX_HEADER_ROWS, 30);
  for (const v of [0, -1, 2.5, '8', 31, null])
    assert.match(
      checkContent(HEADER, { ...header, rows: v }).join(''),
      /"rows" must be a whole number of grid rows from 1 to 30/,
      String(v),
    );
  assert.match(checkHeaderRows({ rowsPhone: 0 }).join(''), /"rowsPhone"/);
});

test('the header rows: --header-h in grid rows; the phone follows desktop; none: the theme', () => {
  assert.equal(headerRowsCss({}), '');
  assert.equal(headerRowsCss(undefined), '');
  assert.deepEqual(headerRowsOf({ rows: 8 }), { rows: 8, rowsPhone: 8 });
  assert.equal(headerRowsCss({ rows: 8 }), ':root:root { --header-h: calc(8 * var(--grid-row)); }');
  assert.equal(
    headerRowsCss({ rows: 8, rowsPhone: 11 }),
    ':root:root { --header-h: calc(8 * var(--grid-row)); } @media (width <= 760px) { :root:root { --header-h: calc(11 * var(--grid-row)); } }',
  );
  // only the phone's: the desktop keeps the theme's height
  assert.equal(
    headerRowsCss({ rowsPhone: 11 }),
    '@media (width <= 760px) { :root:root { --header-h: calc(11 * var(--grid-row)); } }',
  );
  // the phone breakpoint is $bp-sm; --grid-row is a contained section's cell
  const tokens = read('client/styles/_tokens.scss');
  assert.match(tokens, /\$bp-sm: 760px;/);
  assert.match(tokens, /--grid-row: calc\(\(100vw - 2 \* var\(--grid-pad\)\) \/ var\(--cols\)\);/);
  assert.match(tokens, /--grid-row: calc\(\(100vw - 2 \* var\(--grid-pad\)\) \/ var\(--mcols\)\);/);
  // the same row, px (the Header's Style tab): 1440 with 96 contained columns, a 390 phone
  assert.equal(gridRowPx(1440, 96), 9.6);
  assert.equal(Math.round(gridRowPx(390, 96, true) * 100) / 100, 5.97);
});

const route = { id: 'home', path: '/', page: 'page', title: 'X' };
const content = (page = {}, header = { header: [] }) => ({
  site: { name: 'X', url: 'https://x.com', lang: 'en' },
  header,
  pages: { home: { sections: [], ...page } },
});

test('the render: nothing new when unset (a site renders as before); else the head and the view', () => {
  const plain = renderRoute(route, content());
  assert.doesNotMatch(plain.head, /page-palette|header-rows/);
  assert.doesNotMatch(plain.body, /data-palette/);
  const a = renderRoute(route, content({ palette: OWN }, { header: [], rows: 8, rowsPhone: 11 }));
  assert.match(
    a.head,
    /<style id="page-palette">\s*:root:root:root \{\s*--palette-2: #2a241e;\s*\}/,
  );
  assert.match(
    a.head,
    /<style id="header-rows">\s*:root:root \{ --header-h: calc\(8 \* var\(--grid-row\)\); \}/,
  );
  assert.match(a.body, /data-router-view[^>]*data-palette=",#2a241e,,,"/);
});

test("the client: the view's palette on <html> on every page change, the head's style gone", () => {
  const { document } = parseHTML(
    '<html><head><style id="page-palette">:root:root:root{--palette-2:#2a241e}</style></head><body></body></html>',
  );
  applyPalette(',#2a241e,,,#ffffff', document);
  assert.equal(document.getElementById('page-palette'), null);
  const st = document.documentElement.style;
  assert.equal(st.getPropertyValue('--palette-2'), '#2a241e');
  assert.equal(st.getPropertyValue('--palette-5'), '#ffffff');
  applyPalette('', document); // a page without one: the site's again
  assert.equal(st.getPropertyValue('--palette-2'), '');
  assert.equal(st.getPropertyValue('--palette-5'), '');
  assert.match(
    read('client/main.js'),
    /applyAccent\(view\.dataset\.accent, \{ instant: first \}\);\s*applyPalette\(view\.dataset\.palette\);/,
  );
});

test("the editor's preview: a page's palette and the header's rows in place, no reload", () => {
  const { document } = parseHTML(
    '<html><head></head><body><main data-router-view></main></body></html>',
  );
  applyPagePalette(document, { palette: OWN });
  const view = document.querySelector('[data-router-view]');
  assert.equal(view.dataset.palette, ',#2a241e,,,'); // a remount (layout-sync) reads the same
  assert.equal(document.documentElement.style.getPropertyValue('--palette-2'), '#2a241e');
  applyPagePalette(document, {});
  assert.equal(view.dataset.palette, undefined);
  assert.equal(document.documentElement.style.getPropertyValue('--palette-2'), '');
  applyHeaderRows(document, { rows: 8 });
  assert.match(
    document.getElementById('header-rows').textContent,
    /calc\(8 \* var\(--grid-row\)\)/,
  );
  applyHeaderRows(document, {});
  assert.equal(document.getElementById('header-rows'), null);
  // header.json: a rows edit doesn't reload the preview, a menu edit does
  const a = { [HEADER]: { header: [{ label: 'A' }] } };
  assert.equal(
    headerKey(a),
    headerKey({ [HEADER]: { header: [{ label: 'A' }], rows: 8, rowsPhone: 9 } }),
  );
  assert.notEqual(headerKey(a), headerKey({ [HEADER]: { header: [{ label: 'B' }] } }));
  assert.equal(needsReload([HEADER], { header: false }), false);
  assert.equal(needsReload([HEADER]), true);
  const main = read('editor/main.js');
  assert.match(main, /const header = files\.includes\(HEADER\) && headerMoved\(\);/);
  assert.match(
    main,
    /if \(files\.includes\(page\) \|\| files\.includes\(HEADER\)\) applyLook\(\);/,
  );
  assert.match(main, /headerSeen = headerKey\(store\.current\);/);
});

test("the page's Style tab: five full-width rows, the site's dimmed, its own bright with the reset", () => {
  assert.deepEqual(
    pagePaletteShown({ palette: SITE }, { palette: OWN }).map((s) => [s.hex, s.own]),
    [
      ['#050505', false],
      ['#2a241e', true],
      ['#212121', false],
      ['#cfc8b8', false],
      ['#f2efe9', false],
    ],
  );
  assert.deepEqual(pagePaletteEdit({}, 1, '#2A241E'), [null, '#2a241e', null, null, null]);
  assert.deepEqual(pagePaletteEdit({ palette: OWN }, 0, '#abc'), [
    '#aabbcc',
    '#2a241e',
    null,
    null,
    null,
  ]);
  assert.equal(
    pagePaletteEdit({ palette: OWN }, 1, undefined),
    undefined,
    "all the site's: left out",
  );
  assert.equal(pagePaletteEdit({}, 1, 'red'), null);
  const c = read('editor/svelte/ContentPanel.svelte');
  assert.match(c, /\['page-motion', 'Page motion'\],\s*\['style', 'Style'\],\s*\['seo', 'SEO'\],/);
  assert.match(c, /shownTab === 'style'\}\s*<PageStylePanel \{live\} \{file\} \/>/);
  const s = read('editor/svelte/PageStylePanel.svelte');
  assert.match(s, /class=\{\['hexf', !slots\[i\]\.own && 'is-following'\]\}/);
  assert.match(s, /reset=\{\{\s*on: slots\[i\]\.own,/);
  assert.match(s, /unsaved=\{unsaved\(i\)\}/);
  // the unsaved dot: null and left out are both the site's (no dot on a slot that follows)
  assert.match(
    s,
    /\(live\.get\(file, ptr\(i\)\) \?\? null\) !== \(live\.store\.getBase\(file, ptr\(i\)\) \?\? null\)/,
  );
  assert.match(
    s,
    /\.hexf\.is-following :global\(\.tf__input\),\s*\.hexf\.is-following \.hexf__swatch \{\s*opacity: var\(--o-disabled\);/,
  );
  // no Element / Page switch, no reserved row: the panel is the hint and the five rows
  assert.doesNotMatch(s, /seg|switch/i);
  // the error colour stays a token (tokens.scss), not a role
  assert.doesNotMatch(read('render/colors.js'), /key: 'error'/);
});

test("the Header's Style tab: Height and Height (phone), the phone following desktop", () => {
  const c = read('editor/svelte/ContentPanel.svelte');
  assert.match(c, /\['elements', 'Elements'\],\s*\['style', 'Style'\],/);
  const h = read('editor/svelte/HeaderPart.svelte');
  assert.match(h, /\{:else if tab === 'style'\}/);
  assert.match(h, /edit="\{HEADER\}#\/rows"[\s\S]*?placeholder="Theme's"/);
  assert.match(
    h,
    /edit="\{HEADER\}#\/rowsPhone"[\s\S]*?placeholder=\{rows \? String\(rows\) : "Theme's"\}/,
  );
  assert.match(h, /on: rowsPhone !== null,\s*label: 'Height \(phone\): follow desktop',/);
  // fixed rows, nothing shifts: the help is the same text whatever the value
  assert.match(h, /help="Rows of the grid\. Empty: the theme's height\."/);
  assert.match(h, /help="On phones\. Empty: the same rows as desktop\."/);
  assert.match(h, /<ul class="heights"/);
});
