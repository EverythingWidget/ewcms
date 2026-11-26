/**
 * When the preview has to load its page again instead of updating in place (src/editor/main.js).
 * Everything updates in place by default: a page's or the footer's sections are swapped in
 * (layout-sync.js), an item template's Lists and a source's sections rendered again where they
 * show (widgets/list/template-uses.js), animations updated live. Only what changes routes
 * or navigation, which every page around the sections shows, needs a reload:
 *
 *   a source, its schema or a page     only when the site's routes changed (routesKey): an item
 *                                      or a page added or removed, moved, a slug, or the name or
 *                                      cover of an item the menu lists
 *   the site's settings                when they changed (siteKey)
 *   the menu (header.json), the photos' and the UI strings
 *   any other file the rule doesn't know (a reload is always right)
 *
 * Never: item templates, the footer, animations, redirects (none of them is a route), and
 * theme.json (CSS variables, color themes and the color-scheme meta: ../theme-vars.js puts them on the preview as typed).
 */
import {
  ANIMATIONS,
  FOOTER,
  HEADER,
  PHOTOS,
  REDIRECTS,
  SITE,
  STRINGS,
  THEME,
  contentFromFiles,
  pageIdOf,
  schemaIdOf,
  sourceIdOf,
  templateIdOf,
} from '../../render/files.js';
import { getRoutes } from '../../render/routes.js';
import { isObject } from '../../render/is.js';

/** Files that never reload the preview: rendered in place, or never shown. */
export const IN_PLACE = [FOOTER, ANIMATIONS, REDIRECTS, THEME];
/** Files that always do: the menu and what every page shows around its sections. */
export const RELOADS = [HEADER, SITE, PHOTOS, STRINGS];

/** A file whose edits change the routes only sometimes (routesKey tells). */
export const routesFile = (file) => !!(sourceIdOf(file) || schemaIdOf(file) || pageIdOf(file));

/** The sources the menu lists ("items": a source id, at any depth of header.json). */
function navSources(nav, out = new Set()) {
  if (Array.isArray(nav)) for (const v of nav) navSources(v, out);
  else if (isObject(nav))
    for (const [k, v] of Object.entries(nav)) {
      if (k === 'items' && typeof v === 'string') out.add(v);
      else navSources(v, out);
    }
  return out;
}

/**
 * The site's routes as one string: their paths and 302s, and the name and cover of the items of
 * the sources the menu lists (its dropdowns show them). Equal before and after an edit: no route
 * or menu entry changed.
 */
export function routesKey(files) {
  const content = contentFromFiles(files);
  const listed = navSources(content.header);
  return JSON.stringify(
    getRoutes(content, { unbuilt: true }).map((r) => [
      r.path,
      r.redirect || '',
      r.source && listed.has(r.source) ? [r.name, r.photo || ''] : '',
    ]),
  );
}

/**
 * site.json as one string: equal before and after, nothing in it changed. (The look the
 * preview takes live is theme.json's, never site.json's.)
 */
export function siteKey(files) {
  const site = files?.[SITE];
  return JSON.stringify(isObject(site) ? site : (site ?? null));
}

/**
 * True when an edit of `files` needs the preview loaded again. `routes`: whether the site's
 * routes changed with it (routesKey before and after; asked only when routesFile(file) is one);
 * `site`: whether site.json changed (siteKey; left out: it did).
 */
export function needsReload(files, { routes = false, site = true } = {}) {
  return files.some((f) => {
    if (templateIdOf(f) || IN_PLACE.includes(f)) return false;
    if (routesFile(f)) return routes;
    if (f === SITE) return site;
    return true; // RELOADS, and anything else
  });
}
