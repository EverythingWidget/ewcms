/**
 * Keeps the editor where it was across a refresh, in two places:
 *
 *   The URL (shareable): /photography/people/?edit&tab=settings (src/editor/lib/editor-url.js)
 *     tab     ui.panel: pages | settings | preview (the page's own tab, ui.pageTab, is kept per
 *             page in sessionStorage; an unknown tab: pages)
 *     (path)  the URL's own path is the page in the preview (main.js keeps it up to date)
 *     view    header | footer, when a site part (Header, Footer) is edited instead of a page
 *     source  + item (+ property): the Source Explorer (SourcesModal), open on that file and item, with that
 *             property highlighted (&source=people&item=noor-vermeer&property=summary; item is the
 *             slug, or the number without one)
 *     animation    Site Settings > Motion's Animations library, open on that animation (&animation=fade-up)
 *     pages   the pages list (the Pages tab), open on that folder (&pages=/people/; / is the root)
 *     media   + pick: the Media window, on that photo (&media=photos/x-1600.webp; / for none),
 *             picking for that field (&pick=sources/people.json#/0/photos/0/src)
 *   sessionStorage (this browser tab only, survives a refresh): the finer things. Open/closed
 *     sections and each page's tab, the selected field or Motion element, the open modals (Media
 *     and Sources, in their order), the panel and preview scroll.
 *
 * On load the URL wins; what it doesn't say comes from sessionStorage. Values that don't
 * exist (a bad tab, a deleted field, a renamed file) are skipped.
 *
 * The URL changes with history.replaceState, not pushState: a tab is a view of the same page,
 * so Back leaves the editor instead of stepping through tabs.
 *
 * main.js calls restoreUi() before the UI mounts and restorePlace() once the preview shows
 * the page; App.svelte calls writeUrl() whenever the tab, view, Sources, library, Pages or
 * Media window changes.
 */
import { tick } from 'svelte';
import { editorHref } from '../lib/editor-url.js';
import { ui, previewClicks, pickElement, selectText } from './ui.svelte.js';
import { sourceIdOf } from '../../site/files.js';
import { isOpen, pushed } from './modals.svelte.js';

const KEY = 'editor:ui';
// the modals open again after a refresh (the others are opened with callbacks: modals.svelte.js)
const KEPT = ['sources', 'media'];
// the URL's tab is ui.panel (ui.svelte.js)
const PANELS = ['pages', 'settings', 'preview'];
const PAGE_TABS = ['sections', 'element-motion', 'page-motion', 'seo'];
const VIEWS = { header: 'Header', footer: 'Footer' };

let bridge, live; // the preview (../bridge.js) and the content (live.svelte.js)
let saved = null; // what to put back, until the preview shows the page

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

/** sessionStorage, then the URL's tab, view and modals on top. */
function readState() {
  const state = readSession();
  const q = new URLSearchParams(location.search);
  // the page's tab stays the session's (ui.pageTab)
  if (q.has('tab')) state.panel = PANELS.includes(q.get('tab')) ? q.get('tab') : 'pages';
  if (q.has('view'))
    state.part = VIEWS[q.get('view')] && {
      kind: 'part',
      id: q.get('view'),
      title: VIEWS[q.get('view')],
    };
  if (q.has('source')) {
    state.sources = {
      file: `sources/${q.get('source')}.json`,
      index: 0,
      property: q.get('property') || '',
    };
    state.item = q.get('item');
    state.modals = pushed(state.modals || [], 'sources');
  }
  if (q.has('media')) {
    state.media = {
      key: q.get('media') === '/' ? '' : q.get('media'),
      filter: state.media?.filter || 'all',
      pick: q.get('pick') || '',
      multi: null,
    };
    state.modals = pushed(state.modals || [], 'media');
  }
  if (q.has('pages')) {
    if (!q.has('tab')) state.panel = 'pages'; // the pages list is in the Pages tab
    state.pagesWin = { open: true, folder: q.get('pages').replace(/^\/+|\/+$/g, '') };
  }
  if (q.has('animation')) {
    if (!q.has('tab')) state.panel = 'settings'; // the library is in Site Settings > Motion
    state.library = { name: q.get('animation') }; // an unknown name: the list
  } else if (q.get('tab') === 'settings') state.library = { name: '' };
  return state;
}

