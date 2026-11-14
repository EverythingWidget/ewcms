// The Publish count counts edits as their author sees them (edit-count.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countEdits } from '../src/editor/lib/edit-count.js';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
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
  assert.equal(countEdits(site, next, 'site.json'), 3);
  // a new or deleted file: 1 (contentStatus); something that isn't an object: 1
  assert.equal(countEdits(1, 2), 1);
  assert.match(src('../../scripts/editor-server.mjs'), /countEdits\(before, disk, f\.name\)/);
});
