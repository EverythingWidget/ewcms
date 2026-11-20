/**
 * The editor's areas, the one source of truth for them: the list (svelte/AreaList.svelte) shows
 * a card per record, App.svelte opens what the record says. Adding an area is adding a record.
 * ui.panel (svelte/ui.svelte.js) is 'areas' while the list shows, else the id of the area open
 * in the side panel. A record:
 *   id        its one name: ui.panel's value and the URL's tab (a panel), `data-area`
 *   label     the card's name and the area head's title
 *   icon      the card's Font Awesome icon (fa-solid fa-<icon>)
 *   subtitle  (counts) => the card's quiet second line, from what the site has ({ pages,
 *             photos, sources, items, templates }: AreaList counts them)
 *   status    'ready' | 'soon' (not built yet: disabled, COMING_SOON where the › is)
 *   opens     what a click opens, one of:
 *               { panel: () => import(component) }   in the side panel (ui.panel is its id;
 *                                                     the component gets live, bridge, actions)
 *               { window: () => open it }            a window over the editor, the list stays
 *             (null: nothing yet, a 'soon' area)
 *   parts     (optional) rows the area's panel lists at its top, each { id, label, subtitle,
 *             status }: a 'soon' one shows as the areas' do (Theme's Fonts and styles)
 * Pages holds the site parts (Header, Footer) and every page, Theme the item templates,
 * Animations the default timing, the Animations library and the page entrance, Site settings
 * what is the same on every page, redirects too.
 * (The components and windows load on demand: this file stays plain data for persist.js and
 * the tests.)
 */
import { plural } from './lib/format.js';

/** What a row not built yet (status 'soon') says where its › would be: the one place. */
export const COMING_SOON = 'Coming soon';

export const AREAS = [
  {
    id: 'pages',
    label: 'Pages',
    icon: 'file-lines',
    subtitle: (n) => `Site parts and ${plural(n.pages ?? 0, 'page')}`,
    status: 'ready',
    opens: { panel: () => import('./svelte/ContentPanel.svelte') },
  },
  {
    id: 'media',
    label: 'Media',
    icon: 'images',
    subtitle: (n) => plural(n.photos ?? 0, 'photo'),
    status: 'ready',
    opens: {
      window: async () => {
        const [{ openMedia }, { ui }] = await Promise.all([
          import('./svelte/media.svelte.js'),
          import('./svelte/ui.svelte.js'),
        ]);
        openMedia({ key: ui.media.key });
      },
    },
  },
  {
    id: 'sources',
    label: 'Sources',
    icon: 'database',
    subtitle: (n) => `${plural(n.sources ?? 0, 'source')}, ${plural(n.items ?? 0, 'item')}`,
    status: 'ready',
    opens: { window: async () => (await import('./svelte/modals.svelte.js')).openSources() },
  },
  {
    id: 'theme',
    label: 'Theme',
    icon: 'palette',
    subtitle: (n) => plural(n.templates ?? 0, 'template'),
    status: 'ready',
    opens: { panel: () => import('./svelte/ThemePanel.svelte') },
    // the theme's own look as a form; until it is built, type stays in Site settings
    parts: [
      {
        id: 'fonts-styles',
        label: 'Fonts and styles',
        subtitle: "The theme's look",
        status: 'soon',
      },
    ],
  },
  {
    id: 'animations',
    label: 'Animations',
    icon: 'play',
    subtitle: () => 'Timing, library and page entrance',
    status: 'ready',
    opens: { panel: () => import('./svelte/AnimationsPanel.svelte') },
  },
  {
    id: 'site-settings',
    label: 'Site settings',
    icon: 'gear',
    subtitle: () => 'Name, SEO, forms, type and redirects',
    status: 'ready',
    opens: { panel: () => import('./svelte/SiteSettingsPanel.svelte') },
  },
  {
    id: 'history',
    label: 'History',
    icon: 'clock-rotate-left',
    subtitle: () => 'Past publishes',
    status: 'soon',
    opens: null,
  },
];

/** What area `a` opens in: 'panel' | 'window' | null (nothing yet). */
export const opensIn = (a) => (a?.opens?.panel ? 'panel' : a?.opens?.window ? 'window' : null);

/** ui.panel's values: the list, then the areas the side panel shows. */
export const PANELS = ['areas', ...AREAS.filter((a) => opensIn(a) === 'panel').map((a) => a.id)];

/** Where editing happens (Edit opens the page there) and where the item templates are. */
export const EDIT_PANEL = 'pages';
export const TEMPLATES_PANEL = 'theme';

/** Old ui.panel values (a link or a session from before a rename): the area they are now. */
export const PANEL_ALIASES = { settings: 'site-settings' };

/** A ui.panel value as it is now: an alias resolved, anything else as is. */
export const panelOf = (value) => PANEL_ALIASES[value] ?? value;

/** The area `id` (its record), or undefined. */
export const areaOf = (id) => AREAS.find((a) => a.id === id);
