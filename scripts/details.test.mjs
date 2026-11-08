// Summary and details (src/site/widgets/list/details.js, ./client.js): items that open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { warnings } from './test-layout.mjs';
import { loadContent } from './content.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { newWidget, newSection, renderSections } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';
import { bindingProblems } from '../src/site/layout/bindings.js';
import { innerChoice } from '../src/site/widgets/list/nested.js';
import listClient, { setOpen, opensKey } from '../src/site/widgets/list/client.js';
import { addAt, newStackWidget } from '../src/editor/lib/item-template.js';
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
// the old project row on the template grid: number, title, type, year and the +/× on one
// line (the summary); the details a template of their own: photo and text
const at = (id, col, span, more = {}) => ({ id, layout: { base: { col, span, row: 1 } }, ...more });
const dw = (config = {}) => ({
  ...at('w-dets', 116, 5),
  type: 'details',
  config: { template: 't-pmor', ...config },
});
const summary = [
  { ...txt('number'), ...at('w-num0', 1, 8) },
  { ...txt('title', 'heading'), ...at('w-tit0', 13, 60) },
  { ...txt('type'), ...at('w-typ0', 80, 20) },
  { ...txt('year'), ...at('w-yea0', 104, 10) },
];
const tpl = (more = {}, widgets = [...summary, dw(more.config)]) => {
  const { config: _c, ...rest } = more; // eslint-disable-line no-unused-vars
  return {
    version: 1,
    kind: 'template',
    label: 'Project row',
    source: 'projects',
    link: false,
    widgets,
    ...rest,
  };
};
const more = {
  version: 1,
  kind: 'template',
  label: 'Project details',
  source: 'projects',
  widgets: [
    { type: 'photo', role: 'photo', src: [{ property: 'photo' }], ...at('w-pho0', 13, 50) },
    { ...txt('body', 'paragraph'), ...at('w-bod0', 68, 52) },
  ],
};
const problems = (t) => checkContent('templates/t-prow.json', t);

let n = 0;
function render(t) {
  const ctx0 = { ...base, templates: { ...base.templates, 't-prow': t, 't-pmor': more } };
  const { routes } = buildRoutes(ctx0);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = {
    ...w,
    id: `w-op${String(++n).padStart(3, '0')}`,
    source: { mode: 'all', from: 'projects' },
  };
  widget.config = { ...w.config, template: 't-prow', columns: '1' };
  const ctx = { ...ctx0, route: page, routes, curtains: {} };
  const [html] = warnings(() =>
    renderSections(ctx, page, 'pages/test/index.json', [newSection(ids, [widget])]),
  );
  const { document, window } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return { document, window, el: document.querySelector('.wgt--list') };
}

test('markup: the summary is a button with aria-expanded / aria-controls, the details a closed region', () => {
  assert.deepEqual(problems(tpl()), []);
  const { el } = render(tpl());
  const list = el.querySelector('.list__items');
  assert.equal(list.getAttribute('data-opens'), 'one');
  const items = [...list.children];
  assert.equal(items.length, projects.length);
  items.forEach((li, i) => {
    assert.equal(li.tagName, 'DIV'); // never a link
    assert.ok(li.hasAttribute('data-opens'));
    assert.ok(!li.hasAttribute('data-open')); // starts closed
    assert.equal(li.getAttribute('data-slug'), projects[i].slug);
    const s = li.querySelector('.li__summary');
    const d = li.querySelector('.li__details');
    assert.equal(s.getAttribute('role'), 'button');
    assert.equal(s.getAttribute('tabindex'), '0');
    assert.equal(s.getAttribute('aria-expanded'), 'false');
    assert.equal(s.getAttribute('aria-controls'), d.id);
    assert.equal(d.getAttribute('role'), 'region');
    assert.equal(d.getAttribute('aria-labelledby'), s.id);
    assert.ok(d.hasAttribute('inert'));
    // the summary is the item's grid with the +/× at its place; the details the details'
    // template's grid: photo and body, from the same item
    assert.ok(
      s.querySelector('.sec--item > .wgt[data-tw="w-dets"] .li__toggle[aria-hidden="true"]'),
    );
    assert.equal(s.querySelector('.li__number').textContent.trim(), String(i + 1).padStart(2, '0'));
    assert.ok(d.querySelector('.sec--item > .wgt[data-tw="w-pho0"] img'));
    assert.ok(!s.querySelector('.li__photo'));
  });
});

