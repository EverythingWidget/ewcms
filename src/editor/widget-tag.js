/**
 * The selected widget's tag in the preview (overlay.js): its size and place in grid cells,
 * `13×7 · 154:88` (span×rows · row:col), no type (the panel shows it). While it is dragged or
 * resized: the snapped values, a part that changed from where the drag began highlighted.
 * It starts with the Auto toggle (the up-down icon, as Size Auto in the widget's layout): on, its
 * height follows its content (`64×auto · 4:1`); a click switches Auto ↔ Rows (overlay.js).
 */

// Font Awesome's up-down (fa-solid fa-up-down), inline: the overlay's shadow root has no icon font
const UP_DOWN =
  '<svg viewBox="0 0 320 512" aria-hidden="true"><path d="M182.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-9.2 9.2-11.9 22.9-6.9 34.9S51.1 160 64 160h64v192H64c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l96 96c12.5 12.5 32.8 12.5 45.3 0l96-96c9.2-9.2 11.9-22.9 6.9-34.9S268.9 352 256 352h-64V160h64c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-96-96z"/></svg>';

/**
 * { size, pos, sizeCh, posCh } for place `p` ({ col, span, row, rows }); `from`: the drag's
 * start, or null; auto: its height follows its content (its rows read `auto`).
 */
export function tagParts(p, from = null, auto = false) {
  const size = `${p.span}×${auto ? 'auto' : p.rows}`;
  const pos = `${p.row}:${p.col}`;
  return {
    size,
    pos,
    sizeCh: !!from && (from.span !== p.span || (!auto && from.rows !== p.rows)),
    posCh: !!from && (from.row !== p.row || from.col !== p.col),
  };
}

/** The tag's HTML: the Auto toggle (.auto, on: .is-on), the parts, a changed one in its own span (.ch). */
export function tagHtml(p, from = null, auto = false) {
  const t = tagParts(p, from, auto);
  const part = (v, ch) => (ch ? `<b class="ch">${v}</b>` : v);
  const title = auto
    ? 'Auto: as tall as its content (click: fixed rows)'
    : 'Auto: off (click: as tall as its content)';
  const toggle = `<i class="auto${auto ? ' is-on' : ''}" data-auto title="${title}">${UP_DOWN}</i>`;
  return `${toggle}${part(t.size, t.sizeCh)} · ${part(t.pos, t.posCh)}`;
}

/**
 * Where a widget element sits on its grid now: its computed grid area, its rows as the flow
 * resolved them (--fr, --frs on the element, when set).
 */
export function shownPlace(el, win) {
  const cs = win.getComputedStyle(el);
  const n = (v) => parseInt(v, 10);
  const spanOf = (start, end) => {
    const m = /span\s+(\d+)/.exec(end);
    return m ? n(m[1]) : n(end) - n(start);
  };
  const col = n(cs.gridColumnStart);
  const span = spanOf(cs.gridColumnStart, cs.gridColumnEnd);
  const row = n(el.style.getPropertyValue('--fr')) || n(cs.gridRowStart);
  const rows = n(el.style.getPropertyValue('--frs')) || spanOf(cs.gridRowStart, cs.gridRowEnd);
  return { col, span, row, rows };
}
