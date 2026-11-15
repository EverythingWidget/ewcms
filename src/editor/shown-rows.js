import { PHONE_MQ } from '../render/layout/grid.js';

/**
 * Where widgets `ids` are in the preview `doc` now: { id: { row, rows } } (rows.js's --fr /
 * --frs: an auto widget's real height, a follower's row), so a new or duplicated widget goes
 * below all of them (layout-ops.js below). None on the phone grid (its rows are not these).
 */
export function shownRows(doc, ids) {
  const out = {};
  const win = doc?.defaultView;
  if (!win || win.matchMedia(PHONE_MQ).matches) return out;
  for (const id of ids) {
    const el = doc.querySelector(`[data-widget="${CSS.escape(id)}"]`);
    if (!el || el.hidden) continue;
    const st = win.getComputedStyle(el);
    const row = parseInt(el.style.getPropertyValue('--fr') || st.getPropertyValue('--r'), 10);
    // rows.js's rows, else (not flowed yet) its height in cells: an auto widget's stored --rs
    // is a placeholder (1), never its content's
    const cell = parseFloat(win.getComputedStyle(el.parentElement).getPropertyValue('--cell'));
    const tall = cell > 0 ? Math.ceil(el.getBoundingClientRect().height / cell - 0.01) : 0;
    const flowed = parseInt(el.style.getPropertyValue('--frs'), 10) || 0;
    const stored = el.classList.contains('wgt--auto')
      ? 0
      : parseInt(st.getPropertyValue('--rs'), 10) || 0;
    const rows = Math.max(flowed || stored, tall);
    if (row > 0 && rows > 0) out[id] = { row, rows };
  }
  return out;
}
