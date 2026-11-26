/**
 * How wide a contained section is (theme.json "layout": { "containedCols": N }): N columns of the
 * full-width grid's cell (the window's width / 120), centred, but never nearer the window's
 * edges than the page's side margin (--pad). Its content is still a 120-column grid (its
 * cells as much smaller as it is narrower), so a widget keeps its columns whatever N is: a
 * narrower N scales a contained section's layout down, like a narrower window.
 *
 * The default, 115, is the look before this setting: up to 1920px wide the side margin
 * (clamp(16px, 2.6vw, 40px)) is the narrower of the two, so nothing changed; wider screens
 * keep 115/120 of the width (where the margin alone stopped at 40px).
 * Phones (below 760px): a contained section is the 60-column grid inside the side margins,
 * as before (N doesn't apply: on a phone every column counts).
 *
 * The CSS (_layout.scss) reads --contain on :root (head, shell/layout.js); Theme › Layout
 * shows the widths at common window sizes (containedWidth).
 */
import { COLS, MCOLS } from './grid.js';
import { layoutSpaceVars, spaceRows } from './space.js';

export const CONTAINED = 115;
export const CONTAINED_MIN = 60;
/** --pad in _tokens.scss: clamp(16px, 2.6vw, 40px). */
const padAt = (vw) => Math.min(40, Math.max(16, vw * 0.026));

/** theme.json's contained columns (the default when unset or invalid). */
export function containedOf(theme) {
  const n = theme?.layout?.containedCols;
  return Number.isInteger(n) && n >= CONTAINED_MIN && n <= COLS ? n : CONTAINED;
}

/** A contained section's content width, px, in a window `vw` px wide (desktop). */
export const containedWidth = (vw, n = CONTAINED) => Math.min(vw - 2 * padAt(vw), (vw * n) / COLS);

/**
 * A grid row, px, in a window `vw` px wide (--grid-row in _tokens.scss: a contained section's
 * square cell): desktop with `n` contained columns, or a phone's (`phone`: the 60-column grid
 * inside the side margins). The Header's Style tab shows its rows in px with it.
 */
export const gridRowPx = (vw, n = CONTAINED, phone = false) =>
  phone ? (vw - 2 * padAt(vw)) / MCOLS : containedWidth(vw, n) / COLS;

/** The :root variables, when they aren't the default: [[name, value]]. */
export function layoutVarList(theme) {
  const out = [];
  const n = containedOf(theme);
  if (n !== CONTAINED) out.push(['--contain', String(n)]);
  for (const d of layoutSpaceVars(theme)) out.push(d.split(': '));
  return out;
}

/** The layout's :root declarations ('' when all are the defaults). */
export const layoutVars = (theme) =>
  layoutVarList(theme)
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');

/** Every layout variable name (the editor's preview clears the ones no longer set). */
export const LAYOUT_VARS = ['--contain', '--section-space', '--section-space-phone'];

/** Problems of theme.json "layout". */
export function checkLayout(l) {
  if (l === undefined) return [];
  if (!l || typeof l !== 'object' || Array.isArray(l))
    return ['"layout" must be an object { containedCols, sectionSpace, sectionSpacePhone }'];
  const out = [];
  const n = l.containedCols;
  if (n !== undefined && !(Number.isInteger(n) && n >= CONTAINED_MIN && n <= COLS))
    out.push(
      `"layout.containedCols" must be a whole number of columns from ${CONTAINED_MIN} to ${COLS}`,
    );
  const rows = (key) => {
    if (l[key] !== undefined && spaceRows(l[key]) === null)
      out.push(`"layout.${key}" must be a whole number of rows from 0 to 999`);
  };
  rows('sectionSpace');
  rows('sectionSpacePhone');
  const keys = ['containedCols', 'sectionSpace', 'sectionSpacePhone'];
  for (const k of Object.keys(l))
    if (!keys.includes(k)) out.push(`"layout.${k}" is not a layout setting`);
  return out;
}
