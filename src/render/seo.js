/**
 * Search and share meta of a page: what <head> says about it (shell/layout.js), what the
 * editor's SEO previews show, and the build's [seo] warnings.
 *
 * Site defaults live in content/site.json:
 *   title          home's title (in full)
 *   titleTemplate  every other page's title: "{page}" is the page's own title, "{site}" the
 *                  site name ("{page} | {site}", the default)
 *   description    the description of pages without their own
 *   ogPhoto        the share photo of pages without their own
 *   url            the site's address: canonical links, og:url, sitemap.xml
 *   robots         "index" (default) or "noindex": keeps the whole site out of search engines
 *   lang           <html lang> (also the editor's page)
 *   entityType     the home page's JSON-LD @type ("Person", the default; "Organization", ...)
 *   name           the site's name: og:site_name, JSON-LD, the editor's title
 * A page's own, in its file's "meta" (src/render/routes.js reads them into its route):
 *   title, description, photo (a photo: media/ path or R2 key), noindex, canonical
 * [param] pages: see routes.js (the item's name, summary and cover, then the template's meta).
 */
import { altOf, isExternal, mediaUrl, photoOf } from './helpers.js';

/** Search engines show about this much of a title / description. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** The site's address without a trailing slash. */
const siteBase = (site) => String(site?.url || '').replace(/\/+$/, '');

/** A path or URL made absolute on the site ("/about/" -> "https://eeliyarasta.com/about/"). */
export const absolute = (site, url) => (isExternal(url) ? url : siteBase(site) + url);

/**
 * A page's title: the site's titleTemplate around the page's own title (route.js). What the
 * template adds is added once: a title already ending (or starting) with it keeps it as typed
 * ("Uitstraling | Unic Derma" stays, F41).
 */
export function fillTitle(site, page) {
  const tpl = String(site?.titleTemplate || '{page} | {site}').replaceAll(
    '{site}',
    site?.name ?? '',
  );
  const at = tpl.indexOf('{page}');
  if (at < 0) return tpl;
  const [before, after] = [tpl.slice(0, at), tpl.slice(at + '{page}'.length)];
  let own = String(page ?? '');
  if (after.trim() && own.endsWith(after)) own = own.slice(0, -after.length);
  if (before.trim() && own.startsWith(before)) own = own.slice(before.length);
  return tpl.replaceAll('{page}', own);
}

/**
 * A share photo: { url (absolute), width, height, alt } of photo `src` (media/ path, R2 key or
 * URL), the size of the file the URL points at (from the photo's sizes); null without one.
 */
export function sharePhoto(ctx, src) {
  if (!src) return null;
  const url = absolute(ctx.site, mediaUrl(ctx, src));
  const photo = photoOf(ctx, src);
  const size = photo?.srcset?.find((s) => absolute(ctx.site, s.url) === url);
  const width = size?.w || photo?.width;
  return {
    url,
    width,
    height: width && photo?.width ? Math.round((width * photo.height) / photo.width) : undefined,
    alt: altOf(ctx, src),
  };
}

/** Everything <head> says about `route`: { title, description, url, photo, noindex }. */
export function seoOf(ctx, route) {
  const { site } = ctx;
  const path = route.out === '404.html' ? '/404' : route.path;
  return {
    title: route.title,
    description: route.description || '',
    url: absolute(site, route.canonical || path),
    photo: sharePhoto(ctx, route.photo || site.ogPhoto),
    noindex: !!route.noindex,
  };
}

/** Pages search engines index that need a look: no description, title or description too long. */
export function seoWarnings(routes) {
  return routes
    .filter((r) => !r.noindex)
    .flatMap((r) => [
      ...(r.description ? [] : [`${r.path}: no description (and no site default)`]),
      ...(r.title.length > TITLE_MAX
        ? [`${r.path}: title is ${r.title.length} characters (search shows ~${TITLE_MAX})`]
        : []),
      ...((r.description || '').length > DESCRIPTION_MAX
        ? [
            `${r.path}: description is ${r.description.length} characters (search shows ~${DESCRIPTION_MAX})`,
          ]
        : []),
    ]);
}
