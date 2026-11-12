// The preview updates in place: only an edit that changes the routes or the menu reloads it
// (src/editor/lib/needs-reload.js); an item template's or a source's sections are rendered
// again where they show (src/site/widgets/list/template-uses.js), the template editor's
// preview too (renderOp, swapSections); Save reloads only when needsReload says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { onGrid, template } from './grid-helper.mjs';
import { readContentFiles, renderOp } from './editor-server.mjs';
import * as render from '../src/site/render.js';
import {
  ANIMATIONS,
  FOOTER,
  NAV,
  PHOTOS,
  REDIRECTS,
  SITE,
  STRINGS,
  pageFile,
  schemaFile,
  sourceFile,
  templateFile,
} from '../src/site/files.js';
import { needsReload, routesFile, routesKey } from '../src/editor/lib/needs-reload.js';
import { sectionsUsing, usesOf } from '../src/site/widgets/list/template-uses.js';
import { PREVIEW_PAGE, templatePreviewPath } from '../src/site/widgets/list/template-preview.js';
import { swapSections } from '../src/editor/layout-sync.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const files = readContentFiles(SITE_A);
const people = sourceFile('people');

test('needsReload: the file decides; a source, schema or page only when the routes changed', () => {
  // in place, always
  for (const f of [templateFile('t-ab12'), FOOTER, ANIMATIONS, REDIRECTS])
    assert.equal(needsReload([f], { routes: true }), false, f);
  // the menu and what every page shows around its sections: always
  for (const f of [NAV, SITE, PHOTOS, STRINGS]) assert.equal(needsReload([f]), true, f);
  // routes files: as the routes say
  for (const f of [people, schemaFile('people'), pageFile('about'), pageFile('home')]) {
    assert.ok(routesFile(f), f);
    assert.equal(needsReload([f]), false, f);
    assert.equal(needsReload([f], { routes: true }), true, f);
  }
  // a file the rule doesn't know: a reload is always right
  assert.equal(needsReload(['settings/something-new.json']), true);
  // one of several is enough
  assert.equal(needsReload([templateFile('t-ab12'), NAV]), true);
  assert.equal(needsReload([]), false);
});

test("routesKey: items added, removed or moved, slugs and the menu's names change it; other fields don't", () => {
  const key = routesKey(files);
  const edit = (fn) => {
    const next = structuredClone(files);
    fn(next);
    return routesKey(next);
  };
  const items = (f) => f[people].items;
  // a field no route or menu shows: in place
  assert.equal(
    edit((f) => (items(f)[0].body = 'Another text')),
    key,
  );
  assert.equal(
    edit((f) => (items(f)[0].role = 'Photographer')),
    key,
  );
  // an item added or removed, a slug, the order
  assert.notEqual(
    edit((f) => items(f).push({ ...items(f)[0], id: 'p-new1', slug: 'new-one', title: 'New' })),
    key,
  );
  assert.notEqual(
    edit((f) => items(f).pop()),
    key,
  );
  assert.notEqual(
    edit((f) => (items(f)[0].slug = 'someone-else')),
    key,
  );
  assert.notEqual(
    edit((f) => items(f).reverse()),
    key,
  );
  // the menu lists people (its dropdown shows their names and covers): a name is a menu change
  assert.notEqual(
    edit((f) => (items(f)[0].title = 'Noor V.')),
    key,
  );
  // ... not when the menu doesn't list the source
  const unlisted = structuredClone(files);
  unlisted[NAV].header = unlisted[NAV].header.map(({ children: _c, items: _i, ...rest }) => rest);
  const before = routesKey(unlisted);
  unlisted[people].items[0].title = 'Noor V.';
  assert.equal(routesKey(unlisted), before);
  // a page that has no page of its own any more (ownPage): its 302 is a route change
  assert.notEqual(
    edit((f) => (f[pageFile('photography')].ownPage = false)),
    key,
  );
});

const card = (more = {}) =>
  template({
    name: 'Card',
    preview: { from: 'people', columns: 3 },
    widgets: onGrid([
      { type: 'photo', role: 'photo', src: [{ property: 'cover' }] },
      { type: 'text', role: 'title', body: [{ style: 'heading', text: [{ property: 'title' }] }] },
    ]),
    ...more,
  });
const list = (id, config, source) => ({ id, type: 'list', config, ...(source ? { source } : {}) });

