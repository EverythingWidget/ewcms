// List order: a source owns it (the Sources modal's grips, written on Save), every List of it
// follows; a List's Custom items have the same grip (ListField) and are shown in their order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { loadContent } from '../src/cli/content.mjs';
import { save } from '../src/editor/server/editor-server.mjs';
import { buildRoutes } from '../src/render/routes.js';
import { newWidget, newSection, renderSections } from '../src/render/layout/index.js';
import { moveAt, movedIndex } from '../src/editor/lib/reorder.js';
import { SITE_A, withPhoto } from './fixtures/index.mjs';

const src = (f) => fs.readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');

/** A List's item titles, rendered on /about/ of `content`. */
function titles(content, config, more = {}) {
  const { routes } = buildRoutes(content);
  const page = routes.find((r) => r.path === '/about/');
  const ids = new Set();
  const w = newWidget('list', ids);
  const widget = { ...w, id: 'w-lo001', ...more, config: { ...w.config, ...config } };
  const ctx = { ...content, route: page, routes, curtains: {} };
  const html = renderSections(ctx, page, 'pages/test/index.json', [newSection(ids, [widget])]);
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return [...document.querySelectorAll('[data-list-item] .li__title')].map((e) =>
    e.textContent.trim(),
  );
}

test('moveAt / movedIndex: an item to its new place; a selection follows its item', () => {
  const l = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveAt(l, 2, 0), ['c', 'a', 'b', 'd']);
  assert.deepEqual(moveAt(l, 0, 3), ['b', 'c', 'd', 'a']);
  assert.deepEqual(moveAt(l, 1, 1), l);
  assert.deepEqual(moveAt(l, 1, 9), ['a', 'c', 'd', 'b'], 'clamped');
  assert.deepEqual(l, ['a', 'b', 'c', 'd'], 'a copy: the list itself is untouched');
  // the moved one, one it passed (shifts back one), one it moved over (shifts on), one apart
  assert.equal(movedIndex(2, 2, 0), 0);
  assert.equal(movedIndex(1, 0, 3), 0);
  assert.equal(movedIndex(0, 2, 0), 1);
  assert.equal(movedIndex(3, 0, 1), 3);
});

test('source reorder: Save writes the new order to sources/<id>.json; every List follows it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'list-order-'));
  fs.cpSync(path.join(SITE_A, 'content'), path.join(root, 'content'), { recursive: true });
  const file = path.join(root, 'content', 'en', 'sources', 'people.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = data.items.map((it) => it.id);
  assert.ok(before.length >= 3);
  const items = moveAt(data.items, before.length - 1, 0);
  const r = save(root, { 'sources/people.json': { ...data, items } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const written = JSON.parse(fs.readFileSync(file, 'utf8')).items.map((it) => it.id);
  assert.deepEqual(written, [before.at(-1), ...before.slice(0, -1)]);
  // a List of the source (All) shows them in that order, as does every other
  const content = withPhoto(loadContent(root));
  const want = content.sources.people.map((p) => p.title);
  assert.equal(want[0], items[0].title);
  assert.deepEqual(titles(content, {}, { source: { mode: 'all', from: 'people' } }), want);
  assert.deepEqual(
    titles(content, { template: 'preset:plain' }, { source: { mode: 'all', from: 'people' } }),
    want,
  );
});

test('Custom items reorder: the List shows them in their new order', () => {
  const content = withPhoto(loadContent(SITE_A));
  const items = [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }];
  const custom = (list) => titles(content, { custom: true, template: 'preset:panel', items: list });
  assert.deepEqual(custom(items), ['One', 'Two', 'Three']);
  assert.deepEqual(custom(moveAt(items, 2, 0)), ['Three', 'One', 'Two']);
  // the editor moves them with the same helper (ListField's grip / Alt+↑/↓)
  assert.match(
    src('ListLead.svelte'),
    /const moveItem = \(from, to\) => setList\(moveAt\(listOf\(\), from, to\)\)/,
  );
  assert.match(
    src('ListField.svelte'),
    /class="lf__grip"[\s\S]*onpointerdown=\{\(e\) => grab\(e, i\)\}/,
  );
});

test('Sources modal: a grip per item row (list-drag), the order tip, no shift', () => {
  const s = src('SourcesModal.svelte');
  assert.match(s, /import \{ listDrag, rowsOf \} from '\.\/list-drag\.svelte\.js'/);
  assert.match(s, /rowsOf\(itemsEl, '\[data-srow\]'\)/);
  assert.match(s, /class="srow__grip"[\s\S]*onpointerdown=\{\(e\) => ld\.grab\(e, \{ j: i \}\)\}/);
  assert.match(s, /live\.store\.set\(file, '\/items', next, \{ source: 'panel' \}\)/);
  assert.match(s, /<InfoHelp label="About the order"/);
  // the same cursors as the other lists: grab on the grip, grabbing while it moves
  assert.match(s, /\.srow__grip \{[\s\S]*cursor: grab;/);
  assert.match(s, /grabbing: true/);
  // lifted: no size change (a translate, a shadow)
  assert.match(s, /style:translate=\{lifted \? `0 \$\{drag\.dy\}px` : null\}/);
  // the List's Source tip says where the order comes from
  assert.match(src('ListLead.svelte'), /<b>Order<\/b>: the source's/);
});
