// List step 8: the template editor (Pages > Site > Templates, content/templates/t-….json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onGrid } from './grid-helper.mjs';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { loadContent } from './content.mjs';
import { renderRoute } from '../src/site/render.js';
import { checkContent } from '../src/site/validate.js';
import { cloneTemplate } from '../src/site/widgets/list/presets.js';
import {
  templateOfPath,
  templatePreview,
  templatePreviewPath,
  sampleSource,
} from '../src/site/widgets/list/template-preview.js';
import {
  keepMarks,
  moveStack,
  addAt,
  removeWidget,
  newStackWidget,
  renameProperty,
  runsOf,
  stackName,
  templateProperties,
} from '../src/editor/lib/item-template.js';
import { entryFor } from '../src/editor/lib/page-tree.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const base = loadContent(SITE_A);
const T = 'templates/t-ab12.json';
const card = (more = {}) => ({
  version: 1,
  kind: 'template',
  label: 'People card',
  basedOn: 'preset:card',
  link: true,
  widgets: onGrid([
    { type: 'photo', role: 'photo', src: [{ property: 'cover' }] },
    { type: 'text', role: 'title', body: [{ style: 'heading', text: [{ property: 'title' }] }] },
    {
      type: 'text',
      role: 'facts',
      join: ' · ',
      body: [
        { style: 'label', text: [{ property: 'location' }, { t: ' · ' }, { property: 'title' }] },
      ],
    },
  ]),
  ...more,
});
const withTemplate = (tpl, id = 't-ab12') => ({
  ...base,
  templates: { ...base.templates, [id]: tpl },
});
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the preview address: /__template/<id>/ for a template id only', () => {
  assert.equal(templatePreviewPath('t-ab12'), '/__template/t-ab12/');
  assert.equal(templateOfPath('/__template/t-ab12/'), 't-ab12');
  assert.equal(templateOfPath('/__template/about/'), '');
  assert.equal(templateOfPath('/about/'), '');
});

test('the preview: one List of the first item of its source, else a hand-made sample', () => {
  const name = base.sources.people[0].title || base.sources.people[0].name;
  const from = withTemplate(card({ source: 'people' }));
  assert.equal(sampleSource(from, from.templates['t-ab12']), 'people');
  const { route, content } = templatePreview(from, 't-ab12');
  assert.equal(route.path, '/__template/t-ab12/');
  const { document } = parseHTML(`<body>${renderRoute(route, content, { editable: true }).body}`);
  const items = document.querySelectorAll('.li');
  assert.equal(items.length, 1);
  if (name) assert.match(items[0].textContent, new RegExp(String(name).slice(0, 6)));
  // no source (or one without items): the hand-made sample
  for (const tpl of [card(), card({ source: 'nope' })]) {
    const p = templatePreview(withTemplate(tpl), 't-ab12');
    const html = renderRoute(p.route, p.content, { editable: true }).body;
    assert.match(html, /Sample item/);
  }
  // not a template: none (the dev server's 404)
  assert.equal(templatePreview(base, 't-none'), null);
  assert.equal(templatePreview(base, 'about'), null);
  // the content given isn't changed (the page is the preview's own)
  assert.equal(from.pages.__template, undefined);
});

test('"basedOn" names what it was copied from; "from" is no template key', () => {
  assert.match(
    checkContent(T, { ...card(), basedOn: undefined, from: 'preset:card' }).join(),
    /"from" is not a template key/,
  );
  assert.equal(cloneTemplate(base, 'people', 'preset:card').basedOn, 'preset:card');
});

test('"source" (where its sample comes from) is a template key; Duplicate records it', () => {
  assert.deepEqual(checkContent(T, card({ source: 'people' })), []);
  assert.match(checkContent(T, card({ source: 3 })).join(), /"source" must be a source name/);
  assert.equal(cloneTemplate(base, 'people', 'preset:card').source, 'people');
  assert.equal(cloneTemplate(base, '', 'preset:panel', { handmade: true }).source, undefined);
  // a copy of a template keeps its source
  const again = cloneTemplate(withTemplate(card({ source: 'people' })), '', 't-ab12');
  assert.equal(again.source, 'people');
});