test('sectionsUsing: the sections whose Lists use a template (through another template too) or a source', () => {
  const templates = {
    't-ab12': card(),
    // a template with an inner List of t-ab12
    't-cd34': template({ name: 'Group', widgets: [list('w-in', { template: 't-ab12' })] }),
  };
  const doc = {
    sections: [
      {
        id: 's-one',
        widgets: [list('w-a', { template: 't-ab12' }, { mode: 'all', from: 'people' })],
      },
      {
        id: 's-two',
        widgets: [list('w-b', { template: 't-cd34' }, { mode: 'all', from: 'places' })],
      },
      { id: 's-three', widgets: [{ id: 'w-t', type: 'text', body: [] }] },
      {
        id: 's-four',
        widgets: [list('w-c', { template: 'preset:card' }, { mode: 'all', from: 'projects' })],
      },
    ],
  };
  assert.deepEqual(sectionsUsing(doc, { templates: ['t-ab12'] }, templates), ['s-one', 's-two']);
  assert.deepEqual(sectionsUsing(doc, { templates: ['t-cd34'] }, templates), ['s-two']);
  assert.deepEqual(sectionsUsing(doc, { sources: ['projects'] }, templates), ['s-four']);
  assert.deepEqual(sectionsUsing(doc, { sources: ['places'] }, templates), ['s-two']);
  assert.deepEqual(sectionsUsing(doc, {}, templates), []);
  assert.deepEqual(sectionsUsing(null, { templates: ['t-ab12'] }), []);
  const uses = usesOf(doc.sections[1].widgets, templates);
  assert.deepEqual([...uses.templates].sort(), ['t-ab12', 't-cd34']);
});

test("the template editor's preview: its one List rendered again from the drafts (renderOp)", () => {
  const T = templateFile('t-ab12');
  const session = 'tab-1';
  const drafts = { [session]: { [T]: card() } };
  const path = templatePreviewPath('t-ab12');
  const file = pageFile(PREVIEW_PAGE);
  const r = renderOp(render, SITE_A, drafts, { path, file, ids: ['s-tplp'], session });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.html['s-tplp'], /data-sec="s-tplp"/);
  assert.match(r.body.html['s-tplp'], /sec--item/);
  // the template edited: the render shows the edit
  drafts[session][T] = card({ clickable: false });
  const again = renderOp(render, SITE_A, drafts, { path, file, ids: ['s-tplp'], session });
  assert.doesNotMatch(again.body.html['s-tplp'], /<a class="li/);
  // another page's file, a template that doesn't exist: refused
  assert.equal(
    renderOp(render, SITE_A, drafts, { path, file: pageFile('about'), ids: [], session }).status,
    400,
  );
  assert.equal(
    renderOp(render, SITE_A, drafts, {
      path: templatePreviewPath('t-zz99'),
      file,
      ids: [],
      session,
    }).status,
    400,
  );
  // path detection must not depend on the Vite-loaded render module exporting
  // templateOfPath (a stale SSR graph after 951af75 left it missing: changing
  // preview.columns then toasted "Preview: must be an object, not a undefined")
  const stale = { renderRouteSections: render.renderRouteSections };
  const viaStale = renderOp(stale, SITE_A, drafts, { path, file, ids: ['s-tplp'], session });
  assert.equal(viaStale.status, 200, JSON.stringify(viaStale.body));
  assert.match(viaStale.body.html['s-tplp'], /data-cols="3"/);
  drafts[session][T] = card({ preview: { from: 'people', columns: 4 } });
  const cols = renderOp(stale, SITE_A, drafts, { path, file, ids: ['s-tplp'], session });
  assert.equal(cols.status, 200, JSON.stringify(cols.body));
  assert.match(cols.body.html['s-tplp'], /data-cols="4"/);
});

test('swapSections: a page that is no file (the template preview) swaps each section in place', () => {
  const { document } = parseHTML(
    '<div data-router-view data-page-file="pages/__template/index.json"><section data-sec="s-tplp">old</section><section data-sec="s-x">x</section></div>',
  );
  const view = document.querySelector('[data-router-view]');
  swapSections(
    document,
    { current: {} },
    { 's-tplp': '<section data-sec="s-tplp">new</section>' },
    view,
  );
  assert.equal(view.querySelector('[data-sec="s-tplp"]').textContent, 'new');
  assert.equal(view.children.length, 2);
  assert.equal(view.firstElementChild.dataset.sec, 's-tplp');
});

test('the editor: in place by default, a reload only by the rule, on Save too', () => {
  const main = read('src/editor/main.js');
  // one rule, no hand-set reload flags
  assert.match(main, /reload: needsReload\(files, \{ routes, site \}\)/);
  assert.doesNotMatch(main, /refreshPending|refresh: /);
  assert.doesNotMatch(main, /files\.some\(templateIdOf\)\s*,?\s*\n?\s*sources:/);
  // an item template's or a source's sections: rendered again in place after the draft
  assert.match(
    main,
    /else if \(uses\.templates\.length \|\| uses\.sources\.length\) renderUses\(uses\)/,
  );
  assert.match(main, /sectionsUsing\(doc, \{ templates, sources \}, content\.templates\)/);
  // Save: no reload unless the rule (or a moved slug: navigate)
  assert.match(
    main,
    /if \(moved\) bridge\.navigate\(moved\);\s*else if \(reload && bridge\.path\(\)\) bridge\.reload\(\);/,
  );
  // menu edits carry no reload flag of their own (the rule covers settings/nav.json)
  for (const f of ['PagesList', 'AddPageModal', 'HeaderPart'])
    assert.doesNotMatch(read(`src/editor/svelte/${f}.svelte`), /set\(NAV,[^;]*structure: true/, f);
});
