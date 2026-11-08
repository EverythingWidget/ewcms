// A List's phone columns (config.phoneColumns: the Columns row per layout, the editor's phone view).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
