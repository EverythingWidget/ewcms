/**
 * The square grid's numbers and areas, without the rest of the layout engine (the page's
 * src/client/modules/rows.js imports them): see ./index.js.
 */
import { isObject } from '../is.js';
export const COLS = 120;
/**
 * Columns of the phone grid (a widget's `phone` area): 60, half of 120, ~6px cells at 390px.
 * A widget without a phone layout of its own stacks there full width (phoneStack).
 */
export const MCOLS = 60;
/** The widest phone (px): at or below it the phone grid and image sizes. */
export const PHONE_MAX = 760;
/** PHONE_MAX as a media query, for matchMedia and an <img> sizes. */
export const PHONE_MQ = `(max-width: ${PHONE_MAX}px)`;
/**
 * The size of a cell in px: a section's content width over its columns, floored to the
 * browser's layout unit (1/64 px) so a column and a row come out exactly as wide as tall
 * (the few px left over are centred). src/client/modules/rows.js sets it as --cell.
 */
export const cellOf = (width, cols = COLS) =>
  width > 0 ? Math.max(1 / 64, Math.floor((width / cols) * 64) / 64) : 0;

const int = (v, min, fallback) => (Number.isInteger(v) && v >= min ? v : fallback);

/** A widget's grid area, completed and kept inside `cols` columns (120; the phone grid's 60). */
export function placeOf(pos, cols = COLS) {
  const col = Math.min(int(pos?.col, 1, 1), cols);
  return {
    col,
    span: Math.min(int(pos?.span, 1, cols), cols - col + 1),
    row: int(pos?.row, 1, 1),
    rows: int(pos?.rows, 1, 1),
  };
}

/** Does a widget's `phone` hold an area (it can hold only a link)? */
export const hasMobileArea = (m) => !!m && AREA_KEYS.some((k) => m[k] !== undefined);

/**
 * A desktop area halved onto the phone grid: the cells it covers, half as many (its first
 * column and row rounded down, its last ones up, so it covers at least what it did).
 */
export function halfArea(pos) {
  const p = placeOf(pos);
  const col = Math.floor((p.col - 1) / 2) + 1;
  const end = Math.ceil((p.col + p.span - 1) / 2);
  const row = Math.floor((p.row - 1) / 2) + 1;
  return { col, span: Math.max(1, end - col + 1), row, rows: Math.max(1, Math.ceil(p.rows / 2)) };
}

/** Rows between two widgets stacked on a phone by default (phoneStack): about 26px at 390px. */
export const STACK_GAP = 4;

/** Is a widget's phone layout its own (an area or a link set in the phone view)? */
const ownPhone = (widget) => {
  const m = phoneOf(widget);
  return hasMobileArea(m) || isObject(m?.link);
};

/**
 * The default phone layout of a section's widgets (`widgets`): the ones without a phone layout
 * of their own (not hidden there or switched off) stack full width in reading order (their
 * desktop top, then left), each following the one before with STACK_GAP rows between them (its
 * desktop gap halved when it follows that one on the desktop too: a caption over an image), so an
 * Auto one that grows pushes the rest down (src/client/modules/rows.js); the first keeps its
 * desktop top halved. A Rows widget keeps its desktop shape (its rows over its width). Map
 * id -> { area, link } (link null: the first).
 */
