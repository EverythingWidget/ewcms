/** An item's grid markup (./item-grid.js has the model): a section of its own. */
import { esc } from '../../helpers.js';
import { mobileRowsOf, rowsOf, widgetClass, widgetLinks, widgetVars } from '../../layout/index.js';
import { asPageWidget } from './item-grid.js';

/** The template's rows (desktop, phone): down to its lowest widget, as a section's. */
export function itemRows(widgets) {
  const s = { widgets: (widgets || []).map(asPageWidget) };
  return { rows: rowsOf(s), mrows: Math.max(Math.ceil(rowsOf(s) / 2), phoneRows(s.widgets)) };
}

// phone rows without the page's default stack: own phone areas, else the desktop halved
function phoneRows(widgets) {
  return mobileRowsOf({ widgets: widgets.filter((w) => w?.layout?.phone) });
}

/**
 * One item's grid: `parts` each template widget's rendered content ('' when left out),
 * in the template's order.
 */
export function itemGridHtml(widgets, parts, cls = '') {
  const ws = (widgets || []).map(asPageWidget);
  const { rows, mrows } = itemRows(widgets);
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
  return `<div class="sec sec--item${cls}" style="--rows:${rows};--mrows:${mrows}">${body}</div>`;
}
