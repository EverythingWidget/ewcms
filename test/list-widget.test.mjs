// The List widget (step 3): one copy of its item template per source item, each filled from its
// own item; the four presets' shapes; the empty state; the missing-value rule (Hide / Show empty)
// with its build warning; {items}; the arrangements; its Layout tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { warnings } from '../scripts/test-layout.mjs';
import { loadContent } from '../src/cli/content.mjs';
import { buildRoutes } from '../src/render/routes.js';
import { setEditable } from '../src/render/helpers.js';
import { newWidget, newSection, renderSections } from '../src/render/layout/index.js';
import { bindingProblems } from '../src/render/layout/bindings.js';
import { WIDGET_TYPES } from '../src/render/widgets/index.js';
import { checkContent, contentWarnings } from '../src/render/validate.js';
import { CORE_STRINGS } from '../src/render/strings.js';
import { PRESETS, factsRuns, namesOf } from '../src/render/widgets/list/presets.js';
import { nextItemIndex } from '../src/render/widgets/list/client.js';
import { resolveCustomItem } from '../src/render/widgets/list/custom.js';
import { widgetItems } from '../src/render/layout/source.js';
import { countGroups, THIS_LIST } from '../src/editor/property-groups.js';
import { layoutOptions, layoutParts, MISSING_OPTIONS } from '../src/editor/widget-layout.js';
import { hideMissing } from '../src/render/layout/missing.js';
import { onGrid, template } from '../scripts/grid-helper.mjs';
import { SITE_A, withPhoto } from './fixtures/index.mjs';

const base = loadContent(SITE_A);
// the fixtures' people name their photo "cover": the List tests use them with a "photo" too
const shown = withPhoto(base);
const F = 'pages/test/index.json';
let n = 0;

/** A List (config over its defaults) rendered on /about/ of `content`: its root element. */
function list(config = {}, more = {}, content = shown, extraCtx = {}) {
  const { routes } = buildRoutes(content);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = { ...w, id: `w-ls${String(++n).padStart(3, '0')}`, ...more };
  widget.config = { ...w.config, ...config };
  const ctx = { ...content, route: page, routes, curtains: {}, ...extraCtx };
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
    PRESETS.map((p) => [p.id, p.label]),
    [
      ['preset:card', 'Card'],
      ['preset:plain', 'Plain'],
      ['preset:panel', 'Panel'],
      ['preset:row', 'Row'],
      ['preset:photo', 'Photo'],
    ],
  );
  // Photo: a photo only, no link, no text
  const photo = shape('preset:photo').first;
  assert.equal(photo.tagName, 'DIV');
  assert.ok(photo.querySelector('.li__photo img'));
  assert.equal(photo.querySelectorAll('.ts').length, 0);
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

test('{items}: the List’s own items, how many, in its item template; not a Button’s', () => {
  const tpl = template({
    name: 'Count',
    widgets: onGrid([
      {
        type: 'text',
        role: 'title',
        body: [{ style: 'label', text: [{ t: 'People ' }, { property: 'items' }] }],
      },
    ]),
  });
  const content = { ...shown, templates: { ...shown.templates, 't-cnt1': tpl } };
  const { el } = list({ template: 't-cnt1' }, {}, content);
  const all = texts(el, '[data-list-item]');
  assert.equal(all.length, people.length);
  assert.ok(
    all.every((x) => x === `People ${people.length}`),
    all.join(),
  );
  // filtered: the items it shows, not the whole source
  const one = list(
    { template: 't-cnt1' },
    { source: { mode: 'item', from: 'people', id: people[0].id } },
    content,
  );
  const n = one.el.querySelectorAll('[data-list-item]').length;
  assert.deepEqual(new Set(texts(one.el, '[data-list-item]')), new Set([`People ${n}`]));
  // known to the checks on a list widget only: a Button's label has no {items}
  const page = (widget) => ({
    pages: { 'pg-li01': { id: 'pg-li01', sections: [{ widgets: [widget] }] } },
  });
  const btn = {
    id: 'w-li02',
    type: 'button',
    label: [{ t: 'People ' }, { property: 'items' }],
    source: { mode: 'all', from: 'people' },
  };
  assert.match(
    bindingProblems({ ...base, pages: {}, ...page(btn) }, { types: WIDGET_TYPES })[0].message,
    /people has no property "items"/,
  );
});

