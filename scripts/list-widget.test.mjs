// The List widget (step 3): one copy of its item template per source item, each filled from its
// own item; the four presets' shapes; the empty state; the missing-value rule (Hide / Show empty)
// with its build warning; {items}; the arrangements; its Layout tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { warnings } from './test-layout.mjs';
import { loadContent } from './content.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { setEditable } from '../src/site/helpers.js';
import { newWidget, newSection, renderSections } from '../src/site/layout/index.js';
import { bindingProblems } from '../src/site/layout/bindings.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import { checkContent } from '../src/site/validate.js';
import { PRESETS } from '../src/site/widgets/list/presets.js';
import { layoutOptions, layoutParts } from '../src/editor/widget-layout.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const base = loadContent(SITE_A);
const F = 'pages/test/index.json';
let n = 0;

/** A List (config over its defaults) rendered on /about/ of `content`: its root element. */
function list(config = {}, more = {}, content = base) {
  const { routes } = buildRoutes(content);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = { ...w, id: `w-ls${String(++n).padStart(3, '0')}`, ...more };
  widget.config = { ...w.config, ...config };
  const ctx = { ...content, route: page, routes, curtains: {} };
  const [html, seen] = warnings(() => renderSections(ctx, page, F, [newSection(ids, [widget])]));
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return { el: document.querySelector('.wgt--list'), html, seen, widget };
}
const texts = (root, sel) => [...root.querySelectorAll(sel)].map((e) => e.textContent.trim());
const people = base.sources.people;

test('N items: N item roots, each with its own item’s values, in order', () => {
  const { el } = list();
  const items = el.querySelectorAll('[data-list-item]');
  assert.equal(items.length, people.length);
  assert.deepEqual(
    texts(el, '[data-list-item] .li__title'),
    people.map((p) => p.title),
  );
  // each copy links to its own item's page
  const hrefs = [...items].map((a) => a.getAttribute('href'));
  assert.equal(new Set(hrefs).size, people.length);
  // From URL / a filtered source: only the items it shows
  const one = list({}, { source: { mode: 'item', from: 'people', id: people[1].id } });
  assert.ok(one.el.querySelectorAll('[data-list-item]').length >= 1);
});

test('each preset renders its own shape', () => {
  const shape = (p) => {
    const { el } = list({ template: p });
    return { el, first: el.querySelector('[data-list-item]') };
  };
  assert.deepEqual(
    PRESETS.map(([id, label]) => [id, label]),
    [
      ['preset:card', 'Card'],
      ['preset:plain', 'Plain'],
      ['preset:panel', 'Panel'],
      ['preset:row', 'Row'],
    ],
  );
  // Card: a link, photo on top, then title and facts (the source's list properties)
  const card = shape('preset:card').first;
  assert.equal(card.tagName, 'A');
  assert.ok(card.classList.contains('li--card'));
  assert.equal(card.firstElementChild.className, 'li__w li__photo');
  assert.deepEqual(
    [...card.querySelector('.li__text').children].map((c) => c.className),
    ['li__w li__title', 'li__w li__facts'],
  );
  assert.ok(card.querySelector('.li__photo img'));
  const p0 = people[0];
  assert.equal(card.querySelector('.li__facts').textContent.trim(), `${p0.role} · ${p0.location}`);
  // Plain: no link around it; photo, title, body, and a button to the item's page
  const plain = shape('preset:plain').first;
  assert.equal(plain.tagName, 'DIV');
  assert.deepEqual(
    [...plain.querySelector('.li__text').children].map((c) => c.className),
    ['li__w li__title', 'li__w li__body', 'li__w li__button'],
  );
  assert.equal(
    plain.querySelector('.li__button a').getAttribute('href'),
    card.getAttribute('href'),
  );
  assert.equal(plain.querySelector('.li__body').textContent.trim(), p0.body);
  // Panel: photo, title and its photo count over it
  const panel = shape('preset:panel').first;
  assert.ok(panel.classList.contains('li--panel'));
  assert.equal(panel.querySelector('.li__count').textContent.trim(), String(p0.photos.length));
  // Row: photo, title and facts (the photo left: style.scss)
  const row = shape('preset:row').first;
  assert.ok(row.classList.contains('li--row'));
  assert.ok(row.querySelector('.li__photo img') && row.querySelector('.li__facts'));
});

test('an empty source: the List’s empty state, not nothing', () => {
  const content = { ...base, sources: { ...base.sources, people: [] } };
  const { el } = list({}, {}, content);
  assert.equal(el.querySelectorAll('[data-list-item]').length, 0);
  assert.equal(el.querySelector('[data-list-empty]').textContent, 'Nothing here yet.');
  // no source (None) too
  const none = list({}, { source: undefined });
  assert.ok(none.el.querySelector('[data-list-empty]'));
});

