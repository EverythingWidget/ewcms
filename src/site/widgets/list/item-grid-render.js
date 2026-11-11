/** An item's grid markup (./item-grid.js has the model): a section of its own. */
import { esc } from '../../helpers.js';
import {
  minRowsOf,
  phoneRowsOf,
  rowsOf,
  widgetClass,
  widgetLinks,
  widgetVars,
} from '../../layout/index.js';

/**
 * The template's rows (desktop, phone): down to its lowest widget, as a section's; a custom
 * height at least its `rows.min` (on a phone half as many, rounded up).
 */
export function itemRows(widgets, section = {}) {
  const s = { widgets: widgets || [] };
  const min = minRowsOf(section);
  const mmin = Math.ceil(min / 2);
  return {
    rows: Math.max(rowsOf(s), min),
    mrows: Math.max(Math.ceil(rowsOf(s) / 2), phoneRows(s.widgets), mmin),
    min,
    mmin,
  };
}

// phone rows without the page's default stack: own phone areas, else the desktop halved
function phoneRows(widgets) {
  return phoneRowsOf({ widgets: widgets.filter((w) => w?.layout?.phone) });
}

/**
 * One item's grid: `widgets` the template's (its one section's), `parts` each one's rendered
 * content ('' when left out), in the template's order; `section` its section (its height).
 */
export function itemGridHtml(widgets, parts, section = {}, cls = '') {
  const ws = widgets || [];
  const { rows, mrows, min, mmin } = itemRows(ws, section);
  const body = ws
    .map((w, i) => {
      if (!parts[i]) return '';
      const links = Object.entries(widgetLinks(w))
        .filter(([, v]) => v !== null)
        .map(([k, v]) => ` ${k}="${esc(v)}"`)
        .join('');
      const id = typeof w.id === 'string' ? ` data-tw="${esc(w.id)}"` : '';
      return `<div class="${widgetClass(w)}" style="${widgetVars(w)}"${id}${links}>${parts[i]}</div>`;
    })
    .join('');
  const mins = (min ? `;--minrows:${min}` : '') + (mmin ? `;--mminrows:${mmin}` : '');
  return `<div class="sec sec--item${cls}" style="--rows:${rows};--mrows:${mrows}${mins}">${body}</div>`;
}
