// F39: Show only on a List from a source (config.showOnly { field, value }): only the items whose
// field has that value, compared as text. The fixture is a copy of Unic Derma's behandelingen
// source (category: uitstraling / gezichtsbehandeling / laserontharing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { warnings } from '../scripts/test-layout.mjs';
import { loadContent } from '../src/cli/content.mjs';
import { buildRoutes } from '../src/render/routes.js';
import { newWidget, newSection, renderSections } from '../src/render/layout/index.js';
import { widgetItems } from '../src/render/layout/source.js';
import { WIDGET_TYPES } from '../src/render/widgets/index.js';
import { checkContent } from '../src/render/validate.js';
import {
  showOnlyFields,
  showOnlyItems,
  showOnlyOf,
  showOnlyProblem,
  showOnlyValues,
} from '../src/render/widgets/list/show-only.js';
import { SITE_A } from './fixtures/index.mjs';

const json = (f) => JSON.parse(readFileSync(new URL(`./fixtures/show-only/${f}`, import.meta.url)));
const { items } = json('behandelingen.json');
const schema = json('behandelingen.schema.json');
const base = loadContent(SITE_A);
const content = {
  ...base,
  sources: { ...base.sources, behandelingen: items },
  schemas: { ...base.schemas, behandelingen: schema },
};
const from = { mode: 'all', from: 'behandelingen' };
const listWidget = (config = {}, source = from) => ({
  id: 'w-so01',
  type: 'list',
  source,
  config: { template: 'preset:plain', ...config },
});
const shownBy = (config, source) =>
  widgetItems(content, null, listWidget(config, source), WIDGET_TYPES.list).items;
const byCategory = (c) => items.filter((it) => it.category === c);

test('F39: Show only uitstraling: the 9 uitstraling items, in the source order', () => {
  const got = shownBy({ showOnly: { field: 'category', value: 'uitstraling' } });
  assert.equal(got.length, 9);
  assert.deepEqual(got, byCategory('uitstraling'));
  for (const c of ['gezichtsbehandeling', 'laserontharing'])
    assert.deepEqual(shownBy({ showOnly: { field: 'category', value: c } }), byCategory(c));
});

test('F39: without Show only (or half filled in) a List shows every item, as before', () => {
  assert.equal(shownBy({}).length, items.length);
  assert.equal(shownBy({ showOnly: { field: 'category' } }).length, items.length);
  assert.equal(shownBy({ showOnly: { field: '', value: 'x' } }).length, items.length);
  // Item mode: the one item, Show only or not
  const one = { mode: 'item', from: 'behandelingen', id: items[0].id };
  assert.deepEqual(shownBy({ showOnly: { field: 'category', value: 'laserontharing' } }, one), [
    items[0],
  ]);
  // a value no item has: none (the List's empty state)
  assert.deepEqual(shownBy({ showOnly: { field: 'category', value: 'nope' } }), []);
});

test('F39: values compared as text: a number field matches its picked text', () => {
  const price = String(items[0].price);
  const want = items.filter((it) => String(it.price) === price);
  assert.deepEqual(shownBy({ showOnly: { field: 'price', value: price } }), want);
  assert.deepEqual(shownBy({ showOnly: { field: 'price', value: Number(price) } }), want);
  assert.deepEqual(showOnlyOf(listWidget({ showOnly: { field: 'price', value: 13 } })), {
    field: 'price',
    value: '13',
  });
  // a list value: one of its values
  assert.deepEqual(
    showOnlyItems([{ tags: ['a', 'b'] }, { tags: ['c'] }, {}], { field: 'tags', value: 'b' }),
    [{ tags: ['a', 'b'] }],
  );
});

test('F39: the build renders only the shown items', () => {
  const { routes } = buildRoutes(content);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = { ...newWidget('list', ids), ...listWidget() };
  const render = (config) => {
    const widget = { ...w, config: { ...w.config, ...config } };
    const ctx = { ...content, route: page, routes, curtains: {} };
    const [html] = warnings(() =>
      renderSections(ctx, page, 'pages/test/index.json', [newSection(ids, [widget])]),
    );
    const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
    return document.querySelectorAll('[data-list-item]').length;
  };
  assert.equal(render({}), 36);
  assert.equal(render({ showOnly: { field: 'category', value: 'gezichtsbehandeling' } }), 13);
});

test('F39: fields from the schema (pickable kinds), else from the items; values to pick', () => {
  assert.deepEqual(
    showOnlyFields(schema, items).map((f) => f.key),
    ['name', 'duration', 'price', 'category'], // not the long Note
  );
  assert.deepEqual(showOnlyFields(null, [{ id: 'p-a', kind: 'x', n: 2, photo: { src: 'a' } }]), [
    { key: 'kind', label: 'kind' },
    { key: 'n', label: 'n' },
  ]);
  // a choice: its options first, in their order
  assert.deepEqual(showOnlyValues(schema, items, 'category'), [
    'uitstraling',
    'gezichtsbehandeling',
    'laserontharing',
  ]);
  const durations = showOnlyValues(schema, items, 'duration');
  assert.ok(durations.includes('15 Minuten'));
  assert.equal(new Set(durations).size, durations.length);
  assert.ok(!durations.includes(''));
});

test('F39: config.showOnly checked: one field and one value', () => {
  assert.equal(showOnlyProblem(undefined), null);
  assert.equal(showOnlyProblem({ field: 'category', value: 'uitstraling' }), null);
  assert.equal(showOnlyProblem({ field: 'category' }), null);
  assert.match(showOnlyProblem('category'), /must be \{/);
  assert.match(showOnlyProblem({ field: 'a', value: 'b', or: {} }), /has no "or"/);
  assert.match(showOnlyProblem({ field: 'a', value: { x: 1 } }), /text, number or true/);
  const page = (config) => ({
    version: 1,
    kind: 'page',
    id: 'pg-t039',
    sections: [{ id: 's-t039', widgets: [listWidget(config)] }],
  });
  assert.deepEqual(
    checkContent('pages/x/index.json', page({ showOnly: { field: 'category', value: 'x' } })),
    [],
  );
  assert.match(
    checkContent('pages/x/index.json', page({ showOnly: { field: 1 } })).join(),
    /showOnly\.field/,
  );
});

test('F39: the editor: one Show only row under Source, with an (i), never named filter', () => {
  const lead = readFileSync(
    new URL('../src/editor/svelte/ListLead.svelte', import.meta.url),
    'utf8',
  );
  assert.match(lead, /Show only items where<InfoHelp label="About Show only"/);
  assert.match(lead, /aria-label="Show only: field"/);
  assert.match(lead, /aria-label="Show only: value"/);
  assert.match(
    lead,
    /const showOnlyOn = \$derived\(!custom && !!listSource && listSource\.mode !== 'item'\)/,
  );
  const mod = readFileSync(
    new URL('../src/render/widgets/list/show-only.js', import.meta.url),
    'utf8',
  );
  for (const src of [lead, mod]) assert.doesNotMatch(src, /\bfilter[A-Z]\w*|\bFilter\b/);
});
