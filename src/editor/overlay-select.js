/**
 * The layout overlay's selection (overlay.js, multi-select.js): several selected widgets dragged
 * together by whole cells (clamped as one, the widgets that follow them along), a click without a
 * move picking the one under the pointer; the arrow keys' nudge (keys.js); and the selection box
 * drawn on a section's empty grid, selecting the widgets it touches (Ctrl/Cmd: added). Each one
 * undo step on release (ongroupmove, onselect); Esc puts the section or the selection back.
 */
import { COLS, MCOLS } from '../render/layout/index.js';
import { resolveRows } from '../render/layout/flow.js';
import { boxOf, linesOf, rectOf } from '../render/layout/geometry.js';
import { clampDelta, hits, selectedIds } from './multi-select.js';
import { setAnchor } from './svelte/ui.svelte.js';

/**
 * `ctx`: the overlay's one state (S: S.group and S.boxing are the drags running) and its helpers,
 * setArea and minOf too (overlay-drag.js, overlay-rows.js). Gives startGroup(e, ids, el),
 * nudge(dc, dr) and startBox(e, sec, base).
 */
export function createOverlaySelect(ctx) {
  const {
    S,
    ui,
    arranging,
    tplOpen,
    idOf,
    secOf,
    widgetEl,
    widgetsIn,
    widgetOf,
    isPhone,
    flowOf,
    linkOfEl,
    minOf,
    setArea,
    noSelect,
    kick,
    onpick,
    onselect,
    onsectionpick,
    ongroupmove,
    escKeys,
  } = ctx;

  /** The step of one cell (px) on a section's lines: columns, rows. */
  const stepsOf = (lines) => ({
    col: lines.cols.starts[1] - lines.cols.starts[0] || lines.row + lines.rowGap,
    row: lines.row + lines.rowGap,
  });

  /** What a group move starts from: the section, its flow, the members' areas. */
  function groupOf(ids) {
    const sec = secOf(widgetEl(ids[0]));
    if (!sec) return null;
    const phone = isPhone();
    const flow = flowOf(sec, phone);
    const members = ids
      .map((id) => ({ id, el: widgetEl(id), from: flow[id] }))
      .filter((m) => m.el && m.from);
    if (!members.length) return null;
    return { sec, phone, flow, members, cols: phone ? MCOLS : COLS };
  }

  /** A drag of the selected widgets `ids` (one of them, `el`, under the pointer): all move. */
  function startGroup(e, ids, el) {
    const g = groupOf(ids);
    if (!g) return;
    e.preventDefault();
    e.stopPropagation();
    const { sec, phone, flow } = g;
    const rows = Number(sec.style.getPropertyValue('--frows')) || 0;
    S.doc.documentElement.setAttribute('data-flow-hold', 'move');
    S.els.sel.classList.add('is-dragging', 'is-moving');
    S.group = {
      ...g,
      el,
      saved: new Map([sec, ...widgetsIn(sec)].map((n) => [n, n.style.cssText])),
      x: e.clientX,
      y: e.clientY,
      lines: linesOf(sec, S.win),
      items: widgetsIn(sec)
        .filter((n) => flow[idOf(n)])
        .map((n) => ({
          id: idOf(n),
          el: n,
          ...flow[idOf(n)],
          link: ids.includes(idOf(n)) ? null : linkOfEl(n),
        })),
      dc: 0,
      dr: 0,
      rows: rows || Number(sec.style.getPropertyValue(phone ? '--mrows' : '--rows')) || 1,
      min: minOf(sec, phone),
    };
    noSelect(true);
    S.win.addEventListener('pointermove', moveGroup, true);
    S.win.addEventListener('pointerup', endGroup, true);
    escKeys(cancelGroup, true);
  }

  function moveGroup(e) {
    const st = stepsOf(S.group.lines);
    const areas = Object.fromEntries(S.group.members.map((m) => [m.id, m.from]));
    const d = clampDelta(
      areas,
      Math.round((e.clientX - S.group.x) / st.col),
      Math.round((e.clientY - S.group.y) / st.row),
      S.group.cols,
    );
    if (d.dc === S.group.dc && d.dr === S.group.dr) return;
    S.group.dc = d.dc;
    S.group.dr = d.dr;
    showGroup();
  }

  /** The members at their area + the delta, the widgets that follow them along (live). */
  function showGroup() {
    const { dc, dr, phone } = S.group;
    const at = {};
    for (const m of S.group.members) {
      at[m.id] = { ...m.from, col: m.from.col + dc, row: m.from.row + dr };
      setArea(m.el.style, at[m.id], phone);
    }
    const items = S.group.items.map((it) => (at[it.id] ? { ...it, ...at[it.id] } : it));
    const res = resolveRows(items, 1);
    for (const it of S.group.items)
      if (!at[it.id] && res.at[it.id]) it.el.style.setProperty('--fr', res.at[it.id].row);
    S.group.content = Math.max(res.rows, ...Object.values(at).map((p) => p.row + p.rows - 1));
    S.group.sec.style.setProperty('--frows', Math.max(S.group.min, S.group.rows, S.group.content));
  }

  function stopGroup() {
    S.doc.documentElement.removeAttribute('data-flow-hold');
    S.els.sel.classList.remove('is-dragging', 'is-moving');
    noSelect(false);
    S.win.removeEventListener('pointermove', moveGroup, true);
    S.win.removeEventListener('pointerup', endGroup, true);
    escKeys(cancelGroup, false);
  }

  function endGroup() {
    const g = S.group;
    stopGroup();
    S.group = null;
    const moved = g.dc || g.dr;
    if (!moved) {
      for (const [n, css] of g.saved) n.style.cssText = css;
      // a click (no move) on one of them: that one only
      setAnchor(idOf(g.el));
      onpick(idOf(g.el));
      return;
    }
    ongroupmove(
      g.members.map((m) => m.id),
      g.dc,
      g.dr,
      {
        phone: g.phone,
        flow: g.flow,
        rows: g.content || 0,
      },
    );
  }

  function cancelGroup(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    for (const [n, css] of S.group.saved) n.style.cssText = css;
    stopGroup();
    S.group = null;
  }

  /** Arrow keys: the selection moved by whole cells (clamped as a drag), one undo step. */
  function nudge(dc, dr) {
    const ids = selectedIds(ui);
    if (!S.doc || !arranging() || !ids.length) return false;
    const g = groupOf(ids);
    if (!g) return false;
    const d = clampDelta(Object.fromEntries(g.members.map((m) => [m.id, m.from])), dc, dr, g.cols);
    if (d.dc || d.dr)
      ongroupmove(
        g.members.map((m) => m.id),
        d.dc,
        d.dr,
        { phone: g.phone, flow: g.flow },
      );
    return true;
  }

  /**
   * A selection box: dragged on a section's empty grid, it selects the widgets it touches (in
   * that section; `base`: kept too, Ctrl/Cmd+drag). A click without a drag clears (or, with
   * Ctrl/Cmd, keeps) the selection.
   */
  function startBox(e, sec, base) {
    e.preventDefault();
    e.stopPropagation();
    if (S.doc.activeElement?.isContentEditable) S.doc.activeElement.blur();
    S.boxing = {
      sec,
      base,
      x: e.pageX,
      y: e.pageY,
      box: null,
      mod: base.length > 0 || e.ctrlKey || e.metaKey,
    };
    noSelect(true);
    S.win.addEventListener('pointermove', moveBox, true);
    S.win.addEventListener('pointerup', endBox, true);
    escKeys(cancelBox, true);
    kick();
  }

  function moveBox(e) {
    const { sec, x, y } = S.boxing;
    if (!S.boxing.box && Math.hypot(e.pageX - x, e.pageY - y) < 4) return;
    // inside its section's grid
    const s = rectOf(sec, S.win);
    const cx = (v) => Math.min(Math.max(v, s.x), s.x + s.w);
    const cy = (v) => Math.min(Math.max(v, s.y), s.y + s.h);
    const x1 = cx(Math.min(x, e.pageX));
    const x2 = cx(Math.max(x, e.pageX));
    const y1 = cy(Math.min(y, e.pageY));
    const y2 = cy(Math.max(y, e.pageY));
    S.boxing.box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    const rects = Object.fromEntries(
      widgetsIn(sec)
        .filter((n) => !n.hidden && widgetOf(idOf(n)))
        .map((n) => [idOf(n), boxOf(n, S.win)]),
    );
    const ids = [...new Set([...S.boxing.base, ...hits(rects, S.boxing.box)])];
    if (ids.join() !== selectedIds(ui).join()) onselect(ids);
  }

  function stopBox() {
    noSelect(false);
    S.win.removeEventListener('pointermove', moveBox, true);
    S.win.removeEventListener('pointerup', endBox, true);
    escKeys(cancelBox, false);
  }

  function endBox() {
    const b = S.boxing;
    stopBox();
    S.boxing = null;
    // a click on a section's empty space: that section selected, alone (Ctrl/Cmd: the
    // selection stays)
    // (a template's item: nothing selected, its one section has no settings of its own here)
    if (b.box || b.mod) return;
    if (tplOpen()) onpick(null);
    else onsectionpick(b.sec.dataset.sec);
  }

  function cancelBox(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    const b = S.boxing;
    stopBox();
    S.boxing = null;
    onselect(b.base);
  }

  return { startGroup, nudge, startBox };
}
