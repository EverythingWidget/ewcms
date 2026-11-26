/**
 * The header's height as a number of grid rows (content/header.json, the Header's Style tab):
 *
 *   "rows": 7,        the header's height on desktop, in rows of the grid
 *   "rowsPhone": 11   on phones (below 760px); left out: the same number of rows as desktop
 *
 * A row is a contained section's square cell (--grid-row, src/client/styles/_tokens.scss): on
 * desktop 1/120 of the contained width, on phones 1/60 of the width inside the side margins, so
 * the header grows with the window as the sections' rows do. Site-wide, no per-page value.
 * They set --header-h (the header's height, the first section's top padding: modules/navbar.js)
 * in <style id="header-rows"> in the head (shell/layout.js), :root:root so they beat the theme's
 * tokens.scss --header-h. Left out (no "rows" and no "rowsPhone"): nothing is written and the
 * theme's tokens.scss --header-h is the height, as before. Only "rowsPhone": phones only.
 */
export const MAX_HEADER_ROWS = 30;
export const HEADER_ROW_KEYS = ['rows', 'rowsPhone'];
/** The phone breakpoint ($bp-sm in src/client/styles/_tokens.scss: a media query takes no var). */
const PHONE = '(width <= 760px)';

/** A stored row count, or null when it isn't a whole number from 1 to MAX_HEADER_ROWS. */
export const headerRows = (v) => (Number.isInteger(v) && v >= 1 && v <= MAX_HEADER_ROWS ? v : null);

/** header.json's rows: { rows, rowsPhone } (null: not set); rowsPhone follows rows when unset. */
export function headerRowsOf(header) {
  const rows = headerRows(header?.rows);
  return { rows, rowsPhone: headerRows(header?.rowsPhone) ?? rows };
}

const height = (n) => `:root:root { --header-h: calc(${n} * var(--grid-row)); }`;

/** The header-rows style's CSS ('' when header.json sets no rows: the theme's --header-h). */
export function headerRowsCss(header) {
  const { rows, rowsPhone } = headerRowsOf(header);
  return [
    rows ? height(rows) : '',
    rowsPhone && rowsPhone !== rows ? `@media ${PHONE} { ${height(rowsPhone)} }` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Problems of header.json's rows (validate.js, ewcms check). */
export function checkHeaderRows(d) {
  return HEADER_ROW_KEYS.filter((k) => d?.[k] !== undefined && headerRows(d[k]) === null).map(
    (k) =>
      `"${k}" must be a whole number of grid rows from 1 to ${MAX_HEADER_ROWS} (the header's height)`,
  );
}
