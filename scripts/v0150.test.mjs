// v0.1.50: the Publish count counts edits as their author sees them; sections are deleted at
// once (several: one undo step); sections or widgets are selected, never both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileModule } from 'svelte/compiler';
import { countEdits } from '../src/editor/lib/edit-count.js';
import { createStore } from '../src/editor/store.js';
import { removeSections } from '../src/editor/layout-ops.js';

const url = (f) => new URL(`../src/editor/${f}`, import.meta.url);
const src = (f) => readFileSync(url(f), 'utf8');
const P = 'pages/index.json';
const w = (id, base, extra = {}) => ({ id, type: 'text', layout: { base }, ...extra });
const page = () => ({
  version: 1,
  kind: 'page',
  id: 'pg-home',
  meta: { title: 'Home', description: 'x' },
  sections: [
    {
      id: 's-aaaa',
      widgets: [
        w('w-aaaa', { col: 1, span: 24, row: 1 }),
        w('w-bbbb', { col: 1, span: 24, row: 8 }),
        w('w-cccc', { col: 30, span: 24, row: 1, rows: 6 }, { size: 'rows' }),
      ],
    },
    { id: 's-bbbb', widgets: [] },
  ],
});
const edit = (fn) => {
  const p = page();
  fn(p);
  return countEdits(page(), p, P);
};
const W = (p, i) => p.sections[0].widgets[i];

test('a drag (column, row, width and height at once) is 1; the rows the editor stores are not', () => {
  assert.equal(
    edit(() => {}),
    0,
  );
  assert.equal(
    edit((p) => {
      Object.assign(W(p, 2).layout.base, { col: 40, row: 3, span: 30, rows: 9 });
      W(p, 1).layout.base.row = 12; // moved along (flow), tidied
    }),
    1,
  );
  // one widget dragged straight down (its row only): 1
  assert.equal(
    edit((p) => (W(p, 0).layout.base.row = 5)),
    1,
  );
  // the first phone edit copies the stack: 1, not one per widget
  assert.equal(
    edit((p) => {
      W(p, 0).layout.phone = { col: 1, span: 60, row: 1 };
      W(p, 1).layout.phone = { col: 1, span: 60, row: 7, link: { to: 'w-aaaa', gap: 4 } };
      W(p, 2).layout.phone = { col: 1, span: 60, row: 20 };
    }),
    1,
  );
  // a link's gap, the rows a section grows to: tidied (with a real edit: not counted)
  assert.equal(
    edit((p) => {
      W(p, 0).style = 'quote';
      p.sections[0].rows = 40;
    }),
    1,
  );
});

test('widgets and sections added, removed, restyled; page settings; settings files', () => {
  assert.equal(
    edit((p) => p.sections[0].widgets.push(w('w-dddd', { col: 1, span: 9, row: 30 }))),
    1,
  );
  assert.equal(
    edit((p) => p.sections[0].widgets.splice(0, 2)),
    2,
  );
  assert.equal(
    edit((p) => ((W(p, 0).style = 'a'), (W(p, 1).body = []))),
    2,
  );
  assert.equal(
    edit((p) => p.sections.push({ id: 's-cccc', widgets: [] })),
    1,
  );
  assert.equal(
    edit((p) => p.sections.splice(0, 2)),
    2,
  );
  assert.equal(
    edit((p) => (p.sections[1].name = 'Intro')),
    1,
  );
  assert.equal(
    edit((p) => ((p.meta.title = 'H'), (p.meta.description = 'y'))),
    2,
  );
  assert.equal(
    edit((p) => (p.curtainText = 'Hi')),
    1,
  );
  const site = { name: 'A', colors: { bg: '#000', fg: '#fff' }, social: [] };
  const next = { name: 'B', colors: { bg: '#111', fg: '#eee' }, social: [] };
  assert.equal(countEdits(site, next, 'settings/site.json'), 3);
  // a new or deleted file: 1 (contentStatus); something that isn't an object: 1
  assert.equal(countEdits(1, 2), 1);
  assert.match(src('../../scripts/editor-server.mjs'), /countEdits\(before, disk, f\.name\)/);
});

test('sections deleted at once, several in one undo step', () => {
  const F = P;
  const store = createStore();
  store.load({ [F]: page() });
  assert.equal(removeSections(store, F, ['s-aaaa', 's-bbbb']), true);
  assert.deepEqual(store.current[F].sections, []);
  store.undo();
  assert.deepEqual(store.current[F], page());
  assert.equal(removeSections(store, F, ['s-zzzz']), false);
  const card = src('svelte/SectionCard.svelte');
  assert.doesNotMatch(card, /alertdialog|deleting/);
  const tb = src('svelte/SectionToolbar.svelte');
  assert.match(tb, /label="Delete \{title\}"\s+onclick=\{\(\) => removeSelected\(\[s\.id\]\)\}/);
  assert.match(tb, /label="Delete \{many\.length\} sections"/);
});

async function loadUi() {
  const { js } = compileModule(src('svelte/ui.svelte.js'), { filename: 'ui.svelte.js' });
  const code = js.code.replace(
    /from '(\.\.?\/[^']+)'/g,
    (_, p) => `from '${new URL(p, url('svelte/'))}'`,
  );
  const f = join(mkdtempSync(join(tmpdir(), 'ui-')), 'ui.mjs');
  writeFileSync(
    f,
    code.replace(
      /from 'svelte\/internal\/client'/,
      `from '${import.meta.resolve('svelte/internal/client')}'`,
    ),
  );
  return import(f);
}

test('sections or widgets: selecting one kind clears the other', async () => {
  const { ui, selectSections, selectWidgets } = await loadUi();
  selectWidgets(['w-1', 'w-2']);
  selectSections(['s-1', 's-2'], 's-1');
  assert.deepEqual(
    [ui.multi, ui.widget, ui.selSections, ui.selSection],
    [[], null, ['s-1', 's-2'], 's-1'],
  );
  selectWidgets(['w-1']);
  assert.deepEqual([ui.selSections, ui.selSection, ui.widget], [[], null, 'w-1']);
  selectSections(['s-3']);
  assert.deepEqual([ui.selSections, ui.selSection, ui.widget], [[], 's-3', null]);
});

test('a reveal at the very end of the page plays: every scroll position clamped', () => {
  const t = readFileSync(new URL('../src/client/anim/types.js', import.meta.url), 'utf8');
  assert.match(
    t,
    /const reach = \(pos\) =>\s+typeof pos === 'string' && !pos\.startsWith\('clamp\('\) \? `clamp\(\$\{pos\}\)` : pos;/,
  );
});

test("an Auto widget's top / bottom edge strips stay inside its box (the next widget stays clickable)", () => {
  const ov = src('overlay.js');
  assert.match(ov, /\.edge\[data-h='n'\], \.edge\[data-h='s'\] \{[^}]*height: 8px; translate: 0;/);
  assert.match(ov, /\.edge\[data-h='s'\] \{ top: 100%; translate: 0 -100%; \}/);
});
