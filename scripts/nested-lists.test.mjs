// List step 10: nested Lists (two levels; src/site/widgets/list/nested.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onGrid, template } from './grid-helper.mjs';
import { gridStyle } from '../src/site/widgets/list/item-grid.js';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { warnings } from './test-layout.mjs';
import { loadContent } from './content.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { newWidget, newSection, renderSections } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';
import { bindingProblems } from '../src/site/layout/bindings.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import {
  innerChoice,
  innerItems,
  innerSourceProblems,
  nestingProblems,
} from '../src/site/widgets/list/nested.js';
import { presetOf, cloneTemplate } from '../src/site/widgets/list/presets.js';
import { PRESET_STYLES, styleProblems } from '../src/site/widgets/list/item-style.js';
import { partLabel, partText } from '../src/site/layout/parts.js';
import { chipHtml, partOfName } from '../src/editor/lib/parts-input.js';
import { innerSourceFor, newStackWidget } from '../src/editor/lib/item-template.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const base = loadContent(SITE_A);
const people = base.sources.people;
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const tpl = (name, widgets, more = {}) => template({ name, widgets: onGrid(widgets), ...more });
const title = {
  type: 'text',
  role: 'title',
  body: [{ style: 'heading', text: [{ property: 'title' }] }],
};
const inner = (source, template = 't-ph00', more = {}) => ({
  type: 'list',
  role: 'photos',
  source,
  config: { template, columns: '4', gap: 1 },
  ...more,
});
const photoTpl = tpl('Photo', [
  { type: 'photo', role: 'photo', src: [{ property: 'photo' }] },
  {
    type: 'text',
    role: 'facts',
    body: [
      {
        style: 'label',
        text: [{ property: 'title', of: 'parent' }, { t: ' ' }, { property: 'number' }],
      },
    ],
  },
]);
let n = 0;
function render(templates, config = { template: 't-card' }, content = base) {
  const ctx0 = { ...content, templates: { ...content.templates, ...templates } };
  const { routes } = buildRoutes(ctx0);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = {
    ...w,
    id: `w-nl${String(++n).padStart(3, '0')}`,
    source: { mode: 'all', from: 'people' },
  };
  widget.config = { ...w.config, ...config };
  const ctx = { ...ctx0, route: page, routes, curtains: {} };
  const [html, seen] = warnings(() =>
    renderSections(ctx, page, 'pages/test/index.json', [newSection(ids, [widget])]),
  );
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return { el: document.querySelector('.wgt--list'), seen };
}

test("the plan's test: each person's card shows its own photos as an inner grid", () => {
  const { el, seen } = render({
    't-card': tpl('Person', [
      title,
      inner({ mode: 'property', property: 'photos' }, 'preset:photo'),
    ]),
  });
  const outer = [...el.querySelector('.list__items').children];
  assert.equal(outer.length, people.length);
  outer.forEach((li, i) => {
    const grid = li.querySelector('.li__inner .list__items');
    assert.equal(grid.getAttribute('data-cols'), '4');
    const imgs = grid.querySelectorAll('.li .li__photo img');
    assert.equal(imgs.length, people[i].photos.length, people[i].title);
    // the Photo preset: a photo only, no text
    assert.equal(grid.querySelectorAll('.li .ts').length, 0);
  });
  assert.ok(!seen.some((w) => /two levels/.test(w)), seen.join());
});

test('an inner template reads the outer item: {parent: title} and {number}', () => {
  const { el, seen } = render({
    't-card': tpl('Person', [title, inner({ mode: 'property', property: 'photos' })]),
    't-ph00': photoTpl,
  });
  const outer = [...el.querySelector('.list__items').children];
  assert.equal(outer.length, people.length);
  outer.forEach((li, i) => {
    const grid = li.querySelector('.li__inner .list__items');
    assert.equal(grid.getAttribute('data-cols'), '4');
    const imgs = grid.querySelectorAll('.li .li__photo img');
    assert.equal(imgs.length, people[i].photos.length, people[i].title);
    // {parent: title} is the outer item's, {number} the photo's number
    assert.equal(grid.querySelector('.li__facts').textContent.trim(), `${people[i].title} 01`);
  });
  assert.ok(!seen.some((w) => /two levels/.test(w)), seen.join());
});

