// The editor's URL keeps Sources' open property (&property=): writeUrl puts it in,
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
  assert.deepEqual(ui.modals, ['sources']);
  assert.equal(ui.sources.file, 'sources/people.json');
  assert.equal(ui.sources.index, 1);
  assert.equal(ui.sources.property, 'title');

  ui.sources = { ...ui.sources, property: 'slug' };
  writeUrl();
  assert.equal(urlNow().searchParams.get('property'), 'slug');
  assert.equal(urlNow().searchParams.get('item'), 'sam');

  ui.sources = { ...ui.sources, property: '' };
  writeUrl();
  assert.equal(urlNow().searchParams.has('property'), false);
});

test('an old ?tab=nav falls back to the areas', async () => {
  const urlNow = browser('/x/?edit&tab=nav');
  const { restoreUi, writeUrl } = await import('../src/editor/svelte/persist.js');
  const { ui } = await import('../src/editor/svelte/ui.svelte.js');

  restoreUi(bridge, live);
  assert.equal(ui.panel, 'areas');
  writeUrl();
  assert.equal(urlNow().searchParams.get('tab'), 'areas');
});

test('Media over Sources comes back in that order after a refresh, and in the URL', async () => {
  const urlNow = browser('/x/?edit&tab=pages&source=people&item=noor&media=photos/a.webp');
  const { restoreUi, restorePlace, writeUrl } = await import('../src/editor/svelte/persist.js');
  const { ui } = await import('../src/editor/svelte/ui.svelte.js');

  ui.modals = [];
  restoreUi(bridge, live);
  assert.deepEqual(ui.modals, ['media']); // Media at once, Sources once the page shows
  assert.equal(ui.media.key, 'photos/a.webp');
  assert.equal('open' in ui.media, false);
  await restorePlace();
  assert.deepEqual(ui.modals, ['sources', 'media']); // Sources under Media
  assert.equal(ui.sources.index, 0);
  writeUrl();
  assert.equal(urlNow().searchParams.get('media'), 'photos/a.webp');
  assert.equal(urlNow().searchParams.get('source'), 'people');
  ui.modals = ['sources'];
  writeUrl();
  assert.equal(urlNow().searchParams.has('media'), false);
  ui.modals = [];
  writeUrl();
  assert.equal(urlNow().searchParams.has('source'), false);
});

test('areas in the URL: a library link from before them opens Animations, a site part Pages', async () => {
  const { restoreUi, writeUrl } = await import('../src/editor/svelte/persist.js');
  const { ui } = await import('../src/editor/svelte/ui.svelte.js');

  // the Animations library was in Site settings: its old links open it in Animations
  let urlNow = browser('/x/?edit&tab=settings&animation=fade-up');
  restoreUi(bridge, live);
  assert.equal(ui.panel, 'animations');
  assert.equal(ui.library.name, 'fade-up');
  writeUrl();
  assert.equal(urlNow().searchParams.get('tab'), 'animations');
  assert.equal(urlNow().searchParams.get('animation'), 'fade-up');

  // an old Site settings link (tab=settings) is site-settings now, in the URL too
  urlNow = browser('/x/?edit&tab=settings');
  restoreUi(bridge, live);
  assert.equal(ui.panel, 'site-settings');
  writeUrl();
  assert.equal(urlNow().searchParams.get('tab'), 'site-settings');
  assert.equal(urlNow().searchParams.has('animation'), false);

  // the Header open without a tab: in Pages, edit
  browser('/x/?edit&view=header');
  restoreUi(bridge, live);
  assert.equal(ui.panel, 'pages');
  assert.equal(ui.mode, 'edit');
  assert.equal(ui.target?.id, 'header');

  for (const tab of ['areas', 'theme', 'templates', 'animations']) {
    browser(`/x/?edit&tab=${tab}`);
    restoreUi(bridge, live);
    assert.equal(ui.panel, tab);
  }
});

test("a session from before the rename: panel 'settings' and its sections open as site-settings", async () => {
  const urlNow = browser('/x/?edit');
  sessionStorage.setItem(
    'editor:ui',
    JSON.stringify({ panel: 'settings', sections: { 'settings:seo': true, 'text:hero': false } }),
  );
  const { restoreUi, writeUrl } = await import('../src/editor/svelte/persist.js');
  const { ui } = await import('../src/editor/svelte/ui.svelte.js');
  restoreUi(bridge, live);
  assert.equal(ui.panel, 'site-settings');
  assert.deepEqual({ ...ui.sections }, { 'site-settings:seo': true, 'text:hero': false });
  writeUrl();
  assert.equal(urlNow().searchParams.get('tab'), 'site-settings');
});

test('Theme: the open part comes back from the session (the card list if none)', async () => {
  browser('/x/?edit&tab=theme');
  sessionStorage.setItem('editor:ui', JSON.stringify({ panel: 'theme', themePart: 'typography' }));
  const { restoreUi } = await import('../src/editor/svelte/persist.js');
  const { ui } = await import('../src/editor/svelte/ui.svelte.js');
  restoreUi(bridge, live);
  assert.equal(ui.panel, 'theme');
  assert.equal(ui.themePart, 'typography');
  sessionStorage.setItem('editor:ui', JSON.stringify({ panel: 'theme', themePart: '' }));
  restoreUi(bridge, live);
  assert.equal(ui.themePart, '');
  sessionStorage.setItem('editor:ui', JSON.stringify({ panel: 'theme', themePart: 'nope' }));
  restoreUi(bridge, live);
  assert.equal(ui.themePart, '');
});
