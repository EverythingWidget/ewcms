/**
 * Space between sections, in grid rows (F90). Not a px/rem token: a whole number of the
 * section's own square cells (--cell). The keys are laid out so they can be renamed:
 *
 *   theme.json  layout.sectionSpace, layout.sectionSpacePhone
 *   a section  sectionSpace, sectionSpacePhone
 *
 * Unset at the site means 0 (existing pages stay put). A section without its own value
 * follows the site; a section's 0 is an override (no extra space there). On phones, an
 * unset phone value uses the same row count as the desktop value (not half). The first
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

/** Does this section store its own desktop space (including 0)? */
export const hasOwnSectionSpace = (s) => spaceRows(s?.sectionSpace) !== null;

/** Does this section store its own phone space (including 0)? */
export const hasOwnSectionSpacePhone = (s) => spaceRows(s?.sectionSpacePhone) !== null;

/** A section's desktop space: its own, else the site's, else 0. */
export function sectionSpaceOf(s, theme) {
  return spaceRows(s?.sectionSpace) ?? siteSectionSpaceOf(theme);
}

/**
 * A section's phone space: its own, else its desktop override, else the site's phone
 * value (which itself falls back to the site's desktop count).
 */
export function phoneSectionSpaceOf(s, theme) {
  const own = spaceRows(s?.sectionSpacePhone);
  if (own !== null) return own;
  if (hasOwnSectionSpace(s)) return s.sectionSpace;
  return siteSectionSpacePhoneOf(theme);
}

/**
 * A typed value turned into a stored row count (0..999, rounded). null: clear
 * (the site default, or the phone following the desktop).
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