test('preset:photo: a photo only, its style spelled out, and Duplicate copies it', () => {
  assert.deepEqual(presetOf('preset:photo').roles, ['photo']);
  const copy = cloneTemplate(base, 'people', 'preset:photo', { properties: { photo: 'cover' } });
  assert.equal(copy.name, 'Photo copy');
  assert.equal(copy.basedOn, 'preset:photo');
  // its style without the keys the template grid took over; the photo's ratio is its size
  assert.deepEqual(copy.style, gridStyle(PRESET_STYLES['preset:photo']));
  assert.equal(copy.sections[0].widgets[0].size, 'aspect');
  assert.equal(copy.sections[0].widgets[0].aspect, '4:5');
  assert.deepEqual(
    copy.sections[0].widgets.map((w) => w.type),
    ['photo'],
  );
  assert.deepEqual(styleProblems(copy.style), []);
  assert.deepEqual(
    checkContent({ ...base, templates: { 't-copy': copy } }).filter((p) =>
      /t-copy/.test(p.file || p.message || ''),
    ),
    [],
  );
});

test('the three source forms: a property, a source, a source matched to this item', () => {
  const noor = people[0];
  assert.deepEqual(innerItems(base, { mode: 'property', property: 'photos' }, noor).items[0], {
    photo: noor.photos[0],
  });
  assert.deepEqual(
    innerItems(base, { mode: 'property', property: 'role' }, { role: ['a', 'b'] }).items,
    [{ title: 'a' }, { title: 'b' }],
  );
  assert.equal(
    innerItems(base, { mode: 'all', from: 'places' }, noor).items.length,
    base.sources.places.length,
  );
  // matched: the people whose location is this item's
  const match = (it) =>
    innerItems(
      base,
      {
        mode: 'match',
        from: 'people',
        where: { op: 'and', rules: [{ property: 'location', parent: 'location' }] },
      },
      it,
    ).items;
  assert.deepEqual(
    match(noor).map((p) => p.id),
    people.filter((p) => p.location === noor.location).map((p) => p.id),
  );
  assert.deepEqual(match({}), []); // the outer item has no value: none
});

test('the validator: inner sources only in templates; the shapes; a page keeps its own modes', () => {
  const T = 'templates/t-card.json';
  const ok = (src) =>
    assert.deepEqual(
      checkContent(T, tpl('P', [inner(src, 'preset:card')])),
      [],
      JSON.stringify(src),
    );
  ok({ mode: 'property', property: 'photos' });
  ok({ mode: 'all', from: 'places' });
  ok({ mode: 'item', from: 'places', id: 'p-an0r' });
  ok({
    mode: 'match',
    from: 'people',
    where: { op: 'and', rules: [{ property: 'location', parent: 'location' }] },
  });
  assert.match(innerSourceProblems({ mode: 'url', from: 'people' }, 'w').join(), /must be/);
  assert.match(
    innerSourceProblems(
      { mode: 'match', from: 'people', where: { op: 'and', rules: [] } },
      'w',
    ).join(),
    /must be/,
  );
  assert.match(checkContent(T, tpl('P', [inner(undefined)])).join(), /widgets\.0\.source must be/);
  assert.match(
    checkContent(
      T,
      tpl('P', [inner({ mode: 'all', from: 'people' }, 'preset:card', { config: { limit: 4 } })]),
    ).join(),
    /config\.limit is not an inner List setting/,
  );
  // its gap: a whole number of cells (the item's grid it sits on)
  const gap = (g) =>
    checkContent(
      T,
      tpl('P', [inner({ mode: 'all', from: 'people' }, 'preset:card', { config: { gap: g } })]),
    ).join();
  assert.equal(gap(2), '');
  assert.match(gap('m'), /config\.gap must be a whole number of cells/);
  assert.match(gap(-1), /config\.gap must be a whole number of cells/);
  // on a page: property / match are not a source form there
  const page = {
    version: 1,
    kind: 'page',
    id: 'pg-abcd',
    sections: [
      {
        id: 's-abcd',
        widgets: [
          {
            id: 'w-abcd',
            type: 'list',
            source: { mode: 'property', property: 'photos' },
            config: {},
          },
        ],
      },
    ],
  };
  assert.notDeepEqual(checkContent('pages/x/index.json', page), []);
});

