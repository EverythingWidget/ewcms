/**
 * The navbar's height (--nav-h on <html>): how far the site's header covers the top of the page,
 * measured from [data-header] when it is fixed or absolute (it floats over the page), else 0.
 * The first section of a page starts its grid there (_layout.scss: its padding-top), so no
 * widget sits under the navbar; its background still runs behind it. Kept in sync when the
 * header resizes (ResizeObserver) and when the window does (a breakpoint can change it).
 * Before this runs (and without JS) --nav-h is the theme's --header-h.
 */
export function watchNavHeight(doc = document) {
  const root = doc.documentElement;
  const win = doc.defaultView;
  let last = '';
  const set = () => {
    const head = doc.querySelector('[data-header]');
    const cs = head && win.getComputedStyle(head);
    const floats = cs && cs.display !== 'none' && /^(fixed|absolute)$/.test(cs.position);
    const h = floats ? Math.max(0, head.offsetTop + head.offsetHeight) : 0;
    const v = `${h}px`;
    if (v === last) return;
    last = v;
    root.style.setProperty('--nav-h', v);
  };
  set();
  const head = doc.querySelector('[data-header]');
  const ro = head && 'ResizeObserver' in win ? new win.ResizeObserver(set) : null;
  if (ro) ro.observe(head);
  win.addEventListener('resize', set);
  return () => {
    ro?.disconnect();
    win.removeEventListener('resize', set);
  };
}
