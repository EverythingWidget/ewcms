/**
 * Space between sections, in grid rows (F90). Not a px/rem token: a whole number of the
 * section's own square cells (--cell). Site-wide only: theme.json layout.sectionSpace and
 * layout.sectionSpacePhone (Theme › Layout). A section has no space of its own (its old
 * sectionSpace / sectionSpacePhone is a gone key, ignored: more above one section is empty
 * rows above its widgets).
 *
 * Unset means 0 (existing pages stay put). On phones, an unset phone value uses the same
 * row count as the desktop value (not half). The first
 * visible section of a page does not use this (it already starts under the header);
 * the first footer section does (src/client/styles/_layout.scss).
 */
// same ceiling as a custom height's rows (MAX_MIN_ROWS in ./index.js)
const MAX = 999;

/** A stored row count, or null when it isn't a whole number from 0 to 999. */
export function spaceRows(v) {
  return Number.isInteger(v) && v >= 0 && v <= MAX ? v : null;
}

/** The site's desktop space (theme.json layout.sectionSpace), or 0 when unset. */
export function siteSectionSpaceOf(theme) {
  return spaceRows(theme?.layout?.sectionSpace) ?? 0;
}

/**
 * The site's phone space: layout.sectionSpacePhone when set (0 is set), else the same
 * count as the desktop value.
 */
export function siteSectionSpacePhoneOf(theme) {
  return spaceRows(theme?.layout?.sectionSpacePhone) ?? siteSectionSpaceOf(theme);
}

/**
 * A typed value turned into a stored row count (0..999, rounded). null: clear
 * (unset: 0, or the phone following the desktop).
 */
export function clampSpaceRows(v) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(MAX, Math.max(0, Math.round(v)));
}

/**
 * CSS variables for :root from the site's layout space (nothing when unset, so 0 stays
 * the default). Phone is emitted even at 0, so it can override the desktop count.
 */
export function layoutSpaceVars(theme) {
  const out = [];
  const space = spaceRows(theme?.layout?.sectionSpace);
  if (space) out.push(`--section-space: ${space}`);
  const phone = spaceRows(theme?.layout?.sectionSpacePhone);
  if (phone !== null) out.push(`--section-space-phone: ${phone}`);
  return out;
}