test('the stack: add, remove, reorder; every new widget passes the validator', () => {
  const w = card().widgets;
  assert.deepEqual(
    moveStack(w, 0, 2).map((x) => x.role),
    ['title', 'facts', 'photo'],
  );
  for (const type of ['text', 'photo', 'button']) {
    // Add: on the grid, its own id, full width, following the last widget
    const next = card({ widgets: addAt(w, newStackWidget(type, 'title')) });
    assert.deepEqual(checkContent(T, next), [], type);
    const added = next.widgets.at(-1);
    assert.match(added.id, /^w-[a-z0-9]{4}$/);
    assert.deepEqual(added.layout.base, {
      col: 1,
      span: 120,
      row: 1,
      link: { to: w.at(-1).id, gap: 2 },
    });
  }
  // remove: a widget that followed it follows what it followed
  const gone = removeWidget(w, 1);
  assert.deepEqual(gone[1].layout.base.link, { to: w[0].id, gap: 2 });
  assert.deepEqual(checkContent(T, card({ widgets: gone })), []);
  assert.deepEqual(newStackWidget('photo', 'cover').src, [{ property: 'cover' }]);
  assert.equal(newStackWidget('button').itemLink, true);
  assert.equal(stackName(w[1]), 'Text · title');
  assert.equal(stackName({ type: 'button' }), 'Button');
  // a chips field's value as a line's runs
  assert.deepEqual(runsOf('Hi'), [{ t: 'Hi' }]);
  assert.deepEqual(runsOf(''), []);
  assert.deepEqual(runsOf([{ property: 'x' }]), [{ property: 'x' }]);
});

test('Properties: the binds listed once, a rename changes every bind of it', () => {
  const w = card().widgets;
  assert.deepEqual(templateProperties(w), ['cover', 'title', 'location']);
  const next = renameProperty(w, 'title', 'name');
  assert.deepEqual(templateProperties(next), ['cover', 'name', 'location']);
  assert.deepEqual(next[2].body[0].text, [
    { property: 'location' },
    { t: ' · ' },
    { property: 'name' },
  ]);
  // the rest as it was, the input untouched
  assert.equal(next[2].join, ' · ');
  assert.deepEqual(templateProperties(w), ['cover', 'title', 'location']);
  // a format kept; an empty or same name changes nothing
  const f = [
    { type: 'text', body: [{ style: 'label', text: [{ property: 'd', format: 'year' }] }] },
  ];
  assert.deepEqual(renameProperty(f, 'd', 'date')[0].body[0].text, [
    { property: 'date', format: 'year' },
  ]);
  assert.equal(renameProperty(w, 'title', ''), w);
  assert.equal(renameProperty(w, 'title', 'title'), w);
  assert.deepEqual(checkContent(T, card({ widgets: next })), []);
});

test('the editor: a Templates group under Site, its own target, Edit template, no shift', () => {
  // Pages > Site > Templates: an entry per template file (main.js), its row opens it
  const pages = [
    { kind: 'item-template', id: 't-ab12', title: 'People card', path: '/__template/t-ab12/' },
  ];
  assert.equal(entryFor(pages, { id: 't-ab12', part: true, itemTemplate: true }), pages[0]);
  const list = read('src/editor/svelte/PagesList.svelte');
  assert.match(list, /head\('Templates', templates\.length\)/);
  assert.ok(list.indexOf("head('Site')") < list.indexOf("head('Templates'"));
  const main = read('src/editor/main.js');
  assert.match(main, /kind: 'item-template'/);
  assert.match(main, /item\.kind === 'item-template'\) return void bridge\.navigate\(item\.path\)/);
  // the panel: Widgets and Properties tabs, chips (formats) on each bound value
  const panel = read('src/editor/svelte/TemplatePanel.svelte');
  assert.match(panel, /\['widgets', 'Widgets'\],\s*\['properties', 'Properties'\]/);
  assert.match(panel, /<ListField/);
  // the template's own settings, always shown (no shift)
  assert.match(panel, /label="Link: whole item opens the item’s page"/);
  assert.doesNotMatch(panel, /Photo first|photoFirst/);
  assert.match(panel, /set\('\/link', v\)/);
  // each widget's place on the template's grid, as a page widget's
  assert.match(
    panel,
    /<TemplateGridRows \{file\} b=\{`\/widgets\/\$\{i\}`\} \{w\} \{widgets\} \{set\} \/>/,
  );
  const rows = read('src/editor/svelte/TemplateGridRows.svelte');
  for (const l of [
    'Column',
    'Columns',
    'Row',
    'Height',
    'Ratio',
    'Rows',
    'Follows',
    'Rows between',
    'Layer',
    'Own phone layout',
    'Phone column',
    'Phone columns',
    'Phone row',
  ])
    assert.match(rows, new RegExp(`label="${l}"`), l);
  assert.match(rows, /Off: the desktop layout, scaled down/);
  assert.doesNotMatch(panel + rows, /Side by side|Fill the space|Photo width|On a phone/);
  assert.match(panel, /formats/);
  assert.match(panel, /renameProperty\(widgets, old, to\)/);
  assert.doesNotMatch(panel, /(label|help|title|placeholder)="[^"]*\bfield/i);
  assert.match(
    read('src/editor/svelte/ContentPanel.svelte'),
    /<TemplatePanel \{live\} \{bridge\} \/>/,
  );
  // Edit template: always laid out, hidden while a preset is picked
  const lead = read('src/editor/svelte/ListLead.svelte');
  assert.match(lead, /class=\{\['ll__edit', !isOwnTemplate && 'is-hidden'\]\}/);
  assert.match(lead, /ui\.openTemplate\?\.\(templateId\)/);
  assert.match(lead, /\.ll__edit\.is-hidden/);
  // the dev server serves the preview
  assert.match(
    read('scripts/vite-plugin-static-site.mjs'),
    /templatePreview\(content, templateOfPath\(pathname\)\)/,
  );
});

