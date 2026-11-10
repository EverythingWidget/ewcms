// List step 7: site-wide item templates (content/templates/t-….json, config.template "t-…").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onGrid } from './grid-helper.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { warnings } from './test-layout.mjs';
import { loadContent, readContentDir } from './content.mjs';
import { templatesOp, editableFiles } from './editor-server.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { newWidget, newSection, renderSections } from '../src/site/layout/index.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import { checkContent } from '../src/site/validate.js';
import { cloneTemplate, presetWidgets } from '../src/site/widgets/list/presets.js';
import { contentPath, isContentFile, templateFile, templateIdOf } from '../src/site/files.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const base = loadContent(SITE_A);
const people = base.sources.people;
const F = 'pages/test/index.json';
let n = 0;

function list(config = {}, more = {}, content = base) {
  const { routes } = buildRoutes(content);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = { ...w, id: `w-lt${String(++n).padStart(3, '0')}`, ...more };
  widget.config = { ...w.config, ...config };
  const ctx = { ...content, route: page, routes, curtains: {} };
  const [html, seen] = warnings(() => renderSections(ctx, page, F, [newSection(ids, [widget])]));
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return { el: document.querySelector('.wgt--list'), seen };
}
const texts = (root, sel) => [...root.querySelectorAll(sel)].map((e) => e.textContent.trim());
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
    { type: 'text', body: [{ style: 'label', text: [{ property: 'location' }] }] },
  ]),
  ...more,
});
const withTemplate = (tpl, id = 't-ab12') => ({
  ...base,
  templates: { ...base.templates, [id]: tpl },
});

test('template files: "templates/t-<id>.json", a content file, its path next to the language folder', () => {
  assert.equal(templateFile('t-ab12'), T);
  assert.equal(templateIdOf(T), 't-ab12');
  assert.equal(templateIdOf('templates/card.json'), null); // no t- prefix
  assert.equal(templateIdOf('pages/t-ab12.json'), null);
  assert.ok(isContentFile(T));
  assert.match(contentPath(T), /^content\/templates\/t-ab12\.json$/);
});

