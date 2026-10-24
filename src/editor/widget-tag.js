/**
 * The selected widget's tag in the preview (overlay.js): its size and place in grid cells,
 * `13×7 · 154:88` (span×rows · row:col), no type (the panel shows it). While it is dragged or
 * resized: the snapped values, a part that changed from where the drag began highlighted.
 */

/** { size, pos, sizeCh, posCh } for place `p` ({ col, span, row, rows }); `from`: the drag's start, or null. */
export function tagParts(p, from = null) {
  const size = `${p.span}×${p.rows}`;
  const pos = `${p.row}:${p.col}`;
  return {
    size,
    pos,
    sizeCh: !!from && (from.span !== p.span || from.rows !== p.rows),
    posCh: !!from && (from.row !== p.row || from.col !== p.col),
  };
}

/** The tag's HTML: the parts, a changed one in its own span (.ch). */
export function tagHtml(p, from = null) {
  const t = tagParts(p, from);
  const part = (v, ch) => (ch ? `<b class="ch">${v}</b>` : v);
  return `${part(t.size, t.sizeCh)} · ${part(t.pos, t.posCh)}`;
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
