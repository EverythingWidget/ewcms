// Side by side (src/site/widgets/list/side-by-side.js) and {number} (feature 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { warnings } from './test-layout.mjs';
import { loadContent } from './content.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { newWidget, newSection, renderSections } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';
import { newStackWidget, STACK_TYPES } from '../src/editor/lib/item-template.js';
import { PHOTO_WIDTHS } from '../src/site/widgets/list/side-by-side.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const base = loadContent(SITE_A);
const projects = base.sources.projects;
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const txt = (property, style = 'label', more = {}) => ({
  type: 'text',
  role: property,
  body: [{ style, text: [{ property }] }],
  ...more,
});
const row = (widgets, config = { align: 'baseline', spacing: 16, phone: 'wrap' }) => ({
  type: 'sideBySide',
  role: 'head',
  config,
  widgets,
});
const projectRow = row([
  txt('number'),
  txt('title', 'heading', { grow: true }),
  txt('type'),
  txt('year'),
]);
const tpl = (widgets) => ({
  version: 1,
  kind: 'template',
  label: 'Project row',
  source: 'projects',
  link: false,
  photoFirst: false,
  style: { border: 'bottom', padding: 16, background: 'none' },
  widgets,
});
const problems = (t) => checkContent('templates/t-prow.json', t);

let n = 0;
function render(t, source = { mode: 'all', from: 'projects' }, content = base) {
  const ctx0 = { ...content, templates: { ...content.templates, 't-prow': t } };
  const { routes } = buildRoutes(ctx0);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = { ...w, id: `w-sb${String(++n).padStart(3, '0')}`, source };
  widget.config = { ...w.config, template: 't-prow', columns: '1' };
  const ctx = { ...ctx0, route: page, routes, curtains: {} };
  const [html, seen] = warnings(() =>
    renderSections(ctx, page, 'pages/test/index.json', [newSection(ids, [widget])]),
  );
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return { el: document.querySelector('.wgt--list'), seen };
}

test('the project row: number, title filling the space, type, year on one line', () => {
  assert.deepEqual(problems(tpl([projectRow])), []);
  const { el, seen } = render(tpl([projectRow]));
  const items = [...el.querySelector('.list__items').children];
  assert.equal(items.length, projects.length);
  items.forEach((li, i) => {
    const sbs = li.querySelector('.li__sbs');
    assert.equal(sbs.className, 'li__w li__sbs li__sbs--baseline li__sbs--wrap li__head');
    assert.equal(sbs.getAttribute('style'), '--sbs-gap:16px');
    assert.deepEqual(
      [...sbs.children].map((c) => c.className),
      ['li__w li__number', 'li__w li__title li__grow', 'li__w li__type', 'li__w li__year'],
    );
    assert.deepEqual(
      [...sbs.children].map((c) => c.textContent.trim()),
      [
        String(i + 1).padStart(2, '0'),
        projects[i].title,
        projects[i].type,
        String(projects[i].year),
      ],
    );
  });
  assert.deepEqual(
    seen.filter((m) => !m.startsWith('[routes]')),
    [],
  );
});

test('defaults: center, 16 px, wrap; a photo width', () => {
  const t = tpl([
    row(
      [
        { type: 'photo', role: 'photo', src: [{ property: 'photo' }], config: { width: 'm' } },
        txt('title'),
      ],
      undefined,
    ),
  ]);
  delete t.widgets[0].config;
  assert.deepEqual(problems(t), []);
  const sbs = render(t).el.querySelector('.li__sbs');
  assert.match(sbs.className, /li__sbs--center li__sbs--wrap/);
  assert.equal(sbs.getAttribute('style'), '--sbs-gap:16px');
  assert.equal(sbs.firstElementChild.className, 'li__w li__photo li__pw li__pw--m');
  assert.deepEqual(PHOTO_WIDTHS, { s: 64, m: 96, l: 160 });
  const css = read('src/site/widgets/list/style.scss');
  for (const [k, px] of Object.entries(PHOTO_WIDTHS))
    assert.match(css, new RegExp(`\\.li__pw--${k} \\{\\s*width: ${px}px;`));
  for (const px of Object.values(PHOTO_WIDTHS)) assert.equal(px % 4, 0);
});

test('{number}: 01, 02 … at the top level; an item own "number" wins; 100 has three digits', () => {
  const t = tpl([txt('number')]);
  const many = Array.from({ length: 100 }, (_, i) => ({
    id: `p-n${i}`,
    slug: `n${i}`,
    title: `N${i}`,
  }));
  many[2].number = 'III';
  const content = { ...base, sources: { ...base.sources, projects: many } };
  const items = [
    ...render(t, { mode: 'all', from: 'projects' }, content).el.querySelectorAll('.li__number'),
  ];
  assert.deepEqual(
    [items[0], items[1], items[2], items[9], items[99]].map((x) => x.textContent.trim()),
    ['01', '02', 'III', '10', '100'],
  );
});

test('the validator: one level, 2–6 widgets, text/photo/button only, one grow, settings', () => {
  const p = (w) => problems(tpl([w])).join(' | ');
  assert.match(p(row([txt('title')])), /needs at least two widgets/);
  assert.match(p(row(Array.from({ length: 7 }, () => txt('title')))), /six widgets at most/);
  assert.match(
    p(row([row([txt('a'), txt('b')]), txt('title')])),
    /no Side by side inside a Side by side/,
  );
  assert.match(
    p(row([{ type: 'list', source: { mode: 'property', property: 'photos' } }, txt('title')])),
    /no List in a Side by side/,
  );
  assert.match(
    p(row([txt('a', 'label', { grow: true }), txt('b', 'label', { grow: true })])),
    /only one widget in a Side by side can fill the space/,
  );
  assert.match(p(row([txt('a'), txt('b')], { align: 'stretch' })), /config.align must be one of/);
  assert.match(p(row([txt('a'), txt('b')], { spacing: 10 })), /config.spacing must be one of/);
  assert.match(p(row([txt('a'), txt('b')], { justify: 'center' })), /not a Side by side setting/);
  assert.match(
    p(row([{ type: 'photo', src: [{ property: 'photo' }], config: { width: 'xl' } }, txt('b')])),
    /config.width must be "s", "m" or "l"/,
  );
  // outside a Side by side: no grow, no photo width
  assert.match(p(txt('a', 'label', { grow: true })), /only a widget in a Side by side/);
  assert.match(
    p({ type: 'photo', src: [{ property: 'photo' }], config: { width: 's' } }),
    /only applies in a Side by side/,
  );
});

test('only in templates: not a page widget (the widget registry has none)', () => {
  assert.equal(WIDGET_TYPES.sideBySide, undefined);
});

test('editor: Add side by side gives {number} and a property filling the space', () => {
  assert.deepEqual(STACK_TYPES.at(-1), ['sideBySide', 'Side by side']);
  const w = newStackWidget('sideBySide', 'title');
  assert.deepEqual(problems(tpl([w])), []);
  assert.deepEqual(
    w.widgets.map((c) => [c.body[0].text[0].property, c.grow === true]),
    [
      ['number', false],
      ['title', true],
    ],
  );
  const panel = read('src/editor/svelte/TemplatePanel.svelte');
  for (const label of [
    'Align',
    'Space between',
    'On a phone',
    'Fill the space',
    'Photo width',
    'Number (01, 02 …)',
  ])
    assert.ok(panel.includes(label), label);
});