test('click, Enter, Space open and close; one at a time; Esc closes and focuses the summary', () => {
  const { el, window, document } = render(tpl());
  globalThis.document = document; // the arrow keys' handler reads document.activeElement
  const list = el.querySelector('.list__items');
  listClient(el);
  const [a, b] = list.children;
  const sa = a.querySelector('.li__summary');
  const sb = b.querySelector('.li__summary');
  const key = (t, k) =>
    t.dispatchEvent(
      Object.assign(new window.Event('keydown', { bubbles: true, cancelable: true }), { key: k }),
    );
  sa.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.ok(a.hasAttribute('data-open'));
  assert.equal(sa.getAttribute('aria-expanded'), 'true');
  assert.ok(!a.querySelector('.li__details').hasAttribute('inert'));
  key(sb, 'Enter'); // opening b closes a
  assert.ok(b.hasAttribute('data-open'));
  assert.ok(!a.hasAttribute('data-open'));
  assert.equal(sa.getAttribute('aria-expanded'), 'false');
  assert.ok(a.querySelector('.li__details').hasAttribute('inert'));
  key(sb, ' ');
  assert.ok(!b.hasAttribute('data-open'));
  key(sb, ' ');
  let focused = null;
  sb.focus = () => (focused = sb);
  key(b.querySelector('.li__body') || b.querySelector('.li__details'), 'Escape');
  assert.ok(!b.hasAttribute('data-open'));
  assert.equal(focused, sb);
  assert.equal(opensKey('Enter', false, false), null); // Enter inside the details: its own
  assert.equal(opensKey('Escape', false, false), null);
  delete globalThis.document;
});

test('several open at once', () => {
  const { el } = render(tpl({ config: { several: true } }));
  const list = el.querySelector('.list__items');
  assert.equal(list.getAttribute('data-opens'), 'several');
  const [a, b] = list.children;
  setOpen(list, a, true);
  setOpen(list, b, true);
  assert.ok(a.hasAttribute('data-open') && b.hasAttribute('data-open'));
});

test('#<slug> opens that item on load', () => {
  const { el } = render(tpl());
  const was = globalThis.location;
  globalThis.location = { hash: `#${projects[1].slug}` };
  try {
    listClient(el);
  } finally {
    globalThis.location = was;
  }
  const items = [...el.querySelector('.list__items').children];
  assert.deepEqual(
    items.map((li) => li.hasAttribute('data-open')),
    items.map((_, i) => i === 1),
  );
});

test('screen reader name, no icon, first open', () => {
  const { el } = render(
    tpl({ config: { screenReaderName: [{ property: 'title' }], icon: 'none', open: 'first' } }),
  );
  const items = [...el.querySelector('.list__items').children];
  const s = items[0].querySelector('.li__summary');
  assert.equal(s.getAttribute('aria-label'), projects[0].title);
  assert.ok(!el.querySelector('.li__toggle'));
  assert.deepEqual(
    items.map((li) => li.hasAttribute('data-open')),
    items.map((_, i) => i === 0),
  );
});