test('two levels at most and no loops: check, Save and the editor', () => {
  const templates = {
    't-aaaa': tpl('Cards', [title, inner({ mode: 'all', from: 'people' }, 't-bbbb')]),
    't-bbbb': tpl('Rows', [title, inner({ mode: 'all', from: 'people' }, 't-aaaa')]),
    't-cccc': tpl('Deep', [title, inner({ mode: 'all', from: 'people' }, 't-aaaa')]),
    't-self': tpl('Self', [title, inner({ mode: 'all', from: 'people' }, 't-self')]),
  };
  const msgs = nestingProblems(templates).map((p) => p.message);
  assert.ok(
    msgs.includes(
      "templates/t-aaaa.json: This list can't use Rows, because Rows already contains it.",
    ),
  );
  assert.ok(
    msgs.includes(
      "templates/t-self.json: This list can't use Self, because Self already contains it.",
    ),
  );
  assert.ok(msgs.some((m) => /t-cccc.*two levels at most/.test(m)));
  // check and Save run it (bindingProblems: the 'error' level)
  const content = { ...base, templates };
  assert.ok(
    bindingProblems(content, { types: WIDGET_TYPES }).some(
      (p) => p.level === 'error' && /already contains it/.test(p.message),
    ),
  );
  assert.equal(
    nestingProblems({
      't-card': tpl('P', [inner({ mode: 'all', from: 'people' }, 't-ph00')]),
      't-ph00': photoTpl,
    }).length,
    0,
  );
  // the editor: a loop not offered, a third level disabled
  assert.equal(innerChoice(templates, 't-aaaa', 't-bbbb'), 'loop');
  assert.equal(
    innerChoice({ ...templates, 't-new0': tpl('New', [title]) }, 't-new0', 't-cccc'),
    'deep',
  );
  assert.equal(innerChoice({ 't-ph00': photoTpl }, 't-new0', 't-ph00'), '');
});

test('a third level never renders: it warns', () => {
  const { el, seen } = render({
    't-card': tpl('Person', [title, inner({ mode: 'property', property: 'photos' }, 't-deep')]),
    't-deep': tpl('Deep', [title, inner({ mode: 'all', from: 'places' }, 'preset:card')]),
  });
  assert.equal(el.querySelectorAll('.li__inner .li__inner').length, 0);
  assert.ok(
    seen.some((w) => /two levels at most/.test(w)),
    seen.join(),
  );
});

test('{parent: title}: the outer item, its chip and label, read back in the editor', () => {
  const part = { property: 'title', of: 'parent' };
  assert.equal(partLabel(part), '{parent: title}');
  assert.equal(partText(part, { item: { title: 'x' }, parent: { title: 'Noor' } }), 'Noor');
  assert.deepEqual(partOfName('parent:title'), part);
  assert.deepEqual(partOfName('title'), { property: 'title' });
  const chip = chipHtml(part, new Set());
  assert.match(chip, /data-of="parent"/);
  assert.match(chip, /\{parent: title\}/);
  assert.doesNotMatch(chip, /is-unknown/);
  assert.match(read('src/editor/rich.js'), /n\.dataset\.of === 'parent' \? \{ of: 'parent' \}/);
  assert.match(read('src/site/text.js'), /data-of="parent"/);
});

test('the template editor: Add list, the inner List rows always there, the labels', () => {
  const w = newStackWidget('list', 'title', 'View', 'photos');
  assert.deepEqual(w.source, { mode: 'property', property: 'photos' });
  assert.deepEqual(checkContent('templates/t-card.json', tpl('P', [w])), []);
  assert.deepEqual(innerSourceFor('all', {}, { source: 'places' }), {
    mode: 'all',
    from: 'places',
  });
  assert.equal(
    innerSourceFor('match', { from: 'people' }, { own: 'slug' }).where.rules[0].parent,
    'slug',
  );
  const panel = read('src/editor/svelte/TemplatePanel.svelte');
  for (const label of [
    'Items from',
    'Property',
    'Source',
    'Match: their property',
    'Template',
    'Columns',
    'Space between items',
  ])
    assert.match(panel, new RegExp(`label="${label}"`), label);
  assert.match(panel, /is this item’s/);
  assert.match(
    panel,
    /This template is shown inside another List: a list here would be a third level/,
  );
  assert.match(panel, /It holds a list: a third level/);
  // no config.limit (no "At most") on an inner List
  assert.doesNotMatch(panel, /limit|At most/);
  const items = read('src/editor/lib/item-template.js');
  assert.match(items, /\['property', 'A property of this item'\]/);
  assert.match(items, /\['match', 'A source, matched to this item'\]/);
});