test('a valid template passes; an invalid one is rejected with a clear message', () => {
  assert.deepEqual(checkContent(T, card()), []);
  const msg = (d) => checkContent(T, d).join('; ');
  assert.match(msg(card({ kind: 'page' })), /"kind" must be "template"/);
  assert.match(msg(card({ label: '' })), /"label" must be a text/);
  assert.match(msg(card({ basedOn: 'preset:huge' })), /"basedOn" must be a preset/);
  assert.match(msg(card({ widgets: onGrid([]) })), /"widgets" must be a list of widgets/);
  assert.match(msg(card({ extra: 1 })), /"extra" is not a template key/);
  // only the registry's widgets
  assert.match(
    msg(card({ widgets: onGrid([{ type: 'carousel' }]) })),
    /"carousel" is not a widget type/,
  );
  assert.match(
    msg(card({ widgets: onGrid([{ type: 'panels' }]) })),
    /Photo panels \("panels"\) is gone/,
  );
  // no source (the List gives each copy its item), no nested List yet, no page place
  assert.match(
    msg(card({ widgets: [{ type: 'text', source: { mode: 'all', from: 'people' } }] })),
    /no "source" in a template/,
  );
  assert.match(
    msg(card({ widgets: [{ type: 'list' }] })),
    /widgets\.0\.source must be \{ "mode": "property"/,
  );
  // on the grid, as a page widget: an id, a layout; its layer is "layer" (not "z")
  assert.match(msg(card({ widgets: [{ type: 'text' }] })), /widgets\.0: "id" must be a widget id/);
  assert.match(
    msg(card({ widgets: [{ type: 'text', id: 'w-aaaa', z: 2 }] })),
    /"z" is a page widget's: a template's is "layer"/,
  );
  assert.match(
    msg(
      card({
        widgets: [{ type: 'text', id: 'w-aaaa', layout: { base: { col: 1, span: 200, row: 0 } } }],
      }),
    ),
    /layout\.base/,
  );
  assert.match(
    msg(
      card({
        widgets: [
          {
            type: 'text',
            id: 'w-aaaa',
            layout: { base: { col: 1, row: 1, link: { to: 'w-zzzz', gap: 2 } } },
          },
        ],
      }),
    ),
    /w-zzzz/,
  );
  assert.match(
    msg(card({ photoFirst: true })),
    /"photoFirst" is gone: the photo's place is its own "layout"/,
  );
  assert.match(
    msg(card({ widgets: [{ type: 'text', itemLink: true }] })),
    /itemLink: only a button/,
  );
});

test('Duplicate preset: the clone is the preset as it shows now, and keeps "basedOn"', () => {
  const tpl = cloneTemplate(base, 'people', 'preset:card', { properties: { photo: 'cover' } });
  assert.equal(tpl.basedOn, 'preset:card');
  assert.equal(tpl.kind, 'template');
  assert.equal(tpl.label, 'Card copy');
  assert.deepEqual(checkContent(T, tpl), []);
  // the same widgets as the preset, markers resolved into plain {property} parts
  const preset = presetWidgets('preset:card', base, 'people', { properties: { photo: 'cover' } });
  assert.deepEqual(
    tpl.widgets.map((w) => w.type),
    preset.map((w) => w.type),
  );
  assert.deepEqual(tpl.widgets[0].src, [{ property: 'cover' }]);
  assert.ok(tpl.widgets.every((w) => !('facts' in w) && !('handmadeCount' in w)));
  // a clone of a template keeps that template's id as its from
  const again = cloneTemplate(withTemplate(card()), 'people', 't-ab12');
  assert.equal(again.basedOn, 't-ab12');
  assert.deepEqual(again.widgets, card().widgets);
  // a hand-made Panel's count is its {count} {unit}
  const panel = cloneTemplate(base, '', 'preset:panel', { handmade: true });
  assert.deepEqual(panel.widgets.at(-1).body[0].text, [
    { property: 'count' },
    { t: ' ' },
    { property: 'unit' },
  ]);
});

test('a List with config.template "t-…" renders the template, from a source and hand-made', () => {
  const ctx = withTemplate(card());
  const { el, seen } = list({ template: 't-ab12' }, {}, ctx);
  const items = el.querySelectorAll('[data-list-item]');
  assert.equal(items.length, people.length);
  assert.deepEqual(
    texts(el, '[data-list-item] .li__title'),
    people.map((p) => p.title),
  );
  assert.ok(items[0].querySelector('.li__photo img'));
  // its look is its own style alone: "basedOn" is only a note (a Row basedOn changes nothing)
  assert.ok(items[0].classList.contains('li--template'));
  const row = list({ template: 't-ab12' }, {}, withTemplate(card({ basedOn: 'preset:row' }))).el;
  assert.ok(!row.querySelector('.li--beside'));
  assert.equal(row.querySelector('.li').getAttribute('style'), null);
  assert.ok(!seen.some((w) => /missing/.test(w)), seen.join());
  // no mapping rows for a template (it names its properties itself)
  assert.deepEqual(
    WIDGET_TYPES.list.mapping(ctx, { source: { from: 'people' }, config: { template: 't-ab12' } }),
    [],
  );
  // hand-made: the same template, filled from config.items
  const hand = list(
    {
      handmade: true,
      template: 't-ab12',
      items: [{ title: 'People', photo: people[0].cover, source: 'people', unit: 'models' }],
    },
    { source: undefined },
    ctx,
  ).el;
  assert.deepEqual(texts(hand, '[data-list-item] .li__title'), ['People']);
});

test('no config.template: the preset as now; a missing "t-…" warns and shows Card', () => {
  const none = list({ template: undefined }).el;
  assert.ok(none.querySelector('[data-list-item]').classList.contains('li--card'));
  const { el, seen } = list({ template: 't-zzzz' });
  assert.ok(el.querySelector('[data-list-item]').classList.contains('li--card'));
  assert.ok(
    seen.some((w) => /template "t-zzzz" is missing/.test(w)),
    seen.join(),
  );
  // config.template shape: a preset or a t- id
  const w = { ...newWidget('list', new Set()), id: 'w-tpl1' };
  assert.deepEqual(WIDGET_TYPES.list.check({ ...w, config: { template: 't-ab12' } }), []);
  assert.match(
    WIDGET_TYPES.list.check({ ...w, config: { template: 'cards' } }).join(),
    /config\.template must be a preset/,
  );
  // a page with a List on a site template is valid content (the setting takes "t-…" too)
  const page = {
    version: 1,
    kind: 'page',
    id: 'pg-tpl1',
    sections: [newSection(new Set(), [{ ...w, config: { ...w.config, template: 't-ab12' } }])],
  };
  assert.deepEqual(checkContent('pages/x/index.json', page), []);
});

test('templatesOp: a new t- file next to the language folder, loaded again on rebuild', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-tpl-'));
  try {
    fs.cpSync(SITE_A, root, {
      recursive: true,
      filter: (p) => !/[\\/](dist|\.generated)([\\/]|$)/.test(p),
    });
    const { version: _v, ...data } = cloneTemplate(base, 'people', 'preset:card'); // eslint-disable-line no-unused-vars
    const seq = [0.1, 0.2, 0.3, 0.4];
    let i = 0;
    const res = templatesOp(
      root,
      { op: 'add', data },
      () => {},
      () => seq[i++ % 4],
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { id, file } = res.body;
    assert.match(id, /^t-[a-z0-9]{4}$/);
    assert.ok(fs.existsSync(path.join(root, 'content', 'templates', `${id}.json`)));
    // a rebuild reads it: the loader, the editor's files, the List
    assert.ok(file in readContentDir(root));
    assert.ok(editableFiles(root).has(file));
    const again = loadContent(root);
    assert.equal(again.templates[id].basedOn, 'preset:card');
    const { el } = list({ template: id }, {}, again);
    assert.equal(el.querySelectorAll('[data-list-item]').length, people.length);
    // a bad one is not written
    const bad = templatesOp(root, { op: 'add', data: { ...data, widgets: [{ type: 'list' }] } });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /Not added/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the panel: a Template picker and Duplicate preset, in both modes, no shift', () => {
  const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const lead = read('src/editor/svelte/ListLead.svelte');
  assert.match(lead, /data-template-picker/);
  assert.match(lead, /label="Template"/);
  // Duplicate (a preset) / Duplicate template, both labels in one cell: no shift
  assert.match(lead, />Duplicate<\/span/);
  assert.match(lead, />Duplicate template<\/span/);
  assert.match(lead, /\.ll__dup \{\s*display: inline-grid;\s*> span \{\s*grid-area: 1 \/ 1;/);
  // the switch saved at once unless the page has other unsaved edits; else the note
  assert.match(lead, /const pending = live\.store\.dirtyFiles\(\)\.includes\(g\.file\)/);
  assert.match(lead, /await saveDev\(sent\);\s*live\.store\.markSaved\(\[g\.file\], sent\)/);
  assert.match(lead, /Saved as template \$\{res\.id\}/);
  assert.match(lead, /'ll__note', !note && 'is-hidden'/);
  assert.match(lead, /templatesOp\(\{ op: 'add'/);
  // the template picker is above Source / Custom, shared by both modes
  assert.ok(lead.indexOf('data-template-picker') < lead.indexOf('ll__source-head'));
  assert.match(lead, /class="ll__actions"/);
  // the generic settings leave it to ListLead
  assert.equal(WIDGET_TYPES.list.config.find((c) => c.key === 'template').lead, true);
  assert.match(read('src/editor/svelte/GroupFields.svelte'), /!c\.lead &&/);
});

test('a copied facts line drops the separator of an empty fact at render', () => {
  const tpl = cloneTemplate(base, 'people', 'preset:card', { properties: { photo: 'cover' } });
  const facts = tpl.widgets.find((w) => w.role === 'facts');
  assert.equal(facts.join, ' · ');
  assert.deepEqual(checkContent(T, tpl), []);
  // one person without a role: "Amsterdam", not " · Amsterdam"
  const ctx = withTemplate(tpl);
  const gone = {
    ...ctx,
    sources: { ...ctx.sources, people: people.map((p, i) => (i ? p : { ...p, role: '' })) },
  };
  const { el } = list({ template: 't-ab12' }, {}, gone);
  const lines = texts(el, '[data-list-item] .li__facts');
  assert.equal(lines[0], people[0].location);
  assert.equal(lines[1], `${people[1].role} · ${people[1].location}`);
  assert.match(
    checkContent(T, { ...tpl, widgets: [{ type: 'photo', join: ' · ' }] }).join(),
    /join: only a text/,
  );
});
