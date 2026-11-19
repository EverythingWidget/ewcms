/**
 * The layout overlay's widget drag (overlay.js): the selected widget moved by its body or resized
 * by a handle, snapped to the cells of its section's grid (the phone's below 760px) and shown live
 * (its CSS variables; the widgets that follow it move along, the section grows to hold them, a
 * linked widget's gap shows on its link line); a drag held near the preview's top or bottom edge
 * scrolls it. On release one edit, one undo step (onplace); a click changes nothing; Esc puts the
 * section back. An Auto widget's top or bottom edge moved by fewer than STRAY_ROWS rows changes
 * nothing; an Aspect corner keeps its ratio.
 */
import { COLS, MCOLS, ratioOf, sizeOf } from '../render/layout/index.js';
import { aspectRows, resolveRows } from '../render/layout/flow.js';
import { linesOf, nearest } from '../render/layout/geometry.js';
import { selectLink, setAnchor } from './svelte/ui.svelte.js';

/** An Auto widget's height dragged by fewer rows than this: a stray drag, nothing changes. */
const STRAY_ROWS = 2;

/**
 * `ctx`: the overlay's one state (S: S.drag is the drag running; its raf the auto-scroll's frame)
 * and its helpers. Gives start(e, el, h) (a press on the widget, or on its handle `h`) and
 * setArea(style, area, phone).
 */
