// The preview updates in place: only an edit that changes the routes or the menu reloads it
// (src/editor/lib/needs-reload.js); an item template's or a source's sections are rendered
// again where they show (src/widgets/list/template-uses.js), the template editor's
// preview too (renderOp, swapSections); Save reloads only when needsReload says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { onGrid, template } from '../scripts/grid-helper.mjs';
import { renderOp } from '../src/editor/server/editor-server.mjs';
import { readContentFiles } from '../src/editor/server/local-data-layer.mjs';
import * as render from '../src/render/render.js';
import {
  ANIMATIONS,
  FOOTER,
  HEADER,
  PHOTOS,
  REDIRECTS,
  SITE,
  STRINGS,
  pageFile,
  schemaFile,
  sourceFile,
  templateFile,
} from '../src/render/files.js';
import { needsReload, routesFile, routesKey } from '../src/editor/lib/needs-reload.js';
import { sectionsUsing, usesOf } from '../src/widgets/list/template-uses.js';
import { PREVIEW_PAGE, templatePreviewPath } from '../src/widgets/list/template-preview.js';
import {
  markRendered,
  patchTexts,
  swapSections,
  swapWidget,
  syncLayout,
} from '../src/editor/layout-sync.js';
import { createStore } from '../src/editor/store.js';
import { SITE_A } from './fixtures/index.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const files = readContentFiles(SITE_A);
const people = sourceFile('people');

