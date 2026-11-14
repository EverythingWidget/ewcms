// The widget pop-up's fields follow every change (live.copy, src/editor/svelte/live.svelte.js):
// the store sets a List's Columns in place (/config/columns), so a $derived of live.get() kept
// the same object and the Columns select went on showing the old value while the preview changed.
// Runs real Svelte reactivity: a loader hook compiles the *.svelte.js runes modules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { createStore } from '../src/editor/store.js';

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
const { watch: watchWith } = await import('./fixtures/live-reads.svelte.js');
// the client runtime's flushSync, the one the compiled module runs on (in Node `svelte` is the
// server build, where it does nothing)
const { flushSync: flush } = await import(
  new URL('src/index-client.js', import.meta.resolve('svelte/package.json')).href
);
const watch = (store, read) => watchWith(store, read, flush);

const FILE = 'en/pages/index.json';
const BASE = '/sections/0/widgets/0';
const page = () => ({
  sections: [{ id: 's-1', widgets: [{ id: 'w-1', type: 'list', config: { columns: '3' } }] }],
});
const storeWith = () => {
  const store = createStore();
  store.load({ [FILE]: page() });
  return store;
};
const setColumns = (store, v) =>
  store.set(FILE, `${BASE}/config/columns`, v, { source: 'panel', structure: true });

test('a List widget read with live.copy: its Columns field shows the new value, and the undone one', () => {
  const store = storeWith();
  const w = watch(store, (live) => live.copy(FILE, BASE));
  assert.equal(w.columns(), '3');
  setColumns(store, '5');
  assert.equal(w.columns(), '5');
  store.undo();
  assert.equal(w.columns(), '3');
  store.redo();
  assert.equal(w.columns(), '5');
  w.stop();
});

test('why: the store edits in place, so live.get gives the same object and nothing re-runs', () => {
  const store = storeWith();
  const before = store.get(FILE, BASE);
  setColumns(store, '5');
  assert.equal(store.get(FILE, BASE), before); // the same object, changed in place
  const w = watch(store, (live) => live.get(FILE, BASE));
  setColumns(store, '2');
  assert.equal(w.columns(), '5'); // the bug: still the value it first read
  w.stop();
});

test('live.copy: a copy, new per change, not the store`s own', () => {
  const store = storeWith();
  const w = watch(store, (live) => {
    const a = live.copy(FILE, BASE);
    a.config.columns = '6'; // changing the copy leaves the store alone
    return live.copy(FILE, BASE);
  });
  assert.equal(w.columns(), '3');
  assert.equal(store.get(FILE, `${BASE}/config/columns`), '3');
  w.stop();
});

test('the widget pop-up and the widget toolbar read their widget with live.copy', () => {
  const read = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');
  assert.match(
    read('WidgetInspector.svelte'),
    /const widget = \$derived\(live\.copy\(g\.file, base\) \|\| \{\}\)/,
  );
  assert.match(read('WidgetToolbar.svelte'), /live\.copy\(where\.file, where\.base\)/);
  // no widget object read with live.get in a $derived any more
  for (const f of ['WidgetInspector.svelte', 'WidgetToolbar.svelte'])
    assert.doesNotMatch(read(f), /return (where \? )?live\.get\([^)]*base\) \|\| \{\}/, f);
});