test('a missing value: Hide leaves its widget out and warns; Show empty keeps it', () => {
  const sources = {
    ...base.sources,
    people: people.map((p, i) => (i === 0 ? { ...p, role: '', location: undefined } : p)),
  };
  const content = { ...base, sources };
  const hide = list({ missing: 'hide' }, {}, content);
  const [first, second] = hide.el.querySelectorAll('[data-list-item]');
  assert.equal(first.querySelector('.li__facts'), null); // every part empty: left out
  assert.ok(first.querySelector('.li__title')); // the rest shows
  assert.ok(second.querySelector('.li__facts'));
  assert.ok(
    hide.seen.some((w) =>
      /List w-ls\d+: 1 of \d+ items have no \{role\}: its widget is hidden there/.test(w),
    ),
    hide.seen.join('\n'),
  );
  const show = list({ missing: 'show' }, {}, content);
  const kept = show.el.querySelector('[data-list-item] .li__facts');
  assert.ok(kept);
  assert.equal(kept.textContent.trim(), '');
  // the editor: there but dimmed, "No value for …"
  setEditable(true);
  try {
    const ed = list({ missing: 'hide' }, {}, content);
    const dim = ed.el.querySelector('[data-list-item] .li__facts');
    assert.equal(dim.getAttribute('data-no-value'), 'No value for {role}, {location}');
  } finally {
    setEditable(false);
  }
});

test('{items}: the List’s own items, how many; an item property of that name wins', () => {
  const heading = [{ t: 'People ' }, { property: 'items' }];
  const { el } = list({}, { heading });
  assert.equal(el.querySelector('.list__head h2').textContent, `People ${people.length}`);
  // filtered: the items it shows, not the whole source
  const one = list({}, { heading, source: { mode: 'item', from: 'people', id: people[0].id } });
  const shown = one.el.querySelectorAll('[data-list-item]').length;
  assert.equal(one.el.querySelector('.list__head h2').textContent, `People ${shown}`);
  // known to the checks on a list widget only
  const page = (widget) => ({
    pages: { 'pg-li01': { id: 'pg-li01', sections: [{ widgets: [widget] }] } },
  });
  const content = { ...base, pages: {} };
  const listW = { id: 'w-li01', type: 'list', heading, source: { mode: 'all', from: 'people' } };
  assert.deepEqual(bindingProblems({ ...content, ...page(listW) }, { types: WIDGET_TYPES }), []);
  const btn = {
    id: 'w-li02',
    type: 'button',
    label: heading,
    source: { mode: 'all', from: 'people' },
  };
  assert.match(
    bindingProblems({ ...content, ...page(btn) }, { types: WIDGET_TYPES })[0].message,
    /people has no property "items"/,
  );
});

test('Grid and Rows; columns and gap; See all', () => {
  const grid = list(
    { arrangement: 'grid', columns: '4', gap: 'l', seeAll: true },
    { heading: 'P' },
  );
  const items = grid.el.querySelector('.list__items');
  assert.ok(items.classList.contains('list__items--grid'));
  assert.equal(items.getAttribute('data-cols'), '4');
  assert.ok(grid.el.querySelector('.list').classList.contains('list--gap-l'));
  assert.ok(grid.el.querySelector('.list__head .section__cta[href]'));
  const rows = list({ arrangement: 'rows' });
  assert.ok(rows.el.querySelector('.list__items').classList.contains('list__items--rows'));
  // no heading: no head
  assert.equal(rows.el.querySelector('.list__head'), null);
  // its defaults are valid content
  const ids = new Set();
  const w = newWidget('list', ids);
  const page = { version: 1, kind: 'page', id: 'pg-li02', sections: [newSection(ids, [w])] };
  assert.deepEqual(checkContent('pages/x/index.json', page), []);
  assert.match(
    checkContent('pages/x/index.json', {
      ...page,
      sections: [newSection(ids, [{ ...w, config: { ...w.config, arrangement: 'carousel' } }])],
    }).join('; '),
    /config\.arrangement.*one of grid, rows/,
  );
});

test('the pop-up: Arrangement, Columns, Gap in Layout; the rest in Content', () => {
  assert.deepEqual(
    layoutOptions('list').map((c) => c.key),
    ['arrangement', 'columns', 'gap'],
  );
  assert.deepEqual(layoutParts('list'), ['options', 'size', 'layer', 'link']);
  const content = WIDGET_TYPES.list.config.filter((c) => c.tab !== 'layout').map((c) => c.key);
  assert.deepEqual(content, ['template', 'seeAll', 'missing']);
  // other types: no options row
  assert.ok(!layoutParts('grid').includes('options'));
});