export function phoneStack(widgets) {
  const list = (Array.isArray(widgets) ? widgets : []).filter(
    (widget) =>
      widget?.id &&
      widget.layout?.phone !== null &&
      widget.config?.enabled !== false &&
      !ownPhone(widget),
  );
  // the desktop top: a linked widget's from its leader's (stored rows), the stored row else
  const byId = new Map(list.map((widget) => [widget.id, widget]));
  const tops = new Map();
  const topOf = (widget, seen = new Set()) => {
    if (tops.has(widget.id)) return tops.get(widget.id);
    const p = placeOf(baseOf(widget));
    const l = baseOf(widget).link;
    const lead = isObject(l) && byId.get(l.to);
    let top = p.row;
    if (lead && !seen.has(widget.id)) {
      seen.add(widget.id);
      const at = topOf(lead, seen);
      // after its leader in reading order, even overlapping it (a negative gap)
      top = Math.max(at + placeOf(baseOf(lead)).rows + (Number(l.gap) || 0), at + 0.5);
    }
    tops.set(widget.id, top);
    return top;
  };
  const order = list
    .map((widget, i) => ({ widget, i, top: topOf(widget), col: placeOf(baseOf(widget)).col }))
    .sort((x, y) => x.top - y.top || x.col - y.col || x.i - y.i);
  const out = new Map();
  let prev = null;
  for (const { widget } of order) {
    const p = placeOf(baseOf(widget));
    const rows =
      widget.size === 'rows'
        ? Math.max(1, Math.round((p.rows * MCOLS) / p.span))
        : halfArea(p).rows;
    // following the one before on the desktop too: its gap there, halved
    const l = baseOf(widget).link;
    const gap =
      prev && isObject(l) && l.to === prev.id && Number.isInteger(l.gap ?? 0)
        ? Math.sign(l.gap || 0) * Math.round(Math.abs(l.gap || 0) / 2)
        : STACK_GAP;
    const row = prev ? Math.max(1, prev.area.row + prev.area.rows + gap) : halfArea(p).row;
    const area = { col: 1, span: MCOLS, row, rows };
    out.set(widget.id, (prev = { area, link: prev ? { to: prev.id, gap } : null, id: widget.id }));
  }
  return out;
}

/**
 * A widget's area on the phone grid: its own phone area; else, given its section's widgets, its
 * place in their default stack (phoneStack); else its desktop area halved.
 */
export function phoneAreaOf(widget, widgets) {
  if (hasMobileArea(phoneOf(widget))) return placeOf(phoneOf(widget), MCOLS);
  const s = widgets && phoneStack(widgets).get(widget?.id);
  return s ? s.area : halfArea(baseOf(widget));
}

/*
 * A widget's layout: { base, phone? } (./index.js). base: its area on the page grid
 * { col, span, row, rows? } plus its `link`; phone: what changes on phones, any of the same
 * keys on the phone grid (an area, a link). `rows` is stored only when the
 * widget's height isn't its content's (size "aspect" or "rows"): an auto widget's rows are
 * measured on the page (src/client/modules/rows.js), never stored.
 */
/** The keys of an area. */
export const AREA_KEYS = ['col', 'span', 'row', 'rows'];
/** A widget's base layout ({} without one). */
export const baseOf = (widget) => (isObject(widget?.layout?.base) ? widget.layout.base : {});
/** A widget's phone layout (undefined without one). */
export const phoneOf = (widget) =>
  isObject(widget?.layout?.phone) ? widget.layout.phone : undefined;
/** Does a widget store its rows (its height isn't its content's)? */
export const storesRows = (widget) => widget?.size === 'aspect' || widget?.size === 'rows';

function tidy(widget, o) {
  const next = { ...o };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  if (!storesRows(widget)) delete next.rows;
  return next;
}
/** Merge `patch` into a widget's base (a key set to undefined is removed). */
export function setBase(widget, patch) {
  widget.layout = {
    ...(isObject(widget.layout) ? widget.layout : {}),
    base: tidy(widget, { ...baseOf(widget), ...patch }),
  };
}
/** Merge `patch` into a widget's phone layout; removed when nothing is left (null: removed). */
export function setPhone(widget, patch) {
  const next = patch === null ? {} : tidy(widget, { ...phoneOf(widget), ...patch });
  const layout = { ...(isObject(widget.layout) ? widget.layout : {}) };
  if (Object.keys(next).length) layout.phone = next;
  else delete layout.phone;
  widget.layout = layout;
}