test('the validator: its settings, one per template, not a link, no button in the summary; what replaced opens, toggle and details: true', () => {
  const p = (t) => problems(t).join(' | ');
  assert.deepEqual(problems(tpl()), []);
  assert.match(p(tpl({ link: true })), /can't also be a link/);
  const { link: _l, ...noLink } = tpl(); // eslint-disable-line no-unused-vars
  assert.match(p(noLink), /can't also be a link/);
  assert.match(p(tpl({ config: { several: 'yes' } })), /config.several must be true or false/);
  assert.match(p(tpl({ config: { icon: 'x' } })), /config.icon must be plus or none/);
  assert.match(p(tpl({ config: { open: 'all' } })), /config.open must be none or first/);
  assert.match(p(tpl({ config: { label: 'x' } })), /config.label is "screenReaderName"/);
  assert.match(p(tpl({ config: { template: 'nope' } })), /details' template id/);
  assert.match(p(tpl({}, [...summary, dw(), { ...dw(), id: 'w-det2' }])), /One "details" widget/);
  assert.match(
    p(
      tpl({}, [
        ...summary,
        { ...at('w-btn0', 1, 10), type: 'button', label: 'Go', itemLink: true, config: {} },
        dw(),
      ]),
    ),
    /no button in the summary/,
  );
  // the retired keys name what replaced them
  assert.match(p(tpl({ opens: { several: false } })), /"opens" is gone: a "details" widget/);
  assert.match(
    p(tpl({}, [...summary, { type: 'toggle' }])),
    /the toggle is gone: a "details" widget/,
  );
  assert.match(
    p(tpl({}, [{ ...summary[0], details: true }])),
    /details is gone: the details are a template of their own/,
  );
  // across the templates: the details' template exists, one level only
  const msgs = (templates) =>
    bindingProblems({ ...base, templates }, { types: WIDGET_TYPES })
      .map((x) => x.message)
      .join('\n');
  assert.match(msgs({ 't-prow': tpl() }), /details' template "t-pmor" is missing/);
  assert.match(msgs({ 't-prow': tpl(), 't-pmor': tpl() }), /has Summary and details of its own/);
});

test('not in an inner List: check and the editor', () => {
  const outer = {
    version: 1,
    kind: 'template',
    label: 'Outer',
    widgets: [
      txt('title'),
      {
        type: 'list',
        role: 'rows',
        source: { mode: 'all', from: 'projects' },
        config: { template: 't-prow' },
      },
    ],
  };
  const templates = { 't-prow': tpl(), 't-pmor': more, 't-outr': outer };
  const msgs = bindingProblems({ ...base, templates }, { types: WIDGET_TYPES }).map(
    (x) => x.message,
  );
  assert.ok(
    msgs.some((m) => /can't use items that open/.test(m)),
    msgs.join('\n'),
  );
  assert.equal(innerChoice(templates, 't-outr', 't-prow'), 'opens');
});

test('the editor: Add Summary and details, its rows; no shift', () => {
  const t = addAt(summary, newStackWidget('details'));
  assert.equal(t.at(-1).type, 'details');
  assert.deepEqual(t.at(-1).layout, { base: { col: 113, span: 8, row: 1 } });
  assert.deepEqual(t.at(-1).config, { several: false, icon: 'plus' });
  const panel = read('src/editor/svelte/TemplatePanel.svelte');
  for (const label of [
    'Details template',
    'Several open at once',
    'Screen reader name',
    'First item open',
    'One Summary and details per template',
    'An item that opens can’t also be a link',
  ])
    assert.ok(panel.includes(label), label);
  assert.ok(read('src/editor/lib/item-template.js').includes("['details', 'Summary and details']"));
  // no shift: the transition is the details' grid row, nothing measured
  const css = read('src/site/widgets/list/style.scss');
  assert.match(css, /grid-template-rows: 0fr/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('an item is as wide as the List gives it, never its content (a resize re-measures it)', () => {
  const css = read('src/site/widgets/list/style.scss');
  const block = css.slice(css.indexOf('.li--template {'));
  assert.match(block, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(block, /\.li__details-in \{[^}]*justify-items: stretch/);
  assert.match(block, /\.sec--item \{[^}]*width: 100%/);
});
