// List step 8: the template editor (Pages > Site > Templates, content/templates/t-….json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onGrid, template } from './grid-helper.mjs';
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
  previewColumns,
  previewWithColumns,
} from '../src/site/widgets/list/template-preview.js';
import {
  keepMarks,
  moveStack,
  addAt,
  removeWidget,
  newStackWidget,
  runsOf,
  stackName,
  templateProperties,
} from '../src/editor/lib/item-template.js';
import { entryFor } from '../src/editor/lib/page-tree.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const base = loadContent(SITE_A);
const T = 'templates/t-ab12.json';
const card = (more = {}) =>
  template({
  name: 'People card',
  basedOn: 'preset:card',
  clickable: true,
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
  const from = withTemplate(card({ preview: { from: 'people' } }));
  assert.equal(sampleSource(from, from.templates['t-ab12']), 'people');
  const { route, content } = templatePreview(from, 't-ab12');
  assert.equal(route.path, '/__template/t-ab12/');
  const { document } = parseHTML(`<body>${renderRoute(route, content, { editable: true }).body}`);
  const items = document.querySelectorAll('.li');
  assert.equal(items.length, 1);
  if (name) assert.match(items[0].textContent, new RegExp(String(name).slice(0, 6)));
  // no source (or one without items): the hand-made sample
  for (const tpl of [card(), card({ preview: { from: 'nope' } })]) {
    const p = templatePreview(withTemplate(tpl), 't-ab12');
    const html = renderRoute(p.route, p.content, { editable: true }).body;
    assert.match(html, /Sample item/);
  }
  // not a template: none (the dev server's 404)
  assert.equal(templatePreview(base, 't-none'), null);
  assert.equal(templatePreview(base, 'about'), null);
  // the content given isn't changed (the page is the preview's own)
  assert.equal(from.pages.__template, undefined);
  // its columns: the item as wide as in a List of that many (1 when left out)
  assert.equal(previewColumns(card()), 1);
  assert.equal(previewColumns(card({ preview: { columns: 6 } })), 6);
  assert.equal(previewColumns(card({ preview: { columns: 9 } })), 1);
  // 1, the default, is left out; an empty preview too
  assert.deepEqual(previewWithColumns({ from: 'people', columns: 3 }, 4), {
    from: 'people',
    columns: 4,
  });
  assert.deepEqual(previewWithColumns({ from: 'people', columns: 3 }, 1), { from: 'people' });
  assert.equal(previewWithColumns({ columns: 3 }, 1), undefined);
  assert.equal(previewWithColumns(undefined, 1), undefined);
  assert.deepEqual(previewWithColumns(undefined, 2), { columns: 2 });
  for (const n of [1, 6]) {
    const p = templatePreview(withTemplate(card({ preview: { from: 'people', columns: n } })), 't-ab12');
    const html = renderRoute(p.route, p.content, { editable: true }).body;
    assert.match(html, new RegExp(`--list-cols:${n}[;"]`));
    assert.equal(parseHTML(`<body>${html}`).document.querySelectorAll('.li').length, 1);
  }
});

test('"basedOn" names what it was copied from; "from" is no template key', () => {
  assert.match(
    checkContent(T, { ...card(), basedOn: undefined, from: 'preset:card' }).join(),
    /"from" is not a template key/,
  );
  assert.equal(cloneTemplate(base, 'people', 'preset:card').basedOn, 'preset:card');
});

test('"preview.from" (where its sample comes from) and its columns; Duplicate records them', () => {
  assert.deepEqual(checkContent(T, card({ preview: { from: 'people' } })), []);
  assert.match(
    checkContent(T, card({ preview: { from: 3 } })).join(),
    /"preview\.from" must be a source name/,
  );
  assert.deepEqual(cloneTemplate(base, 'people', 'preset:card').preview, { from: 'people' });
  assert.equal(cloneTemplate(base, '', 'preset:panel', { handmade: true }).preview, undefined);
  // a copy of a template keeps its preview
  const again = cloneTemplate(
    withTemplate(card({ preview: { from: 'people', columns: 4 } })),
    '',
    't-ab12',
  );
  assert.deepEqual(again.preview, { from: 'people', columns: 4 });
});