test('needsReload: the file decides; a source, schema or page only when the routes changed', () => {
  // in place, always
  for (const f of [templateFile('t-ab12'), FOOTER, ANIMATIONS, REDIRECTS])
    assert.equal(needsReload([f], { routes: true }), false, f);
  // the menu and what every page shows around its sections: always
  for (const f of [HEADER, SITE, PHOTOS, STRINGS]) assert.equal(needsReload([f]), true, f);
  // routes files: as the routes say
  for (const f of [people, schemaFile('people'), pageFile('about'), pageFile('home')]) {
    assert.ok(routesFile(f), f);
    assert.equal(needsReload([f]), false, f);
    assert.equal(needsReload([f], { routes: true }), true, f);
  }
  // a file the rule doesn't know: a reload is always right
  assert.equal(needsReload(['settings/something-new.json']), true);
  // one of several is enough
  assert.equal(needsReload([templateFile('t-ab12'), HEADER]), true);
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
  unlisted[HEADER].header = unlisted[HEADER].header.map(
    ({ children: _c, items: _i, ...rest }) => rest,
  );
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

test('swapWidget: a Text edit ended swaps only its widget, its section and the others stay (G3)', () => {
  const { document } = parseHTML(
    '<div data-router-view data-page-file="pages/index.json"><section data-sec="s-a"><div data-widget="w-t" style="--fr: 3; --frs: 9">old</div><div data-widget="w-p"><img></div></section></div>',
  );
  globalThis.CSS ??= { escape: (v) => v };
  const view = document.querySelector('[data-router-view]');
  const sec = view.querySelector('[data-sec]');
  const img = view.querySelector('img');
  const store = { current: { 'pages/index.json': { sections: [{ id: 's-a', widgets: [] }] } } };
  const html = {
    's-a':
      '<section data-sec="s-a"><div data-widget="w-t">new</div><div data-widget="w-p"><img></div></section>',
  };
  assert.equal(swapWidget(document, store, html, view, 'w-t'), true);
  assert.equal(view.querySelector('[data-widget="w-t"]').textContent, 'new');
  assert.equal(view.querySelector('[data-widget="w-t"]').style.getPropertyValue('--frs'), '9');
  assert.equal(view.querySelector('[data-sec]'), sec);
  assert.equal(view.querySelector('img'), img);
  // more than its section, or a widget it doesn't have: no (the sections are swapped instead)
  assert.equal(swapWidget(document, store, { ...html, 's-b': '' }, view, 'w-t'), false);
  assert.equal(swapWidget(document, store, html, view, 'w-zz'), false);
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
  // menu edits carry no reload flag of their own (the rule covers header.json)
  for (const f of ['PagesList', 'AddPageModal', 'HeaderPart'])
    assert.doesNotMatch(
      read(`src/editor/svelte/${f}.svelte`),
      /set\(HEADER,[^;]*structure: true/,
      f,
    );
});

test('G13: a content change re-renders the section in place, unless its text was patched in', () => {
  const main = read('src/editor/main.js');
  assert.match(main, /syncSections\(\{ structure: !typed \}, root\);/);
  assert.doesNotMatch(main, /structure && !typed/);
  // the targeted patch first (it marks the section rendered); the full scan only when it didn't
  assert.ok(
    main.indexOf('patchTexts(root, store, edits, bridge.patchText') <
      main.indexOf('syncSections({ structure: !typed }, root)'),
  );
  assert.match(main, /if \(patched\) bridge\.applyCurtain\(\);\s*else\s*bridge\.applyTexts\(/);
});

/** A page with one section: a button (its label marked) and a hero (its name in words). */
function patchPage() {
  const F = 'pages/index.json';
  const { document } = parseHTML(
    `<div data-router-view data-page-file="${F}"><section data-sec="s-a">` +
      `<div data-widget="w-b"><a class="btn"><span data-edit="${F}#/sections/0/widgets/0/label">Go</span></a></div>` +
      `<div data-widget="w-h"><span data-edit="${F}#/sections/0/widgets/1/title" data-edit-type="words"><span>Noor</span></span>` +
      `<span data-edit="${F}#/sections/0/widgets/1/eyebrow">Hi</span></div>` +
      `</section></div>`,
  );
  const store = createStore();
  store.load({
    [F]: {
      sections: [
        {
          id: 's-a',
          widgets: [
            { id: 'w-b', type: 'button', label: 'Go', config: { link: { href: '/x' } } },
            { id: 'w-h', type: 'hero', title: 'Noor', eyebrow: 'Hi' },
          ],
        },
      ],
    },
  });
  const view = document.querySelector('[data-router-view]');
  markRendered(document, store, view);
  let edits = null;
  store.on((e) => (edits = e.edits));
  const set = (ptr, v) => {
    store.set(F, `/sections/0/widgets/${ptr}`, v, { source: 'panel', key: `text:${ptr}` });
    return edits;
  };
  const write = (el, v) => (el.textContent = String(v));
  const stale = () => [...syncLayout(document, store, { structure: true, root: view })];
  return { document, store, view, set, write, stale };
}

test('a label typed in its popup is patched into its element: no section render', () => {
  const { view, store, set, write, stale } = patchPage();
  const edits = set('0/label', 'Go on');
  assert.deepEqual(
    edits.map((e) => [e.ptr, e.before, e.after]),
    [['/sections/0/widgets/0/label', 'Go', 'Go on']],
  );
  assert.equal(patchTexts(view, store, edits, write), true);
  assert.equal(view.querySelector('[data-widget="w-b"] span').textContent, 'Go on');
  assert.deepEqual(stale(), []); // nothing for renderOp
  // a keystroke more (the same undo step): patched again
  assert.equal(patchTexts(view, store, set('0/label', 'Go on!'), write), true);
  assert.equal(view.querySelector('[data-widget="w-b"] span').textContent, 'Go on!');
  assert.deepEqual(stale(), []);
  // a plain text of another widget too (the hero's eyebrow)
  assert.equal(patchTexts(view, store, set('1/eyebrow', 'Hello'), write), true);
  assert.deepEqual(stale(), []);
});

test('what the patch cannot show renders the section as before (G13)', () => {
  // a link: markup changes (href, a or span)
  let p = patchPage();
  assert.equal(patchTexts(p.view, p.store, p.set('0/config/link', { href: '/y' }), p.write), false);
  assert.deepEqual(p.stale(), ['s-a']);
  // ...and a label typed while that render is pending: still rendered (the section is stale)
  assert.equal(patchTexts(p.view, p.store, p.set('0/label', 'Go on'), p.write), false);
  assert.deepEqual(p.stale(), ['s-a']);
  // an emptied label: a button keeps its element (patched); a removed one (a default): rendered
  // (an emptied Form text, left out or a default: test/typing-patch.test.mjs)
  p = patchPage();
  assert.equal(patchTexts(p.view, p.store, p.set('0/label', ''), p.write), true);
  assert.equal(patchTexts(p.view, p.store, p.set('0/label', undefined), p.write), false);
  assert.deepEqual(p.stale(), ['s-a']);
  // the hero's name (words) is patched (its words and --hero-word: test/typing-patch.test.mjs)
  p = patchPage();
  assert.equal(patchTexts(p.view, p.store, p.set('1/title', 'Noor V'), p.write), true);
  assert.deepEqual(p.stale(), []);
  // a text with no element of its own in the widget: rendered
  p = patchPage();
  assert.equal(patchTexts(p.view, p.store, p.set('1/body', 'More'), p.write), false);
  // an undo has no edits: the full scan (applyTexts) and the render
  assert.equal(patchTexts(p.view, p.store, null, p.write), false);
});

test('inline editing is data-edit-inline (a Text body); a double click on any other text opens its field', () => {
  // (the double click: preview-pointer.js; the editing: preview-edit.js; its CSS: the runtime's)
  const bridge = ['preview-runtime', 'preview-edit', 'preview-pointer']
    .map((f) => read(`src/editor/${f}.js`))
    .join('\n');
  assert.match(
    read('src/editor/preview-pointer.js'),
    /const inline = hit\.dataset\.editInline !== undefined && hit\.dataset\.bound === undefined;\s*if \(!inline\) pickField\(hit\);/,
  );
  assert.match(
    read('src/editor/preview-edit.js'),
    /const richOf = \(w\) => w\?\.querySelector\('\[data-edit-inline\]\[data-edit-type="rich"\]'\)/,
  );
  for (const sel of ['[data-edit][contenteditable]', "closest?.('[data-edit]')"])
    assert.ok(!bridge.includes(sel), sel);
  // the photo's double click still opens its field (pickField), as a bound value's
  assert.match(bridge, /\[data-edit-inline\]\[contenteditable\] \{ outline: 1\.5px solid/);
});