test('Grid; columns and gap; Row preset defaults to 1 column', () => {
  const grid = list({ arrangement: 'grid', columns: '4', gap: 3 });
  const items = grid.el.querySelector('.list__items');
  assert.ok(items.classList.contains('list__items--grid'));
  assert.equal(items.getAttribute('data-cols'), '4');
  // the gap: a whole number of the page's cells (--list-gap; the CSS: calc(n * var(--cell)))
  assert.match(items.getAttribute('style'), /--list-gap:3(;|$)/);
  assert.ok(![...grid.el.querySelector('.list').classList].some((c) => c.startsWith('list--gap')));
  const flush = list({ columns: '4' }).el.querySelector('.list__items');
  assert.doesNotMatch(flush.getAttribute('style'), /--list-gap/); // 0, the default: side by side
  const gw = { ...newWidget('list', new Set()), id: 'w-gap1' };
  const check = (gap) => WIDGET_TYPES.list.check({ ...gw, config: { ...gw.config, gap } }).join();
  assert.equal(check(0), '');
  assert.equal(check(6), '');
  for (const bad of ['m', 's', 1.5, -1, 25])
    assert.match(check(bad), /config\.gap must be a whole number of cells/, String(bad));
  assert.equal(gw.config.gap, undefined, 'a new List: no gap (0)');
  const css = readFileSync(
    new URL('../src/render/widgets/list/style.scss', import.meta.url),
    'utf8',
  );
  assert.match(css, /--list-gap-px: calc\(var\(--list-gap, 0\) \* var\(--cell, 0px\)\);/);
  assert.match(css, /gap: var\(--list-gap-px\);/);
  // fewer columns when one would be narrower than an item can use (F106)
  assert.match(
    css,
    /repeat\(\s*auto-fill,\s*minmax\(\s*max\(\s*min\(100%, var\(--list-item-min, 240px\)\)/,
  );
  assert.doesNotMatch(css, /--gap-[sml]|list--gap/);
  // Row preset's default columns when columns is omitted
  assert.equal(
    list({ template: 'preset:row', columns: undefined })
      .el.querySelector('.list__items')
      .getAttribute('data-cols'),
    '1',
  );
  assert.equal(PRESETS.find((p) => p.id === 'preset:row').columns, '1');
  assert.equal(PRESETS.find((p) => p.id === 'preset:card').columns, '3');
  // its defaults are valid content
  const ids = new Set();
  const w = newWidget('list', ids);
  const page = { version: 1, kind: 'page', id: 'pg-li02', sections: [newSection(ids, [w])] };
  assert.deepEqual(checkContent('pages/x/index.json', page), []);
  assert.match(
    checkContent('pages/x/index.json', {
      ...page,
      sections: [newSection(ids, [{ ...w, config: { ...w.config, arrangement: 'spinner' } }])],
    }).join('; '),
    /config\.arrangement.*(one of grid|"grid" or "carousel")/,
  );
});

test('the pop-up: Arrangement, Columns, Gap in Layout; Content has Preset and When a value is missing', () => {
  assert.deepEqual(
    layoutOptions('list').map((c) => c.key),
    [
      'arrangement',
      'columns',
      'gap',
      'counter',
      'thumbnails',
      'arrows',
      'credit',
      'slideRatio',
      'alsoGrid',
      'deepLink',
    ],
  );
  assert.deepEqual(layoutParts('list'), ['size', 'layer', 'link', 'options']);
  assert.ok(!layoutParts('button').includes('missing'));
  assert.ok(!layoutParts('button').includes('options'));
  assert.deepEqual(MISSING_OPTIONS, [
    ['hide', 'Hide'],
    ['show', 'Show empty'],
  ]);
  const content = WIDGET_TYPES.list.config.filter((c) => c.tab !== 'layout').map((c) => c.key);
  assert.deepEqual(
    content.filter((k) => k !== 'custom' && k !== 'items'),
    ['template'],
  );
  assert.ok(content.includes('custom'));
  assert.ok(content.includes('items'));
  assert.equal(WIDGET_TYPES.list.customItems, true);
  // Arrangement: Grid or Carousel
  assert.equal(WIDGET_TYPES.list.config.find((c) => c.key === 'arrangement').type, 'seg');
  assert.deepEqual(WIDGET_TYPES.list.config.find((c) => c.key === 'arrangement').options, [
    ['grid', 'Grid'],
    ['carousel', 'Carousel'],
  ]);
  // other types: no options row
  assert.ok(!layoutParts('hero').includes('options'));
  // Content tab (GroupFields): When a value is missing on every widget
  const gf = readFileSync(
    new URL('../src/editor/svelte/GroupFields.svelte', import.meta.url),
    'utf8',
  );
  assert.match(gf, /When a value is missing/);
  assert.match(gf, /MISSING_OPTIONS/);
  assert.match(gf, /config\/missing/);
  const wl = readFileSync(
    new URL('../src/editor/svelte/WidgetLayout.svelte', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(wl, /When a value is missing/);
});

// step 3b (review of 12740ba)

test('one hide rule: the page grid and a List item share it; its hint is strings.js widget.noValue', () => {
  const sources = {
    ...base.sources,
    people: people.map((p, i) => (i === 0 ? { ...p, role: '', location: undefined } : p)),
  };
  const content = { ...base, sources };
  const strings = { widget: { noValue: 'Geen waarde: {names}' } };
  setEditable(true);
  try {
    // a List's item widget
    const ed = list({ missing: 'hide' }, {}, content, { strings });
    const dim = ed.el.querySelector('[data-list-item] .li__facts');
    assert.equal(dim.getAttribute('data-no-value'), 'Geen waarde: {role}, {location}');
    assert.equal(dim.getAttribute('data-missing-tag'), 'Hidden on the page');
    // a widget on the page grid, the same rule and text
    const { routes } = buildRoutes(content);
    const page = routes.find((r) => r.path === '/about/');
    const ids = new Set();
    const btn = {
      ...newWidget('button', ids),
      id: 'w-lsb01',
      label: [{ property: 'role' }],
      source: { mode: 'item', from: 'people', id: people[0].id },
    };
    const ctx = { ...content, route: page, routes, curtains: {}, strings };
    const html = renderSections(ctx, page, F, [newSection(ids, [btn])]);
    assert.match(html, /data-widget="w-lsb01"[^>]*data-no-value="Geen waarde: \{role\}"/);
    // the default English text
    const en = list({ missing: 'hide' }, {}, content);
    assert.equal(
      en.el.querySelector('[data-list-item] .li__facts').getAttribute('data-no-value'),
      'No value for {role}, {location}',
    );
  } finally {
    setEditable(false);
  }
});

test('presets are data: link and photoFirst on the entry decide the item', () => {
  const plain = PRESETS.find((p) => p.id === 'preset:plain');
  const card = PRESETS.find((p) => p.id === 'preset:card');
  assert.equal(plain.link, false);
  assert.equal(card.photoFirst, true);
  try {
    plain.link = true; // Plain as a link: the entry decides, not its name
    assert.equal(
      list({ template: 'preset:plain' }).el.querySelector('[data-list-item]').tagName,
      'A',
    );
    card.photoFirst = false; // the photo inside the text stack
    const first = list({ template: 'preset:card' }).el.querySelector('[data-list-item]');
    assert.equal(first.firstElementChild.className, 'li__text');
    assert.ok(first.querySelector('.li__text > .li__photo'));
  } finally {
    plain.link = false;
    card.photoFirst = true;
  }
  assert.equal(
    list({ template: 'preset:plain' }).el.querySelector('[data-list-item]').tagName,
    'DIV',
  );
});

test('facts are joined by the separator: a missing first or middle fact leaves no stray " · "', () => {
  const p0 = people[0];
  const facts = (item) => {
    const sources = { ...base.sources, people: [item, ...people.slice(1)] };
    return list({}, {}, { ...base, sources })
      .el.querySelector('[data-list-item] .li__facts')
      ?.textContent.trim();
  };
  assert.equal(facts({ ...p0, role: '' }), p0.location);
  assert.equal(facts({ ...p0, location: null }), p0.role);
  assert.equal(facts(p0), `${p0.role} · ${p0.location}`);
  // the runs themselves: separators only between values
  const empty = (part) => part.property === 'b';
  assert.deepEqual(factsRuns(['a', 'b', 'c'], empty), [
    { property: 'a' },
    { t: ' · ' },
    { property: 'c' },
  ]);
  assert.deepEqual(
    factsRuns(['a', 'b'], () => true),
    [{ property: 'a' }, { property: 'b' }],
  );
});

test('{items} is offered under Count of this List, only on a List', () => {
  assert.equal(THIS_LIST, 'Count of this List');
  const groups = (o) => countGroups(o).map((g) => [g.group, g.options.map((x) => x.value)]);
  assert.deepEqual(groups({ lists: ['people'], listItems: 4, prefix: 'p:' }), [
    [THIS_LIST, ['p:items']],
    ['Count of a source', ['p:people']],
  ]);
  assert.equal(countGroups({ listItems: 1 })[0].options[0].hint, '1 item it shows');
  assert.deepEqual(groups({ lists: ['people'], listItems: null }), [
    ['Count of a source', ['people']],
  ]);
  assert.deepEqual(groups({}), []);
});

// step 3c

test('Arrangement Rows is rejected: write columns 1', () => {
  const ids = new Set();
  const w = newWidget('list', ids);
  const page = { version: 1, kind: 'page', id: 'pg-li03', sections: [newSection(ids, [w])] };
  const msg = checkContent('pages/x/index.json', {
    ...page,
    sections: [newSection(ids, [{ ...w, config: { ...w.config, arrangement: 'rows' } }])],
  }).join('; ');
  assert.match(msg, /config\.arrangement "rows" is gone/);
  assert.match(msg, /columns": "1"/);
  assert.doesNotMatch(msg, /one of grid, rows/);
});

test('arrow keys move between items in a multi-column grid', () => {
  // 6 items, 3 columns: Down from 0 -> 3; Right from 0 -> 1; Up from 3 -> 0; End -> 5
  assert.equal(nextItemIndex(0, 'ArrowDown', 3, 6), 3);
  assert.equal(nextItemIndex(0, 'ArrowRight', 3, 6), 1);
  assert.equal(nextItemIndex(3, 'ArrowUp', 3, 6), 0);
  assert.equal(nextItemIndex(1, 'ArrowLeft', 3, 6), 0);
  assert.equal(nextItemIndex(2, 'Home', 3, 6), 0);
  assert.equal(nextItemIndex(0, 'End', 3, 6), 5);
  // 1 column: Down is +1 (same as Right)
  assert.equal(nextItemIndex(0, 'ArrowDown', 1, 4), 1);
  assert.equal(nextItemIndex(3, 'ArrowDown', 1, 4), null);
  // past the end: ignored
  assert.equal(nextItemIndex(4, 'ArrowDown', 3, 6), null);
  assert.equal(nextItemIndex(1, 'ArrowUp', 3, 6), null);
});

test('widget-level missing option: a page widget Hide / Show empty; tags in the editor', () => {
  const sources = {
    ...base.sources,
    people: people.map((p, i) => (i === 0 ? { ...p, role: '' } : p)),
  };
  const content = { ...base, sources };
  const { routes } = buildRoutes(content);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const btn = (missing) => ({
    ...newWidget('button', ids),
    id: `w-ms${missing || 'def'}`,
    label: [{ property: 'role' }],
    source: { mode: 'item', from: 'people', id: people[0].id },
    config: { ...(missing ? { missing } : {}) },
  });
  assert.ok(hideMissing(undefined) && hideMissing({}) && hideMissing({ missing: 'hide' }));
  assert.equal(hideMissing({ missing: 'show' }), false);
  // published: Hide (default) leaves it out
  let html = renderSections({ ...content, route: page, routes, curtains: {} }, page, F, [
    newSection(ids, [btn()]),
  ]);
  assert.ok(!html.includes('wgt--button'), html);
  // Show empty: it stays (empty label)
  html = renderSections({ ...content, route: page, routes, curtains: {} }, page, F, [
    newSection(ids, [btn('show')]),
  ]);
  assert.ok(html.includes('wgt--button'), html);
  // editor: tags differ
  setEditable(true);
  try {
    const hideHtml = renderSections({ ...content, route: page, routes, curtains: {} }, page, F, [
      newSection(ids, [btn('hide')]),
    ]);
    assert.match(hideHtml, /data-missing-tag="Hidden on the page"/);
    assert.match(hideHtml, /data-no-value="No value for \{role\}"/);
    const showHtml = renderSections({ ...content, route: page, routes, curtains: {} }, page, F, [
      newSection(ids, [btn('show')]),
    ]);
    assert.match(showHtml, /data-missing-tag="Empty on the page"/);
  } finally {
    setEditable(false);
  }
});

test("a List's missing choice: item widgets inherit it unless they set their own", () => {
  const sources = {
    ...base.sources,
    people: people.map((p, i) => (i === 0 ? { ...p, role: '', location: undefined } : p)),
  };
  const content = { ...base, sources };
  // List Show empty: the first item's facts stay (other items still have values)
  const show = list({ missing: 'show' }, {}, content);
  assert.ok(show.el.querySelectorAll('[data-list-item]')[0].querySelector('.li__facts'));
  // List Hide: the first item's facts are left out
  const hide = list({ missing: 'hide' }, {}, content);
  assert.equal(hide.el.querySelectorAll('[data-list-item]')[0].querySelector('.li__facts'), null);
  // editor tags follow the List's choice
  setEditable(true);
  try {
    const edHide = list({ missing: 'hide' }, {}, content);
    assert.equal(
      edHide.el
        .querySelectorAll('[data-list-item]')[0]
        .querySelector('.li__facts')
        .getAttribute('data-missing-tag'),
      'Hidden on the page',
    );
    const edShow = list({ missing: 'show' }, {}, content);
    assert.equal(
      edShow.el
        .querySelectorAll('[data-list-item]')[0]
        .querySelector('.li__facts')
        .getAttribute('data-missing-tag'),
      'Empty on the page',
    );
  } finally {
    setEditable(false);
  }
});

// step 4: custom items

test('custom Panel like Photography: titles, counts, units, source covers, source page links', () => {
  const { el } = list(
    {
      custom: true,
      template: 'preset:panel',
      columns: '2',
      items: [
        { title: 'People', photo: people[0].cover, source: 'people', unit: 'models' },
        { title: 'Places', photo: base.sources.places[0].cover, source: 'places', unit: 'places' },
      ],
    },
    { source: undefined },
  );
  const items = [...el.querySelectorAll('[data-list-item]')];
  assert.equal(items.length, 2);
  assert.deepEqual(texts(el, '[data-list-item] .li__title'), ['People', 'Places']);
  // counts from source lengths (two digits, as Photo panels showed them) + units
  const counts = texts(el, '[data-list-item] .li__count');
  const two = (n) => String(n).padStart(2, '0');
  assert.equal(counts[0], `${two(people.length)} models`);
  assert.equal(counts[1], `${two(base.sources.places.length)} places`);
  // links to those source pages
  assert.ok(items[0].getAttribute('href')?.includes('people'));
  assert.ok(items[1].getAttribute('href')?.includes('places'));
  // photos: each item's own (no cover taken from the source's items)
  assert.ok(items[0].querySelector('.li__photo img, .li__photo picture, img'));
  assert.ok(items[1].querySelector('.li__photo img, .li__photo picture, img'));
});

test('custom: own photo and link win over the pointed source', () => {
  const { el } = list(
    {
      custom: true,
      template: 'preset:panel',
      items: [
        {
          title: 'Custom',
          source: 'people',
          unit: 'models',
          photo: 'people/noor-vermeer/01.jpg',
          link: { href: 'https://example.com/x' },
        },
      ],
    },
    { source: undefined },
  );
  const a = el.querySelector('[data-list-item]');
  assert.equal(a.getAttribute('href'), 'https://example.com/x');
  const img = a.querySelector('img');
  assert.ok(img?.getAttribute('src')?.includes('noor-vermeer') || img?.getAttribute('srcset'));
});

test('custom: empty has no count', () => {
  // no pointed source: title only, no count overlay
  const bare = list(
    { custom: true, template: 'preset:panel', items: [{ title: 'Solo' }] },
    { source: undefined },
  );
  assert.equal(bare.el.querySelector('[data-list-item] .li__count'), null);
  assert.equal(bare.el.querySelector('[data-list-item] .li__title')?.textContent.trim(), 'Solo');
});

test('source-mode Panel still works; reorder of hand items keeps values', () => {
  // source Panel unchanged
  const { el: src } = list({ template: 'preset:panel' });
  assert.ok(src.querySelectorAll('[data-list-item]').length >= 1);
  assert.ok(src.querySelector('[data-list-item] .li__count'));
  // reorder: render with swapped config.items
  const a = list(
    {
      custom: true,
      template: 'preset:card',
      items: [
        { title: 'A', source: 'people' },
        { title: 'B', source: 'places' },
      ],
    },
    { source: undefined },
  );
  const b = list(
    {
      custom: true,
      template: 'preset:card',
      items: [
        { title: 'B', source: 'places' },
        { title: 'A', source: 'people' },
      ],
    },
    { source: undefined },
  );
  assert.deepEqual(texts(a.el, '[data-list-item] .li__title'), ['A', 'B']);
  assert.deepEqual(texts(b.el, '[data-list-item] .li__title'), ['B', 'A']);
});

test('custom validation; mode switch keeps unused data (shape allows both)', () => {
  const ids = new Set();
  const w = {
    ...newWidget('list', ids),
    id: 'w-hand1',
    source: { mode: 'all', from: 'people' },
    config: {
      ...newWidget('list', new Set()).config,
      custom: true,
      items: [
        { title: 'People', source: 'people', unit: 'models' },
        { title: 'Places', source: 'places', unit: 'places' },
      ],
    },
  };
  const page = { version: 1, kind: 'page', id: 'pg-hand', sections: [newSection(ids, [w])] };
  assert.deepEqual(checkContent('pages/x/index.json', page), []);
  // both source and items present (switching back would use them)
  assert.equal(w.source.from, 'people');
  assert.equal(w.config.items.length, 2);
  // bad item
  const bad = {
    ...page,
    sections: [
      newSection(ids, [
        {
          ...w,
          id: 'w-hand2',
          config: { ...w.config, items: [{ title: 1 }] },
        },
      ]),
    ],
  };
  assert.match(checkContent('pages/x/index.json', bad).join('; '), /config\.items\.0\.title/);
});

test('ListLead: Source Custom is config.custom, no Items switch', () => {
  const lead = readFileSync(
    new URL('../src/editor/svelte/ListLead.svelte', import.meta.url),
    'utf8',
  );
  // the Items mode switch is gone (wording may still appear in the file comment)
  assert.doesNotMatch(lead, /tf__label">Items</);
  assert.doesNotMatch(lead, />From a source</);
  assert.doesNotMatch(lead, /tf__label">Custom</);
  assert.match(lead, /config\/custom/);
  assert.match(lead, /config\/items/);
  assert.doesNotMatch(lead, /ll__pane/);
  assert.match(lead, /ListField/);
  assert.match(lead, /WidgetSource/);
  assert.match(lead, /oncustom/);
  assert.match(lead, /ll__actions/);
  assert.match(lead, /ll__source-head/);
  // ListField has no second title; Add lives on the Source row when Custom
  assert.match(lead, /label=""/);
  assert.match(lead, /ariaLabel="Items"/);
  assert.match(lead, /hideAdd/);
  const srcUi = readFileSync(
    new URL('../src/editor/svelte/WidgetSource.svelte', import.meta.url),
    'utf8',
  );
  assert.match(srcUi, /\['custom', 'Custom'\]/);
  const gf = readFileSync(
    new URL('../src/editor/svelte/GroupFields.svelte', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(gf, /seeAll/);
  const insp = readFileSync(
    new URL('../src/editor/svelte/WidgetInspector.svelte', import.meta.url),
    'utf8',
  );
  assert.match(insp, /type\.customItems/);
  assert.match(insp, /ListLead/);
  // add-menu line mentions custom items
  assert.match(
    WIDGET_TYPES.list.line,
    /An item per entry of a source, or items you add by hand, in a look you pick/,
  );
  // layout: no type === 'list' leak; items via widgetItems (source.js)
  const layout = readFileSync(new URL('../src/render/layout/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /widgets\/list\/(hand|custom)/);
  assert.doesNotMatch(layout, /type === ['"]list['"]/);
  const source = readFileSync(new URL('../src/render/layout/source.js', import.meta.url), 'utf8');
  // the generic helper never imports a widget module: the List def's items hook
  assert.doesNotMatch(source, /widgets\//);
  assert.match(source, /type\?\.items\?\.\(ctx, widget\)/);
  assert.equal(typeof WIDGET_TYPES.list.items, 'function');
});

test('resolveCustomItem: every key always present, empty when missing', () => {
  const ctx = { sources: { people: [{ id: 'a' }, { id: 'b' }] } };
  const keys = ['count', 'href', 'link', 'photo', 'source', 'title', 'unit'];
  const empty = resolveCustomItem(ctx, {});
  assert.deepEqual(Object.keys(empty).sort(), keys);
  for (const k of keys) assert.equal(empty[k], '', k);
  const full = resolveCustomItem(ctx, { title: 'P', source: 'people', unit: 'models' });
  assert.deepEqual(Object.keys(full).sort(), keys);
  assert.equal(full.count, '02');
  assert.equal(full.unit, 'models');
  // a custom List gives these items through widgetItems (the def hook)
  const w = { type: 'list', config: { custom: true, items: [{}] } };
  const shown = widgetItems(ctx, {}, w, WIDGET_TYPES.list);
  assert.equal(shown.source, null);
  assert.deepEqual(Object.keys(shown.items[0]).sort(), keys);
});

test('Photo grid, Project list and Album cards are gone: rejected, pointing to List', () => {
  assert.equal(WIDGET_TYPES.grid, undefined);
  assert.equal(WIDGET_TYPES.projects, undefined);
  assert.equal(WIDGET_TYPES.albums, undefined);
  const page = (type) => ({
    version: 1,
    kind: 'page',
    id: 'pg-old',
    sections: [{ id: 's-old', widgets: [{ id: 'w-old', type }] }],
  });
  assert.match(
    checkContent('pages/x/index.json', page('grid')).join('; '),
    /Photo grid \("grid"\) is gone: use a List/,
  );
  assert.match(
    checkContent('pages/x/index.json', page('projects')).join('; '),
    /Project list \("projects"\) is gone: use a List/,
  );
  assert.match(
    checkContent('pages/x/index.json', page('albums')).join('; '),
    /Album cards \("albums"\) is gone: use a List/,
  );
});

test('Photo panels is gone: a "panels" widget is rejected, pointing to List', () => {
  assert.equal(WIDGET_TYPES.panels, undefined);
  const page = {
    version: 1,
    kind: 'page',
    id: 'pg-oldp',
    sections: [{ id: 's-oldp', widgets: [{ id: 'w-oldp', type: 'panels', panels: [] }] }],
  };
  const out = checkContent('pages/x/index.json', page).join('; ');
  assert.match(out, /Photo panels \("panels"\) is gone: use a List \("list"\)/);
  assert.match(out, /"custom": true/);
});

// ---- which properties a preset shows: each role the property of its own name (no mapping)
/** base with a "shots" source: title "name", photos "cover" and "still" (no "photo"). */
const shotsSchema = (props) => ({ title: 'name', label: 'Shots', properties: props });
const shotsOf = (props) => ({
  ...base,
  sources: {
    ...base.sources,
    shots: [
      {
        id: 's-1',
        title: 'Dune',
        name: 'n1',
        cover: 'people/noor/1.jpg',
        still: 'people/noor/2.jpg',
        photos: ['a', 'b'],
      },
      {
        id: 's-2',
        title: 'Pier',
        name: 'n2',
        cover: 'people/daan/1.jpg',
        still: 'people/daan/2.jpg',
        photos: ['c'],
      },
    ],
  },
  schemas: { ...base.schemas, shots: shotsSchema(props) },
});
const coverOnly = shotsOf([
  { key: 'title', type: 'text' },
  { key: 'name', type: 'text' },
  { key: 'cover', type: 'photo', label: 'Cover' },
  { key: 'still', type: 'photo' },
  { key: 'photos', type: 'photos' },
]);
const shots = (config = {}) => ({ source: { mode: 'all', from: 'shots' }, config });
const srcs = (el) =>
  [...el.querySelectorAll('[data-list-item] .li__photo img')].map((i) => i.getAttribute('src'));

test('presets: each role the property of its own name, nothing guessed', () => {
  const { el } = list({ template: 'preset:card' }, shots(), coverOnly);
  // Title: the schema's declared title property ("name")
  assert.deepEqual(texts(el, '[data-list-item] .li__title'), ['n1', 'n2']);
  // the count is the plain {photos}
  const panel = list({ template: 'preset:panel' }, shots(), coverOnly).el;
  assert.deepEqual(texts(panel, '[data-list-item] .li__count'), ['2', '1']);
});

test('a source whose photo is "cover": Card without a photo, its items still whole', () => {
  const { el, seen } = list({ template: 'preset:card' }, shots(), coverOnly);
  const items = el.querySelectorAll('[data-list-item]');
  assert.equal(items.length, 2);
  // no "photo" property: no photo widget at all (cover / still are not guessed), no empty <img>
  assert.deepEqual(srcs(el), []);
  assert.equal(el.querySelectorAll('[data-list-item] img').length, 0);
  // each item still links to its page and shows its title
  for (const it of items) assert.ok(it.getAttribute('href'), it.outerHTML);
  assert.ok(!seen.some((w) => /have no \{/.test(w)), seen.join());
});

test('no property mapping: no hook, a leftover config.properties is ignored and only warned', () => {
  assert.equal(WIDGET_TYPES.list.mapping, undefined);
  const plain = list({ template: 'preset:card' }, shots(), coverOnly).html;
  const old = list({ template: 'preset:card', properties: { photo: 'still' } }, shots(), coverOnly);
  assert.deepEqual(srcs(old.el), []); // not mapped
  assert.equal(old.html.replace(/w-ls\d+/g, ''), plain.replace(/w-ls\d+/g, ''));
  // ewcms check: a warning, not a problem
  const leftover = {
    ...newWidget('list', new Set()),
    id: 'w-map1',
    config: { properties: { photo: 'still' } },
  };
  assert.deepEqual(WIDGET_TYPES.list.check(leftover), []);
  assert.match(WIDGET_TYPES.list.warn(leftover).join(), /config\.properties is no longer used/);
  assert.deepEqual(WIDGET_TYPES.list.warn({ ...leftover, config: {} }), []);
  const page = {
    version: 1,
    kind: 'page',
    id: 'pg-map1',
    title: 'X',
    sections: [
      { id: 's-map1', widgets: [{ ...leftover, source: { mode: 'all', from: 'people' } }] },
    ],
  };
  assert.deepEqual(checkContent('pages/x/index.json', page), []);
  assert.match(contentWarnings().join(), /List.*config\.properties is no longer used/);
  checkContent('pages/x/index.json', { ...page, sections: [] });
  assert.deepEqual(contentWarnings(), []); // emptied at each check
});

test('an inner List leftover config.properties is also only warned', () => {
  const t = template({
    name: 'P',
    widgets: onGrid([
      {
        type: 'list',
        role: 'photos',
        source: { mode: 'all', from: 'people' },
        config: { template: 'preset:card', columns: '4', properties: { photo: 'still' } },
      },
    ]),
  });
  assert.deepEqual(checkContent('templates/t-map1.json', t), []);
  assert.match(
    contentWarnings().join(),
    /sections\.0\.widgets\.0 \(List\): config\.properties is no longer used/,
  );
});

test('no heading, no See all: a leftover heading or config.seeAll renders nothing and only warns', () => {
  // the List is only its items: nothing before them, whatever is left over
  const old = list({ seeAll: true }, { heading: 'Models' });
  assert.equal(
    old.el.querySelector('.list').firstElementChild.className.split(' ')[0],
    'list__items',
  );
  assert.doesNotMatch(old.html, /list__head|section__|See all|>Models</);
  // no setting for them: not in the Content tab, not in a new List
  assert.equal(WIDGET_TYPES.list.settings, undefined);
  assert.ok(!WIDGET_TYPES.list.config.some((c) => c.key === 'seeAll'));
  const fresh = newWidget('list', new Set());
  assert.equal(fresh.heading, undefined);
  assert.equal(fresh.config.seeAll, undefined);
  // ewcms check: warnings, not problems (on a page)
  const leftover = { ...fresh, id: 'w-hd01', heading: 'Models', config: { seeAll: true } };
  assert.deepEqual(WIDGET_TYPES.list.check(leftover), []);
  const warned = WIDGET_TYPES.list.warn(leftover).join('; ');
  assert.match(warned, /"heading" is no longer used/);
  assert.match(warned, /config\.seeAll is no longer used/);
  assert.match(WIDGET_TYPES.list.warn({ ...leftover, heading: '' }).join(), /"heading"/);
  assert.deepEqual(WIDGET_TYPES.list.warn({ ...fresh, config: {} }), []);
  const page = {
    version: 1,
    kind: 'page',
    id: 'pg-hd01',
    title: 'X',
    sections: [
      { id: 's-hd01', widgets: [{ ...leftover, source: { mode: 'all', from: 'people' } }] },
    ],
  };
  assert.deepEqual(checkContent('pages/x/index.json', page), []);
  assert.match(contentWarnings().join(), /List.*"heading" is no longer used/);
  assert.match(contentWarnings().join(), /List.*config\.seeAll is no longer used/);
  // an inner List's leftover heading: warned too
  const t = template({
    name: 'P',
    widgets: onGrid([
      {
        type: 'list',
        role: 'photos',
        heading: 'Photos',
        source: { mode: 'all', from: 'people' },
        config: { template: 'preset:card', columns: '4' },
      },
    ]),
  });
  assert.deepEqual(checkContent('templates/t-hd01.json', t), []);
  assert.match(
    contentWarnings().join(),
    /sections\.0\.widgets\.0 \(List\): "heading" is no longer used/,
  );
  // the strings: no See all
  assert.equal(CORE_STRINGS.list.seeAll, undefined);
});

test('no "first cover of a list" fallback: a custom item shows only its own photo', () => {
  const custom = readFileSync(
    new URL('../src/render/widgets/list/custom.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(custom, /sourceCover|coverOf/);
  const it = resolveCustomItem(base, { title: 'P', source: 'people' });
  assert.equal(it.photo, '');
  const presets = readFileSync(
    new URL('../src/render/widgets/list/presets.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(presets, /first\('photo'\)|first\('photos'\)/);
});

test('the Content tab has no mapping rows (nothing reserves room under the source)', () => {
  const lead = readFileSync(
    new URL('../src/editor/svelte/ListLead.svelte', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(lead, /MAP_SLOTS|ll__map|data-mapping|config\/properties|setMapping/);
  assert.doesNotMatch(lead, /config\/fields|Template needs/);
});

test('Title: the declared title property only when its type fits', () => {
  const withName = (type) =>
    shotsOf([
      { key: 'title', type: 'text' },
      { key: 'name', type },
    ]);
  const title = (ctx) => namesOf(ctx, 'shots').title;
  assert.equal(title(withName('text')), 'name');
  assert.equal(title(withName('photo')), null); // declared, but not a text: none
  const bare = withName('text');
  bare.schemas.shots = { ...bare.schemas.shots, title: undefined };
  assert.equal(title(bare), 'title'); // none declared: "title"
});

test('a joined template line keeps the text typed around its properties (F40: "€")', async () => {
  const { joinedRuns } = await import('../src/render/widgets/list/presets.js');
  const runs = [{ t: '\n' }, { property: 'duration' }, { t: ' · €' }, { property: 'price' }];
  const none = () => false;
  assert.deepEqual(joinedRuns(runs, none), [
    { property: 'duration' },
    { t: ' · €' },
    { property: 'price' },
  ]);
  // no text typed between: the join
  assert.deepEqual(joinedRuns([{ property: 'a' }, { property: 'b' }], none, ' / '), [
    { property: 'a' },
    { t: ' / ' },
    { property: 'b' },
  ]);
  // an empty one takes the text before it along; the first shown has none before it
  const empty = (p) => p.property === 'duration';
  assert.deepEqual(joinedRuns(runs, empty), [{ property: 'price' }]);
  const three = [{ property: 'a' }, { t: ', ' }, { property: 'b' }, { t: ' €' }, { property: 'c' }];
  assert.deepEqual(
    joinedRuns(three, (p) => p.property === 'b'),
    [{ property: 'a' }, { t: ' €' }, { property: 'c' }],
  );
  assert.deepEqual(
    joinedRuns(three, () => true),
    [{ property: 'a' }, { property: 'b' }, { property: 'c' }],
  );
});
