/**
 * Scroll into view in the preview, in one place: each scroll the editor asks of the
 * preview's page (the site's own scrolling is its own).
 *
 *   reveal(el, { when, smooth })  `el` centred in the preview when it is out of view; `when`
 *                                 says what counts as out of view (OUT_OF_VIEW):
 *     'edge'  (default) all but 60px of it off the top or bottom: a text focused or picked
 *             (preview-runtime.js reveal, focusEdit)
 *     'part'  any of it off-screen: a widget picked in the panel (overlay.js reveal)
 *     'play'  above the view or its top below 80% of it, instantly: an animation played
 *             again (replay, replayOne)
 *   locate(bridge, id)            Locate (the section and widget settings' button,
 *                                 ViewTop.svelte): the preview scrolls to the top of section
 *                                 or widget `id` (data-sec, data-widget, a template's data-tw),
 *                                 below the site's fixed header, smoothly (instantly with
 *                                 reduced motion). Nothing opens or is selected.
 */
import { offscreen } from './multi-select.js';

/** What counts as out of view: (rect, viewport height) -> true when it should scroll. */
export const OUT_OF_VIEW = {
  edge: (r, vh) => r.bottom < 60 || r.top > vh - 60,
  part: (r, vh) => offscreen(r, vh),
  play: (r, vh) => r.bottom < 0 || r.top > vh * 0.8,
};

/**
 * `el` (an element of the preview) centred when it is out of view (`when`: OUT_OF_VIEW);
 * true when it scrolled.
 */
export function reveal(el, { when = 'edge', smooth = true } = {}) {
  const win = el?.ownerDocument?.defaultView;
  if (!win) return false;
  if (!OUT_OF_VIEW[when](el.getBoundingClientRect(), win.innerHeight)) return false;
  el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'instant' });
  return true;
}

/** Locate: the top of section or widget `id` at the preview's top, below a fixed header. */
export function locate(bridge, id) {
  const q = CSS.escape(id || '');
  const el = bridge?.doc?.querySelector(
    `[data-sec="${q}"], [data-widget="${q}"], [data-tw="${q}"]`,
  );
  const win = el?.ownerDocument.defaultView;
  if (!win) return;
  // (below the site's fixed header, so the section's top isn't under it)
  const head = [...el.ownerDocument.querySelectorAll('body > header, .site-header')].find((h) =>
    ['fixed', 'sticky'].includes(win.getComputedStyle(h).position),
  );
  const still = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  win.scrollTo({
    top: el.getBoundingClientRect().top + win.scrollY - (head?.offsetHeight || 0),
    behavior: still ? 'instant' : 'smooth',
  });
}
