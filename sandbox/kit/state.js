/**
 * Made-up editor and preview state for mocks, set on the editor's real state modules (ui,
 * update, the store and live state), so the real components draw it as in the editor:
 *
 *   const live = editorState({ files, path: '/about/', pages: 12, update: 'available' });
 *
 *   files    the site's content files ({ 'pages/index.json': …, 'header.json': … }); default
 *            none (siteFiles() fetches the dev server's, as the editor does; <EditorState>
 *            does that for you)
 *   path     the page the preview shows ('/'): its row in the pages list gets the active fill
 *   pages    made-up pages added (a number, or 'many': 12), half of them linked in the header
 *   panel    the area open ('pages')            mode   'browse' (default) | 'edit'
 *   widget   a selected widget's id (selectWidgets), or null
 *   update   'available' | 'up-to-date' | null (no answer yet): the About card and window
 *
 * ui and the update state are one per page: mocks stacked on one page share them (the last
 * set wins).
 */
import { createStore } from '../../src/editor/store.js';
import { createLive } from '../../src/editor/svelte/live.svelte.js';
import { selectWidgets, setMode, ui } from '../../src/editor/svelte/ui.svelte.js';
import { upd } from '../../src/editor/svelte/update.svelte.js';
import { pageMenu } from '../../src/editor/lib/page-entries.js';
import pkg from '../../package.json';

const MADE_UP = [
  'Journal',
  'Workshops',
  'Prints',
  'Exhibitions',
  'Press',
  'Contact',
  'Gear',
  'Clients',
  'Booking',
  'Pricing',
  'FAQ',
  'Legal',
];

/** `files` with `n` made-up pages added (pages/<slug>/index.json), the first half linked in the header. */
export function withPages(files, n = 12) {
  const out = structuredClone(files);
  const header = out['header.json'] || { version: 1, header: [] };
  const links = [...(header.header || [])];
  for (let i = 0; i < n; i++) {
    const title =
      MADE_UP[i % MADE_UP.length] +
      (i >= MADE_UP.length ? ` ${1 + Math.floor(i / MADE_UP.length)}` : '');
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = `pg-mk${String(i).padStart(2, '0')}`;
    out[`pages/${slug}/index.json`] = {
      version: 1,
      kind: 'page',
      id,
      meta: { title },
      sections: [],
    };
    if (i < n / 2) links.push({ label: title, page: id });
  }
  out['header.json'] = { ...header, header: links };
  return out;
}

/** The dev server's content files (GET /__editor/content), as the editor loads them. */
export async function siteFiles() {
  const res = await fetch('/__editor/content', { cache: 'no-store' });
  if (!res.ok) throw new Error(`/__editor/content: ${res.status}`);
  return (await res.json()).files;
}

const UPDATE = {
  available: () => ({
    current: pkg.version,
    latest: '9.9.9',
    available: true,
    changes: ['A made-up change for the mock', 'Another one'],
    engine: `^${pkg.version}`,
  }),
  'up-to-date': () => ({
    current: pkg.version,
    latest: pkg.version,
    available: false,
    changes: [],
    engine: `^${pkg.version}`,
  }),
};

/** Set the state (see above) and return the live state for the components that take `live`. */
export function editorState({
  files = {},
  path = '/',
  pages = 0,
  panel = 'pages',
  mode = 'browse',
  widget = null,
  update = null,
} = {}) {
  const n = pages === 'many' ? 12 : Number(pages) || 0;
  const store = createStore();
  store.load(structuredClone(n ? withPages(files, n) : files));
  const live = createLive(store);
  ui.panel = panel;
  setMode(mode);
  ui.path = path;
  ui.pages = pageMenu(store.current, live.routes);
  const shown = ui.pages.find((p) => p.kind === 'page' && p.path === path);
  if (shown) ui.target = shown;
  selectWidgets(widget ? [widget] : []);
  if (update && !UPDATE[update]) throw new Error(`update: 'available' | 'up-to-date' | null`);
  upd.info = update ? UPDATE[update]() : null;
  upd.phase = 'offer';
  upd.later = false;
  return live;
}
