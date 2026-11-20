// What panels read from live (src/editor/svelte/live.svelte.js): a file, a value, the routes,
// the sources, a schema, or read(fn) for what follows the files. Only live.svelte.js reads its
// change counter, so one place decides what wakes a panel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createStore } from '../src/editor/store.js';
import { schemaFor } from '../src/editor/svelte/source-items.js';

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

const PEOPLE = 'sources/people.json';
const load = () => {
  const store = createStore();
  store.load({
    [PEOPLE]: { version: 1, kind: 'source', items: [{ id: 'a', name: 'Noor' }] },
    'sources/places.json': { version: 1, kind: 'source', items: [] },
  });
  return { store, live: createLive(store) };
};

test('live.sources, live.schema, live.loaded and live.read follow the store', () => {
  const empty = createLive(createStore());
  assert.equal(empty.loaded, false);
  const { store, live } = load();
  assert.equal(live.loaded, true);
  assert.deepEqual(live.sources, ['people', 'places']);
  assert.deepEqual(live.schema(PEOPLE), schemaFor(store, PEOPLE));
  assert.equal(
    live.read((s) => s.current[PEOPLE].items.length),
    1,
  );
  store.set('sources/things.json', '', { version: 1, kind: 'source', items: [] });
  assert.deepEqual(live.sources, ['people', 'places', 'things']);
  store.set(PEOPLE, '/items/0/age', 30);
  assert.deepEqual(live.schema(PEOPLE), schemaFor(store, PEOPLE));
});

test('only live.svelte.js reads the change counter: no live.version anywhere else', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('..', import.meta.url).pathname;
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(svelte|js|mjs)$/.test(name)) files.push(p);
    }
  };
  for (const d of ['src', 'sandbox', 'default-site']) walk(join(root, d));
  const live = join(root, 'src/editor/svelte/live.svelte.js');
  assert.ok(files.includes(live));
  const readers = files.filter(
    (f) => f !== live && /\blive\??\.version\b/.test(readFileSync(f, 'utf8')),
  );
  assert.deepEqual(readers, []);
  // and live has no counter to read: panels ask it for what they show
  assert.equal('version' in createLive(createStore()), false);
});