test('the stack: add, remove, reorder; every new widget passes the validator', () => {
  const w = card().sections[0].widgets;
  assert.deepEqual(
    moveStack(w, 0, 2).map((x) => x.role),
    ['title', 'facts', 'photo'],
  );
  for (const type of ['text', 'photo', 'button']) {
    // Add: on the grid, its own id, full width, following the last widget
    const next = card({ widgets: addAt(w, newStackWidget(type, 'title')) });
    assert.deepEqual(checkContent(T, next), [], type);
    const added = next.sections[0].widgets.at(-1);
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

test('the binds a template uses are listed once, first use first', () => {
  const w = card().sections[0].widgets;
  assert.deepEqual(templateProperties(w), ['cover', 'title', 'location']);
  // a format is just a bind (no property rename in the editor)
  const f = [
    { type: 'text', body: [{ style: 'label', text: [{ property: 'd', format: 'year' }] }] },
  ];
  assert.deepEqual(templateProperties(f), ['d']);
  assert.equal(fs.existsSync(new URL('../src/editor/lib/item-template.js', import.meta.url)), true);
  assert.doesNotMatch(read('src/editor/lib/item-template.js'), /renameProperty/);
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
  // the panel: Widgets and Settings tabs, chips (formats) on each bound value
  const panel = read('src/editor/svelte/TemplatePanel.svelte');
  assert.match(panel, /\['widgets', 'Widgets'\],\s*\['settings', 'Settings'\]/);
  assert.doesNotMatch(panel, /'properties'|Style tab|<ListField|<TemplateGridRows/);
  assert.match(panel, /<SectionCard/);
  assert.match(panel, /<SectionToolbar addOnly/);
  assert.match(panel, /<WidgetsModal/);
  // Settings: Name, Whole item clickable, the preview line (not on Widgets). Columns
  // is a pill above the preview frame (TemplateCols.svelte), not a Settings field.
  assert.match(panel, /label="Whole item clickable"/);
  assert.match(panel, /The whole item opens the item’s page/);
  assert.match(panel, /Its name in a List’s Template picker/);
  assert.match(panel, /Preview: the first item of /);
  assert.doesNotMatch(panel, /Photo first|photoFirst/);
  assert.match(panel, /set\('\/clickable', v\)/);
  assert.match(panel, /set\('\/name', v\)/);
  assert.doesNotMatch(panel, /label="Columns"\s+type="seg"/);
  assert.doesNotMatch(panel, /preview\/columns/);
  const cols = read('src/editor/svelte/TemplateCols.svelte');
  const app = read('src/editor/svelte/App.svelte');
  assert.match(app, /<TemplateCols \{live\} \/>/);
  // reserved row: the frame does not shift when opening or leaving a template
  assert.match(app, /grid-template-rows: var\(--size-control\) minmax\(0, 1fr\)/);
  assert.match(cols, /label="Columns"\s+type="seg"/);
  assert.match(cols, /type="seg"\s+bare/);
  assert.match(cols, /previewWithColumns/);
  assert.match(cols, /edit=\{`\$\{file\}#\/preview\/columns`\}/);
  assert.match(panel, /setWidgets = \(next\) => set\(ITEM_WIDGETS, next, true\)/);
  assert.match(panel, /tab === 'settings'/);
  assert.match(panel, /formats/);
  assert.doesNotMatch(panel, /renameProperty/);
  assert.doesNotMatch(panel, /(label|help|title|placeholder)="[^"]*\bfield/i);
  assert.equal(
    fs.existsSync(new URL('../src/editor/svelte/TemplateGridRows.svelte', import.meta.url)),
    false,
  );
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
    /keepMarks\(line\.text, runsOf\(value\)\)/,
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

test('the template panel hides what a template section does not have', () => {
  const card = read('src/editor/svelte/SectionCard.svelte');
  assert.match(card, /section: sectionProp/);
  assert.match(card, /onreorder/);
  const bar = read('src/editor/svelte/SectionToolbar.svelte');
  assert.match(bar, /addOnly = false/);
  assert.match(bar, /{#if addOnly}/);
  const overlay = read('src/editor/overlay.js');
  assert.match(overlay, /data-tw="\$\{CSS\.escape\(id\)\}"/);
  assert.match(overlay, /ui\.target\?\.kind === 'item-template'/);
  // the Grid Engine: its item's own widgets dragged, resized and linked as a page's
  assert.doesNotMatch(overlay, /select only: drag \/ resize write-back is not wired/);
  assert.match(overlay, /const top = widgetAt\(hit\)/);
});


test('a template is one section: the editor edits its file, its widgets at /sections/0/widgets', async () => {
  const { targetFile } = await import('../src/editor/layout-sync.js');
  assert.equal(targetFile({ kind: 'item-template', id: 't-ab12' }, null), T);
  assert.equal(targetFile({ kind: 'part', id: 'header' }, null), '');
  const { ITEM_WIDGETS, itemSection, itemWidgets } = await import(
    '../src/site/widgets/list/item-grid.js'
  );
  assert.equal(ITEM_WIDGETS, '/sections/0/widgets');
  assert.equal(itemSection(card()).id, 's-item');
  assert.equal(itemWidgets(card()).length, 3);
  assert.deepEqual(itemWidgets({ widgets: [{ type: 'text' }] }), []); // the old shape: none
  assert.doesNotMatch(read('src/site/widgets/list/item-grid.js'), /asPageWidget/);
});

test("an item: its section's custom height and its widgets' layer, as a page section's", () => {
  const tpl = card({
    section: { height: 'custom', rows: { min: 300 } },
    preview: { from: 'people' },
  });
  tpl.sections[0].widgets[1].layer = 2;
  assert.deepEqual(checkContent(T, tpl), []);
  const p = templatePreview(withTemplate(tpl), 't-ab12');
  const html = renderRoute(p.route, p.content, { editable: true }).body;
  const { document } = parseHTML(`<body>${html}`);
  const sec = document.querySelector('.sec--item');
  assert.match(sec.getAttribute('style'), /--rows:300;--mrows:150;--minrows:300;--mminrows:150/);
  assert.match(document.querySelector('[data-tw="w-g002"]').getAttribute('style'), /--z:2/);
  // fit (left out): its rows, no minimum
  const fit = templatePreview(withTemplate(card()), 't-ab12');
  assert.doesNotMatch(renderRoute(fit.route, fit.content, { editable: true }).body, /--minrows/);
});
