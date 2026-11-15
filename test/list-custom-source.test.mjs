// F79: a List added with a source (People), switched to Custom, failed to save:
// `source: "people" is not a source`. The source stayed on the widget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';
import { setListCustom } from '../src/editor/layout-ops.js';
import { bindingProblems } from '../src/render/layout/bindings.js';
import { WIDGET_TYPES } from '../src/render/widgets/index.js';

const F = 'pages/index.json';
const list = (extra) => ({
  id: 'w-l001',
  type: 'list',
  source: { mode: 'all', from: 'people' },
  ...extra,
});
const page = (widget) => ({
  version: 1,
  kind: 'page',
  id: 'pg-t079',
  sections: [{ id: 's-t079', widgets: [widget] }],
});
const errors = (content) =>
  bindingProblems(content, { types: WIDGET_TYPES }).filter((p) => p.level === 'error');

test('F79: switching a List to Custom clears its source, one undo step', () => {
  const store = createStore();
  store.load({ [F]: page(list()) });
  const base = '/sections/0/widgets/0';
  setListCustom(store, F, base);
  assert.equal(store.get(F, `${base}/config/custom`), true);
  assert.equal(store.get(F, `${base}/source`), undefined);
  store.undo();
  assert.deepEqual(store.get(F, `${base}/source`), { mode: 'all', from: 'people' });
  assert.equal(store.get(F, `${base}/config/custom`), undefined);
  // no source to clear: just Custom
  store.load({ [F]: page({ id: 'w-l002', type: 'list' }) });
  setListCustom(store, F, base);
  assert.deepEqual(store.get(F, base), { id: 'w-l002', type: 'list', config: { custom: true } });
});

test('F79: a stale source on a Custom List never fails the save; on a source List it still does', () => {
  const custom = list({
    config: { custom: true, items: [{ title: 'A', photo: '', source: '', unit: '' }] },
  });
  assert.deepEqual(errors({ pages: { home: page(custom) }, sources: {} }), []);
  // even a broken source shape is ignored on a Custom List
  assert.deepEqual(
    errors({ pages: { home: page({ ...custom, source: { mode: 'x' } }) }, sources: {} }),
    [],
  );
  // From a source: still an error, it shows nothing
  assert.match(
    errors({ pages: { home: page(list()) }, sources: {} })[0]?.message || '',
    /source: "people" is not a source/,
  );
});

test("F79: the List's Custom button uses setListCustom", () => {
  const lead = readFileSync(
    new URL('../src/editor/svelte/ListLead.svelte', import.meta.url),
    'utf8',
  );
  assert.match(lead, /oncustom=\{\(\) => setListCustom\(live\.store, g\.file, base\)\}/);
});
