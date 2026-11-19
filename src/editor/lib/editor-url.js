/**
 * The editor's address (dev server: src/cli/vite-plugin-static-site.mjs; editor: main.js). The visual
 * editor is the site's own URL with an `edit` query param, so the page it edits is the URL's
 * path and its other params (tab, view, source, …: src/editor/svelte/persist.js) follow:
 *
 *   /?edit                         the editor on the home page
 *   /photography/people/?edit&tab=settings
 *
 * Dev only: a build has no editor page (only index.html is bundled), so there ?edit is an
 * ignored param on a static page. The editor's preview iframe loads the same paths without
 * `edit` and with ?draft=<session> (src/editor/source.js); a request with a draft, or one an
 * iframe makes, always gets the site, so the editor can never load inside its own preview.
 */

export const EDIT_PARAM = 'edit';

/** The editor app's shell (Vite transforms it like any index.html). */
export const EDITOR_HTML = 'src/editor/index.html';

/** True when a page request should get the editor instead of the site. */
export function wantsEditor(url, headers = {}) {
  return (
    url.searchParams.has(EDIT_PARAM) &&
    !url.searchParams.has('draft') &&
    headers['sec-fetch-dest'] !== 'iframe'
  );
}

/** An editor URL as text, its bare `edit` flag first: "/about/?edit&tab=settings". */
export function editorHref(url) {
  const q = new URLSearchParams(url.search);
  q.delete(EDIT_PARAM);
  const rest = q.toString();
  return `${url.pathname}?${EDIT_PARAM}${rest ? `&${rest}` : ''}${url.hash}`;
}
