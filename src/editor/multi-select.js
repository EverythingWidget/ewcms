/**
 * Multi-select (v0.1.24): the Content tab's selection is a set of widgets, all in one section.
 * There is no primary widget: every selected one looks and acts the same. One selected is
 * ui.widget (its pop-up, toolbar and handles, as before); two or more are ui.multi (no pop-up,
 * no handles: the shared actions only). Pure helpers, no DOM: the overlay (preview) and the
 * section cards (panel) call them.
 *
 *   selectedIds(ui)            the selection as ids (ui.multi, else [ui.widget], else [])
 *   toggle(ids, id, secOf)     Ctrl/Cmd+click: `id` in or out; a widget of another section is
 *                              refused (null): the selection stays in its section
 *   range(order, anchor, id)   Shift+click in a card's list: anchor..id in the list's order
 *   hits(rects, box)           box select: the ids whose rect the box touches
 *   clampDelta(areas, dc, dr, cols)  a group move by whole cells, clamped by the group's
 *                              bounding box: it stays inside the grid (col 1..cols, row ≥ 1)
 *   nudgeStep(shift)           an arrow key's cells: 1, Shift 5
 */
export const NUDGE = 1;
export const NUDGE_BIG = 5;

export const selectedIds = (ui) =>
  ui.multi?.length ? [...ui.multi] : ui.widget ? [ui.widget] : [];

export function toggle(ids, id, secOf) {
  if (ids.length && ids.some((x) => secOf(x) !== secOf(id))) return null;
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function range(order, anchor, id) {
  const a = order.indexOf(anchor);
  const b = order.indexOf(id);
  if (b < 0) return [];
  if (a < 0) return [id];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}

export function hits(rects, box) {
  const x2 = box.x + box.w;
  const y2 = box.y + box.h;
  return Object.entries(rects)
    .filter(([, r]) => r.x <= x2 && r.x + r.w >= box.x && r.y <= y2 && r.y + r.h >= box.y)
    .map(([id]) => id);
}

export function clampDelta(areas, dc, dr, cols) {
  const list = Object.values(areas);
  if (!list.length) return { dc: 0, dr: 0 };
  const left = Math.min(...list.map((a) => a.col));
  const right = Math.max(...list.map((a) => a.col + a.span - 1));
  const top = Math.min(...list.map((a) => a.row));
  return {
    dc: Math.min(Math.max(dc, 1 - left), cols - right),
    dr: Math.max(dr, 1 - top),
  };
}

export const nudgeStep = (shift) => (shift ? NUDGE_BIG : NUDGE);
