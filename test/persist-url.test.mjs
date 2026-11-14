// The editor's URL keeps the explorer's open property (&property=): writeUrl puts it in,
// restoreUi + restorePlace read it back (src/editor/svelte/persist.js). Runs the real module:
// a loader hook compiles the *.svelte.js runes modules with Svelte's compileModule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

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

const people = {
  items: [
    { slug: 'noor', title: 'Noor' },
    { slug: 'sam', title: 'Sam' },
  ],
};
const live = { current: (file) => (file === 'sources/people.json' ? people : null) };
const bridge = {
  path: () => '/x/',
  api: { scrollTop: () => 0 },
  doc: { querySelector: () => null },
};

function browser(href) {
  let url = new URL(href, 'http://localhost');
  const store = new Map();
  Object.assign(globalThis, {
    location: {
      get href() {
        return url.href;
      },
      get search() {
        return url.search;
      },
      get pathname() {
        return url.pathname;
      },
      get hash() {
        return url.hash;
      },
    },
    history: { state: null, replaceState: (_s, _t, h) => (url = new URL(h, url)) },
    sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    addEventListener: () => {},
    document: { querySelector: () => null },
    requestAnimationFrame: (f) => f(),
  });
  return () => url;
}

test('&property= in the editor URL is written and read back', async () => {
  const urlNow = browser('/x/?edit&tab=pages&source=people&item=sam&property=title');
  const { restoreUi, restorePlace, writeUrl } = await import('../src/editor/svelte/persist.js');
  const { ui } = await import('../src/editor/svelte/ui.svelte.js');

  restoreUi(bridge, live);
  await restorePlace();
  assert.equal(ui.explorer.open, true);
  assert.equal(ui.explorer.file, 'sources/people.json');
  assert.equal(ui.explorer.index, 1);
  assert.equal(ui.explorer.property, 'title');

  ui.explorer = { ...ui.explorer, property: 'slug' };
  writeUrl();
  assert.equal(urlNow().searchParams.get('property'), 'slug');
  assert.equal(urlNow().searchParams.get('item'), 'sam');

  ui.explorer = { ...ui.explorer, property: '' };
  writeUrl();
  assert.equal(urlNow().searchParams.has('property'), false);
});

test('an old ?tab=nav falls back to the Pages tab', async () => {
  const urlNow = browser('/x/?edit&tab=nav');
  const { restoreUi, writeUrl } = await import('../src/editor/svelte/persist.js');
  const { ui } = await import('../src/editor/svelte/ui.svelte.js');

  restoreUi(bridge, live);
  assert.equal(ui.panel, 'pages');
  writeUrl();
  assert.equal(urlNow().searchParams.get('tab'), 'pages');
});