test('a line edited in the chips box keeps its bold, italic and links', () => {
  const prev = [
    { t: 'Shot by ' },
    { t: 'Eeliya', marks: ['b'] },
    { t: ' in ' },
    { property: 'place', marks: ['i'] },
    { t: ' now', link: { href: '/about/' } },
  ];
  const plain = (runs) => runs.map(({ t, property }) => (property ? { property } : { t }));
  // nothing changed: the same runs
  assert.deepEqual(keepMarks(prev, plain(prev)), prev);
  // text typed inside the bold word: bold too; the rest as it was
  const typed = keepMarks(prev, [
    { t: 'Shot by EeliyaX in ' },
    { property: 'place' },
    { t: ' now' },
  ]);
  assert.deepEqual(typed, [
    { t: 'Shot by ' },
    { t: 'EeliyaX', marks: ['b'] },
    { t: ' in ' },
    { property: 'place', marks: ['i'] },
    { t: ' now', link: { href: '/about/' } },
  ]);
  // text typed at the start, then a chip removed: the marks after it kept
  // (each keystroke is one edit)
  const hi = keepMarks(prev, [
    { t: 'Hi Shot by Eeliya in ' },
    { property: 'place' },
    { t: ' now' },
  ]);
  const cut = keepMarks(hi, [{ t: 'Hi Shot by Eeliya in  now' }]);
  assert.deepEqual(
    cut.find((r) => r.t === 'Eeliya'),
    { t: 'Eeliya', marks: ['b'] },
  );
  assert.deepEqual(cut.at(-1), { t: ' now', link: { href: '/about/' } });
  // no marks before: plain runs
  assert.deepEqual(keepMarks([{ t: 'a' }], [{ t: 'ab' }]), [{ t: 'ab' }]);
  assert.match(
    read('src/editor/svelte/TemplatePanel.svelte'),
    /keepMarks\(body\[j\]\.text, runsOf\(value\)\)/,
  );
});

test('text under 11 px: a warning line under the widget in the template editor (no minimum size)', async () => {
  const { MIN_TEXT_PX, sizeLine, textSizes } = await import('../src/editor/lib/small-text.js');
  const { parseHTML } = await import('linkedom');
  assert.equal(MIN_TEXT_PX, 11);
  assert.equal(sizeLine(undefined), '');
  assert.equal(sizeLine(14), 'Text 14 px here');
  assert.equal(sizeLine(9.5), 'Text 9.5 px here: under 11 px, hard to read');
  const { document } = parseHTML(
    '<div class="sec sec--item"><div class="wgt" data-tw="w-aaaa"><p style="font-size:9px">01</p></div><div class="wgt" data-tw="w-bbbb"><h2 style="font-size:20px">Title <small style="font-size:12px">x</small></h2></div><div class="wgt" data-tw="w-cccc"><img alt=""></div></div>',
  );
  document.defaultView.getComputedStyle = (el) => ({ fontSize: el.style?.fontSize || '16px' });
  assert.deepEqual(textSizes(document), { 'w-aaaa': 9, 'w-bbbb': 12 });
  assert.deepEqual(textSizes(null), {});
  const panel = read('src/editor/svelte/TemplatePanel.svelte');
  assert.ok(panel.includes('data-text-size') && panel.includes('tp__size--warn'));
  assert.match(panel, /\.tp__size \{[^}]*height: 16px/); // one line always: no shift
});