/** Put back the tab, view and sections, and save the rest when the page goes away. */
export function restoreUi(preview, content) {
  bridge = preview;
  live = content;
  saved = readState();
  if (PANELS.includes(saved.panel)) ui.panel = saved.panel;
  if (['pages', 'settings'].includes(saved.panelBeforePreview))
    ui.panelBeforePreview = saved.panelBeforePreview;
  if (PAGE_TABS.includes(saved.pageTab)) ui.pageTab = saved.pageTab;
  if (saved.part) ui.target = saved.part; // Header or Footer (pages: the URL's path)
  ui.sections = saved.sections || {};
  // Site Settings > Motion's library, on an animation
  if (typeof saved.library?.name === 'string') ui.library = { name: saved.library.name };
  if (saved.pagesWin) ui.pagesWin = saved.pagesWin; // the Pages tab shows the pages list (PagesList)
  if (saved.media) {
    ui.media = { ...ui.media, ...saved.media }; // MediaModal's photo, filter, field
    delete ui.media.open; // (a session from before the modal stack)
  }
  // Media opens at once (MediaModal waits for the content), Sources once the preview shows the
  // page (restorePlace)
  if (saved.modals?.includes('media')) ui.modals = ['media'];

  addEventListener('pagehide', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        panel: ui.panel,
        panelBeforePreview: ui.panelBeforePreview,
        pageTab: ui.pageTab,
        part: ui.target?.kind === 'part' ? ui.target : null,
        sections: ui.sections,
        sources: ui.sources,
        library: ui.library,
        pagesWin: ui.pagesWin,
        media: ui.media,
        modals: ui.modals.filter((name) => KEPT.includes(name)),
        path: bridge.path(),
        edit: ui.selection?.edit,
        anim: ui.anim?.widget ? `widget:${ui.anim.widget}` : ui.anim?.key,
        panelY: document.querySelector('.ed-body')?.scrollTop || 0,
        previewY: bridge.api?.scrollTop() || 0,
      }),
    );
  });
}

/**
 * The preview shows the page (the first 'navigate'): open Sources, and if it is the
 * same page as before the refresh, scroll it and pick what was picked.
 */
export async function restorePlace() {
  if (!saved) return;
  const { sources, modals, item, path, edit, anim, panelY, previewY } = saved;
  saved = null; // only after the refresh, not on later page changes

  // The Source Explorer, under Media when both were open
  if (sources && modals?.includes('sources')) {
    const list = live.current(sources.file)?.items;
    const at = Array.isArray(list) ? list.findIndex((it, i) => itemId(it, i) === item) : -1;
    ui.sources = { ...sources, index: at >= 0 ? at : sources.index, edit: null };
    ui.modals = ['sources', ...ui.modals.filter((name) => name !== 'sources')];
  }

  if (path !== bridge.path()) return;
  bridge.api.scrollTop(previewY);
  // a page's Element motion tab: the picked element; Pages (and the others, for later): the selected field
  const clicks = previewClicks();
  const motion = clicks === 'animate';
  const sel = motion
    ? anim &&
      (anim.startsWith('widget:')
        ? `[data-widget="${CSS.escape(anim.slice(6))}"]`
        : `[data-anim-key="${CSS.escape(anim)}"]`)
    : edit && `[data-edit="${CSS.escape(edit)}"]`;
  const el = sel && bridge.doc.querySelector(sel);
  if (el && clicks !== 'visitor') pickElement(el, motion ? 'anim' : 'text', { quiet: true });
  // quiet: the Pages panel doesn't scroll to the field, the panel scroll is put back below (visitor
  // clicks pick nothing in the preview, the field is still the one open)
  if (el && !motion) selectText(edit, { quiet: true });
  await tick();
  requestAnimationFrame(() => {
    const panel = document.querySelector('.ed-body');
    if (panel) panel.scrollTop = panelY;
  });
}

/** A Sources item in the URL: its slug, else its number (1, 2, ...). */
const itemId = (it, index) => it?.slug || String(index + 1);

/** Show the tab, view, open Sources item, Media and library animation in the URL (App.svelte, in an $effect). */
export function writeUrl() {
  const url = new URL(location.href);
  const q = url.searchParams;
  const set = (key, value) => (value ? q.set(key, value) : q.delete(key));
  set('tab', ui.panel);
  set('view', ui.target?.kind === 'part' && ui.target.id);
  const { file, index } = ui.sources;
  const list = isOpen('sources') && file ? live.current(file)?.items : null;
  set('source', list && sourceIdOf(file));
  set('item', Array.isArray(list) && list[index] && itemId(list[index], index));
  set('property', Array.isArray(list) && list[index] && ui.sources.property);
  set('animation', ui.panel === 'settings' && ui.library.name);
  set(
    'pages',
    ui.panel === 'pages' && ui.pagesWin.open && `/${ui.pagesWin.folder}/`.replace('//', '/'),
  );
  set('media', isOpen('media') && (ui.media.key || '/'));
  set('pick', isOpen('media') && ui.media.pick);
  const href = editorHref(url);
  if (href !== location.pathname + location.search + location.hash)
    history.replaceState(history.state, '', href);
}
