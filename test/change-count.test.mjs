// The change count and the dirty files (src/editor/store.js): each file is compared and counted
// again only after a change to it, so a keystroke doesn't re-serialize every file; live.changes
// (src/editor/svelte/live.svelte.js) counts once per store change however often it is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createStore } from '../src/editor/store.js';
import { formatJSON } from '../src/editor/lib/json-format.js';
import { omitDefaults } from '../src/render/defaults.js';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
    import { readFile } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';
    import { compileModule } from '${import.meta.resolve('svelte/compiler')}';
    export async function load(url, context, next) {
      if (!url.endsWith('.svelte.js')) return next(url, context);
      const file = fileURLToPath(url);
      const { js } = compileModule(await readFile(file, 'utf8'), { filename: file, generate: 'client' });
      return { format: 'module', source: js.code, shortCircuit: true };
    }`),
  import.meta.url,
);
const { createLive } = await import('../src/editor/svelte/live.svelte.js');

const page = (id) => ({
  version: 1,
  kind: 'page',
  id,
  title: id,
  sections: [{ id: `s-${id}`, widgets: [{ id: `w-${id}`, type: 'text', col: 2 }] }],
});
const FILES = Array.from({ length: 40 }, (_, i) => `pages/p${i}.json`);
const loaded = () => {
  const store = createStore();
  store.load(Object.fromEntries(FILES.map((f, i) => [f, page(`p${i}`)])));
  return store;
};
// what the store counted before (every file serialized, every read)
const naive = (store) => {
  const t = (f, d) => (d && typeof d === 'object' ? omitDefaults(f, d) : d);
  const dirty = Object.keys(store.current).filter(
    (f) => formatJSON(t(f, store.current[f])) !== formatJSON(t(f, store.base[f])),
  );
  return { dirty, count: dirty.reduce((n, f) => n + store.changes(f).length, 0) };
};
const same = (store) => {
  const want = naive(store);
  assert.deepEqual(store.dirtyFiles(), want.dirty);
  assert.equal(store.changeCount(), want.count);
};

test('a keystroke compares its own file again, not every file', () => {
  const store = loaded();
  assert.deepEqual(store.dirtyFiles(), []);
  assert.equal(store.stats.compared, FILES.length);
  for (const ch of ['H', 'He', 'Hel', 'Hell', 'Hello']) {
    const before = store.stats.compared;
    store.set(FILES[3], '/title', ch, { key: 'text:t' });
    assert.deepEqual(store.dirtyFiles(), [FILES[3]]);
    assert.equal(store.changeCount(), 1);
    store.dirtyFiles();
    store.changeCount();
    assert.equal(store.stats.compared - before, 1, 'one file compared per keystroke');
  }
});

test('the cached count matches a full count after edits, undo, redo, save, rebase, files', () => {
  const store = loaded();
  same(store);
  store.set(FILES[0], '/title', 'A');
  store.set(FILES[1], '/sections/0/widgets/0/col', 3);
  same(store);
  // a value equal to its default is no change (tidied): col 1 left out
  store.set(FILES[2], '/sections/0/widgets/0/col', 1);
  same(store);
  store.undo();
  same(store);
  store.redo();
  same(store);
  store.batch(() => {
    store.set(FILES[4], '/title', 'x');
    store.set(FILES[5], '/title', 'y');
  });
  same(store);
  store.markSaved([FILES[0]]);
  same(store);
  store.rebase({ [FILES[6]]: { ...page('p6'), title: 'remote' } });
  same(store);
  store.files({ 'pages/new.json': page('new') }, [FILES[1]]);
  same(store);
  store.set('pages/new.json', '', { ...page('new'), title: 'whole file' });
  same(store);
  store.undo();
  same(store);
  assert.ok(store.changeCount() > 0);
});

test('live.changes counts once per store change, however often it is read', () => {
  const store = loaded();
  const live = createLive(store);
  assert.equal(live.changes, 0);
  store.set(FILES[7], '/title', 'B');
  const before = store.stats.compared;
  for (let i = 0; i < 4; i++) assert.equal(live.changes, 1);
  assert.equal(store.stats.compared - before, 1);
  store.undo();
  assert.equal(live.changes, 0);
});