export function createOverlayDrag(ctx) {
  const {
    S,
    idOf,
    widgetOf,
    secOf,
    isPhone,
    widgetsIn,
    flowOf,
    linkOfEl,
    minOf,
    noSelect,
    onplace,
    onpick,
    escKeys,
  } = ctx;

  /** A drag of widget `el`: move (h empty) or a resize by handle `h`. */
  function start(e, el, h = '') {
    const id = idOf(el);
    const stored = widgetOf(id);
    if (!stored) return;
    e.preventDefault();
    e.stopPropagation();
    selectLink(null);
    // a resize (its handle) or a move ends a text edit: the next press on the widget drags it,
    // it doesn't select its text (it stayed editable after a resize); and no text selected meanwhile
    if (S.doc.activeElement?.isContentEditable) S.doc.activeElement.blur();
    noSelect(true);
    const sec = secOf(el);
    const phone = isPhone();
    const saved = new Map([sec, ...widgetsIn(sec)].map((n) => [n, n.style.cssText]));
    // where the section's widgets are now (stored with the drag), then hold them there
    const flow = flowOf(sec, phone);
    const rows = Number(sec.style.getPropertyValue('--frows')) || 0;
    S.doc.documentElement.setAttribute('data-flow-hold', h ? 'resize' : 'move');
    const from = flow[id];
    // the section's widgets and links, to move the widgets that follow this one along
    const items = widgetsIn(sec)
      .filter((n) => flow[idOf(n)])
      .map((n) => ({
        id: idOf(n),
        el: n,
        ...flow[idOf(n)],
        link: n === el ? null : linkOfEl(n),
      }));
    S.drag = {
      id,
      el,
      sec,
      h,
      from,
      pos: from,
      x: e.clientX,
      y: e.clientY,
      // the preview's scroll at the start: a drag that scrolls it (autoScroll) counts it in
      sy: S.win.scrollY,
      // and how far it scrolls then: no further (the section grows as a widget goes down)
      maxY: Math.max(0, S.doc.documentElement.scrollHeight - S.win.innerHeight),
      last: null,
      raf: 0,
      phone,
      saved,
      cols: phone ? MCOLS : COLS,
      lines: linesOf(sec, S.win),
      flow,
      items,
      link: linkOfEl(el),
      gap: null,
      rows: rows || Number(sec.style.getPropertyValue(phone ? '--mrows' : '--rows')) || 1,
      // a Custom section keeps its rows (never fewer: its widgets move inside them)
      min: minOf(sec, phone),
    };
    S.els.sel.classList.add('is-dragging');
    if (!h) S.els.sel.classList.add('is-moving');
    S.win.addEventListener('pointermove', move, true);
    S.win.addEventListener('pointerup', end, true);
    escKeys(cancel, true);
  }

  /**
   * A drag held near the preview's top or bottom edge scrolls it, faster the closer, one row
   * a frame at most (phone rows are shorter: a 16px cap ran at about 61 rows, about 17 on
   * desktop: G15), and the widget goes along: a long move or resize reaches past what shows (G6).
   */
  const EDGE = 48;
  function autoScroll() {
    if (!S.drag || S.drag.raf || !S.drag.last) return;
    const speed = () => {
      const y = S.drag?.last?.clientY ?? EDGE;
      const top = EDGE - y;
      const bottom = y - (S.win.innerHeight - EDGE);
      const v = top > 0 ? -top : bottom > 0 ? bottom : 0;
      const row = (S.drag.lines?.row || 0) + (S.drag.lines?.rowGap || 0) || 16;
      const cap = Math.max(1, Math.round(row));
      return Math.round(Math.max(-cap, Math.min(cap, v / 3)));
    };
    const step = () => {
      if (!S.drag) return;
      S.drag.raf = 0;
      const v = speed();
      if (!v) return;
      const before = S.win.scrollY;
      const to = Math.max(0, Math.min(S.drag.maxY, before + v));
      if (to === before) return; // at the top or the page's end (as the drag started)
      S.win.scrollTo(S.win.scrollX, to);
      move(S.drag.last);
      S.drag.raf = S.win.requestAnimationFrame(step);
    };
    S.drag.raf = S.win.requestAnimationFrame(step);
  }

  function move(e) {
    const { lines, from, h } = S.drag;
    const { cols, rows, row, rowGap } = lines;
    S.drag.last = { clientX: e.clientX, clientY: e.clientY };
    autoScroll();
    const dx = e.clientX - S.drag.x;
    const dy = e.clientY - S.drag.y + (S.win.scrollY - S.drag.sy);
    const step = row + rowGap;
    const colStart = cols.starts[from.col - 1];
    const colEnd = cols.ends[from.col + from.span - 2];
    const rowStart =
      rows.starts[from.row - 1] ?? rows.ends.at(-1) + (from.row - rows.starts.length) * step;
    const rowEnd =
      rows.ends[from.row + from.rows - 2] ??
      rows.ends.at(-1) + (from.row + from.rows - 1 - rows.ends.length) * step;
    let { col, span, row: r, rows: n } = from;
    // an Auto / Aspect widget's height follows its content / width; its top or bottom edge
    // dragged (desktop) makes it a Rows widget of the rows dragged to (onplace's size)
    const free = sizeOf(widgetOf(S.drag.id)) !== 'rows' && S.drag.phone;
    if (!h) {
      col = Math.min(Math.max(1, nearest(cols.starts, colStart + dx)), S.drag.cols - span + 1);
      r = Math.max(1, nearest(rows.starts, rowStart + dy, step));
    }
    if (h.includes('e')) span = Math.max(1, nearest(cols.ends, colEnd + dx) - col + 1);
    if (h.includes('w')) {
      const end = from.col + from.span - 1;
      col = Math.min(nearest(cols.starts, colStart + dx), end);
      span = end - col + 1;
    }
    if (h.includes('s') && !free) n = Math.max(1, nearest(rows.ends, rowEnd + dy, step) - r + 1);
    if (h.includes('n') && !free) {
      const end = from.row + from.rows - 1;
      r = Math.min(Math.max(1, nearest(rows.starts, rowStart + dy, step)), end);
      n = end - r + 1;
    }
    span = Math.min(span, S.drag.cols - col + 1);
    // an Aspect widget's corner (desktop): its ratio kept, its rows follow its width, so its
    // size readout and the rows stored are the ones it shows (G7); its top or bottom edge
    // alone still makes it a Rows widget
    const ratio = aspectCorner(S.drag) && ratioOf(widgetOf(S.drag.id)?.aspect);
    if (ratio) {
      const width = cols.ends[col + span - 2] - cols.starts[col - 1];
      n = aspectRows(width, ratio, step);
      if (h.includes('n')) r = Math.max(1, from.row + from.rows - n);
    }
    S.drag.pos = { col, span, row: r, rows: n };
    show(S.drag.pos);
  }

  /** A desktop drag of an Aspect widget's corner (its ratio kept: move, end). */
  function aspectCorner(d) {
    return !d.phone && /[ns]/.test(d.h) && /[ew]/.test(d.h) && sizeOf(widgetOf(d.id)) === 'aspect';
  }

  /** An area as a widget's CSS variables (desktop, or the phone's; and where it is now). */
  function setArea(s, p, phone) {
    s.setProperty(phone ? '--mc' : '--c', p.col);
    s.setProperty(phone ? '--ms' : '--s', p.span);
    s.setProperty(phone ? '--mr' : '--r', p.row);
    s.setProperty(phone ? '--mrs' : '--rs', p.rows);
    s.setProperty('--fr', p.row);
    s.setProperty('--frs', p.rows);
  }

  /**
   * Show `pos` on the widget without storing it: the widgets that follow it move along, the
   * section's rows grow to hold them, and a linked widget's link line shows its gap (live).
   */
  function show(p) {
    setArea(S.drag.el.style, p, S.drag.phone);
    const items = S.drag.items.map((it) => (it.id === S.drag.id ? { ...it, ...p } : it));
    const { rows, at } = resolveRows(items, 1);
    for (const it of S.drag.items)
      if (it.id !== S.drag.id && at[it.id]) it.el.style.setProperty('--fr', at[it.id].row);
    // its content's rows (a Custom section grows to them on release: onplace's rows)
    S.drag.content = Math.max(rows, p.row + p.rows - 1);
    S.drag.sec.style.setProperty('--frows', Math.max(S.drag.min, S.drag.rows, S.drag.content));
    if (S.drag.link) {
      const lead = at[S.drag.link.to];
      if (lead) S.drag.gap = p.row - (lead.row + lead.rows);
    }
  }

  function stop() {
    if (S.drag?.raf) S.win.cancelAnimationFrame(S.drag.raf);
    noSelect(false);
    S.doc.documentElement.removeAttribute('data-flow-hold');
    S.win.removeEventListener('pointermove', move, true);
    S.win.removeEventListener('pointerup', end, true);
    escKeys(cancel, false);
    S.els.sel.classList.remove('is-dragging', 'is-moving');
  }

  /** The section and its widgets as they were before the drag. */
  function restore() {
    for (const [n, css] of S.drag.saved) n.style.cssText = css;
  }

  function end() {
    const { id, from, pos, phone, flow } = S.drag;
    const rows = S.drag.content || 0;
    // an Auto widget's top or bottom edge moved by a row (a stray drag) changes nothing: its
    // height is Auto until dragged at least STRAY_ROWS (F58)
    const auto = !phone && sizeOf(widgetOf(id)) !== 'rows';
    const stray =
      auto &&
      /[ns]/.test(S.drag.h) &&
      Math.abs(pos.rows - from.rows) < STRAY_ROWS &&
      ['col', 'span'].every((k) => pos[k] === from[k]);
    const moved = !stray && ['col', 'span', 'row', 'rows'].some((k) => pos[k] !== from[k]);
    if (!moved) restore(); // a click changes nothing
    const tall = /[ns]/.test(S.drag.h) && pos.rows !== from.rows && !aspectCorner(S.drag);
    const size = !phone && tall && sizeOf(widgetOf(id)) !== 'rows' ? 'rows' : undefined;
    const click = S.drag.click;
    stop();
    S.drag = null;
    if (moved) onplace(id, pos, { phone, flow, rows, size });
    else if (click) (setAnchor(click), onpick(click));
  }

  function cancel(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    restore();
    stop();
    S.drag = null;
  }

  return { start, setArea };
}
