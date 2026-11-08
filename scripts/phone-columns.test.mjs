// A List's phone columns (config.phoneColumns: the Columns row per layout, the editor's phone view).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as sass from 'sass';
import { parseHTML } from 'linkedom';
import { warnings } from './test-layout.mjs';
import { loadContent } from './content.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { newWidget, newSection, renderSections } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const base = loadContent(SITE_A);
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

function list(config) {
  const { routes } = buildRoutes(base);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = { ...w, id: 'w-phc1', source: { mode: 'all', from: 'people' } };
  widget.config = { ...w.config, columns: '3', ...config };
  const ctx = { ...base, route: page, routes, curtains: {} };
  const [html] = warnings(() =>
    renderSections(ctx, page, 'pages/test/index.json', [newSection(ids, [widget])]),
  );
  return { widget, el: parseHTML(`<!doctype html><html><body>${html}</body></html>`).document };
}
const page = (widget) => ({
  version: 1,
  kind: 'page',
  id: 'pg-phcl',
  sections: [{ id: 's-phcl', widgets: [widget] }],
});

test('rendered: --list-mcols only when set; left out, a phone shows one column as before', () => {
  const two = list({ phoneColumns: '2' }).el.querySelector('.list__items');
  assert.match(two.getAttribute('style'), /--list-cols:3;--list-mcols:2/);
  const none = list({}).el.querySelector('.list__items');
  assert.equal(none.getAttribute('style'), '--list-cols:3');
  const css = read('src/site/widgets/list/style.scss');
  assert.match(css, /repeat\(var\(--list-mcols, 1\), minmax\(0, 1fr\)\)/);
});

test('validated: 1, 2 or 3', () => {
  const ok = list({ phoneColumns: '3' }).widget;
  assert.deepEqual(checkContent('pages/x/index.json', page(ok)), []);
  const bad = list({ phoneColumns: '4' }).widget;
  assert.ok(
    checkContent('pages/x/index.json', page(bad)).some((m) => /config.phoneColumns/.test(m)),
  );
});

test('the editor: the Columns row per layout, in the same place (no shift)', () => {
  const row = WIDGET_TYPES.list.config.find((c) => c.key === 'columns');
  assert.deepEqual(row.phone, {
    key: 'phoneColumns',
    label: 'Phone columns',
    options: [
      ['1', '1'],
      ['2', '2'],
      ['3', '3'],
    ],
    default: '1',
  });
  const wl = read('src/editor/svelte/WidgetLayout.svelte');
  assert.match(wl, /phoneView && row\.phone \? \{ \.\.\.row, \.\.\.row\.phone \} : row/);
  assert.match(wl, /#each options as row \(row\.key\)/); // keyed by the row: swapped, not moved
});

// the List's grid rules, cascaded at a viewport width (media max-width, specificity, then order)
const GRID_CSS = sass.compileString(
  read('src/site/widgets/list/style.scss').replace(/@use[^;]+;/g, '$bp-md: 900px; $bp-sm: 760px;'),
).css;
const spec = (sel) => {
  const flat = sel.replace(/:not\(([^)]*)\)/g, ' $1');
  return (flat.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length;
};
function columnsAt(el, width) {
  const rules = [];
  const re = /@media\s*\(([^)]*)\)\s*\{|([^{}@]+)\{([^{}]*)\}|\}/g;
  let media = [];
  let m;
  while ((m = re.exec(GRID_CSS))) {
    if (m[1] !== undefined) {
      const w = /width\s*<=\s*(\d+)px|max-width:\s*(\d+)px/.exec(m[1]);
      media.push(w ? Number(w[1] || w[2]) : Infinity);
    } else if (m[2] !== undefined) {
      const d = /grid-template-columns:\s*([^;]+)/.exec(m[3]);
      if (d && media.every((max) => width <= max))
        for (const sel of m[2].split(',').map((x) => x.trim()))
          if (sel && el.matches(sel)) rules.push({ s: spec(sel), i: rules.length, v: d[1].trim() });
    } else media.pop();
  }
  rules.sort((a, b) => a.s - b.s || a.i - b.i);
  const v = rules.at(-1)?.v || '';
  // a custom property from the element's style, else the var()'s fallback
  const prop = (name) =>
    new RegExp(`${name}:(\\d+)`).exec(el.getAttribute('style') || '')?.[1] ??
    new RegExp(`var\\(${name}, (\\d+)\\)`).exec(v)?.[1];
  const mc = /--list-mcols/.test(v)
    ? prop('--list-mcols')
    : /--list-cols/.test(v)
      ? prop('--list-cols')
      : /repeat\((\d+)/.exec(v)?.[1];
  return Number(mc);
}

test('at a phone (390): a 3-column List shows 1 column, phoneColumns 2 shows 2 (beats the tablet rule)', () => {
  const three = list({}).el.querySelector('.list__items');
  assert.equal(columnsAt(three, 1440), 3);
  assert.equal(columnsAt(three, 800), 2);
  assert.equal(columnsAt(three, 390), 1);
  const two = list({ phoneColumns: '2' }).el.querySelector('.list__items');
  assert.equal(columnsAt(two, 390), 2);
  assert.equal(columnsAt(list({ phoneColumns: '3' }).el.querySelector('.list__items'), 390), 3);
});
