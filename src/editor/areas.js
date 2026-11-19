/**
 * The editor's areas: one list (svelte/AreaList.svelte), the single place each part of the
 * site is opened from. ui.panel (svelte/ui.svelte.js) is 'areas' while the list shows, else the
 * area open in the side panel. An area is one of:
 *   panel   the side panel shows it (ui.panel is its id): Pages, Theme, Animations, Site settings
 *   modal   it opens over the editor (modals.svelte.js), the list stays: Media, Sources
 *   soon    not built yet: its row is disabled, "Coming soon"
 * Pages holds the site parts (Header, Footer) and every page, Theme the item templates,
 * Animations the default timing, the Animations library and the page entrance, Site settings
 * what is the same on every page, redirects too.
 */
import { plural } from './lib/format.js';

export const AREAS = [
  { id: 'pages', label: 'Pages', icon: 'file-lines', opens: 'panel' },
  { id: 'media', label: 'Media', icon: 'images', opens: 'modal' },
  { id: 'sources', label: 'Sources', icon: 'database', opens: 'modal' },
  { id: 'theme', label: 'Theme', icon: 'palette', opens: 'panel' },
  { id: 'animations', label: 'Animations', icon: 'play', opens: 'panel' },
  { id: 'settings', label: 'Site settings', icon: 'gear', opens: 'panel' },
  { id: 'history', label: 'History', icon: 'clock-rotate-left', opens: 'soon' },
];

/** ui.panel's values: the list, then the areas the side panel shows. */
export const PANELS = ['areas', ...AREAS.filter((a) => a.opens === 'panel').map((a) => a.id)];

/** The area `id` ({ id, label, icon, opens }), or undefined. */
export const areaOf = (id) => AREAS.find((a) => a.id === id);

/**
 * Each area's quiet second line, from what the site has: { pages, photos, sources, items,
 * templates } (counts).
 */
export function areaSubs({ pages = 0, photos = 0, sources = 0, items = 0, templates = 0 } = {}) {
  return {
    pages: `Site parts and ${plural(pages, 'page')}`,
    media: plural(photos, 'photo'),
    sources: `${plural(sources, 'source')}, ${plural(items, 'item')}`,
    theme: plural(templates, 'template'),
    animations: 'Timing, library and page entrance',
    settings: 'Name, SEO, forms, type and redirects',
    history: 'Past publishes',
  };
}
