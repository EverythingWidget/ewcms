// Items that open and close (src/site/widgets/list/opens.js, ./client.js): feature 2.
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
import { addAt, newStackWidget, setDetails } from '../src/editor/lib/item-template.js';
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
// the old project row: number, title, type, year, +; then photo, text and a link button
const summary = {
  type: 'sideBySide',
  role: 'head',
  config: { align: 'baseline', spacing: 24 },
  widgets: [
    txt('number'),
    txt('title', 'heading', { grow: true }),
    txt('type'),
    txt('year'),
    { type: 'toggle' },
  ],
};
const details = {
  type: 'sideBySide',
  role: 'more',
  details: true,
  config: { align: 'top' },
  widgets: [
    { type: 'photo', role: 'photo', src: [{ property: 'photo' }], config: { width: 'l' } },
    txt('body', 'paragraph', { grow: true }),
  ],
};
const tpl = (more = {}, widgets = [summary, details]) => ({
  version: 1,
  kind: 'template',
  label: 'Project row',
  source: 'projects',
  link: false,
  photoFirst: false,
  opens: { several: false },
  widgets,
  ...more,
});
const problems = (t) => checkContent('templates/t-prow.json', t);

let n = 0;
function render(t) {
  const ctx0 = { ...base, templates: { ...base.templates, 't-prow': t } };
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
    // the summary holds the head row and the toggle; the details the photo and body
    assert.ok(s.querySelector('.li__head .li__toggle[aria-hidden="true"]'));
    assert.equal(s.querySelector('.li__number').textContent.trim(), String(i + 1).padStart(2, '0'));
    assert.ok(d.querySelector('.li__more .li__photo.li__pw--l img'));
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
  const { el } = render(tpl({ opens: { several: true } }));
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

test('the validator: not a link, one details start with a summary before it, one toggle in the summary, no button there', () => {
  const p = (t) => problems(t).join(' | ');
  assert.match(p(tpl({ link: true })), /can't also be a link/);
  const { link: _l, ...noLink } = tpl(); // eslint-disable-line no-unused-vars
  assert.match(p(noLink), /can't also be a link/);
  assert.match(p(tpl({ opens: { multiple: true } })), /opens.multiple is not an "opens" setting/);
  assert.match(p(tpl({ opens: { several: 'yes' } })), /opens.several must be true or false/);
  assert.match(p(tpl({}, [summary, txt('body')])), /needs its details/);
  assert.match(p(tpl({}, [summary, details, { ...txt('x'), details: true }])), /one widget only/);
  assert.match(
    p(tpl({}, [{ ...summary, details: true }, txt('x')])),
    /summary needs a widget before/,
  );
  assert.match(p(tpl({}, [summary, details, { type: 'toggle' }])), /One toggle per template/);
  assert.match(
    p(tpl({}, [txt('title'), { ...details, widgets: [...details.widgets, { type: 'toggle' }] }])),
    /the toggle goes in the summary/,
  );
  assert.match(
    p(tpl({}, [{ type: 'button', label: 'Go', itemLink: true, config: {} }, details])),
    /no button in the summary/,
  );
  // without "opens": no details, no toggle
  const { opens: _o, ...plain } = tpl(); // eslint-disable-line no-unused-vars
  assert.match(p(plain), /only in a template that opens/);
  assert.match(
    p({ ...plain, widgets: [txt('title'), { type: 'toggle' }] }),
    /only for a template that opens/,
  );
  assert.match(
    p(tpl({}, [{ type: 'toggle', label: 'x' }, details])),
    /a toggle has only "type" and "role"/,
  );
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
  const templates = { 't-prow': tpl(), 't-outr': outer };
  const msgs = bindingProblems({ ...base, templates }, { types: WIDGET_TYPES }).map(
    (x) => x.message,
  );
  assert.ok(
    msgs.some((m) => /can't use items that open/.test(m)),
    msgs.join('\n'),
  );
  assert.equal(innerChoice(templates, 't-outr', 't-prow'), 'opens');
});

test('the editor: Details start here, Add toggle before the details, the labels; first item open', () => {
  const ws = setDetails([summary, { ...details, details: undefined }, txt('x')], 1);
  assert.deepEqual(
    ws.map((w) => w.details === true),
    [false, true, false],
  );
  const t = addAt(ws, newStackWidget('toggle'));
  assert.deepEqual(
    t.map((w) => w.type),
    ['sideBySide', 'toggle', 'sideBySide', 'text'],
  );
  const panel = read('src/editor/svelte/TemplatePanel.svelte');
  for (const label of [
    'Opens: items open and close',
    'Several open at once',
    'Details start here',
    'Details, hidden until opened',
    'An item that opens can’t also be a link',
  ])
    assert.ok(panel.includes(label), label);
  // no shift: the transition is the details' grid row, nothing measured
  const css = read('src/site/widgets/list/style.scss');
  assert.match(css, /grid-template-rows: 0fr/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
