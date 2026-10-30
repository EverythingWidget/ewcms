/**
 * Fit text: a text widget (FIT_TYPES) with "fit": true has its text as large as fills the
 * widget's WIDTH, its longest line edge to edge (each line on one line, never by its height),
 * worked out live in the page (src/client/modules/fit.js: --tkf). Off (the default), a text has
 * its style's size (the site's stylesheets).
 *
 * Each text style is defined once, in cells of the 120-column grid (site.json "typography";
 * TEXT_STYLES are the defaults):
 *
 *   "typography": { "paragraph": { "size": 1.4, "line": 1.75, "tracking": 0, "min": 14 } }
 *
 *   size      font size in cells (on the phone grid half a cell each)
 *   line      line height, × the font size (so it scales with it)
 *   tracking  letter spacing, em (likewise)
 *   min       the smallest font size, px (fitted text has none)
 *
 * A fitted widget's texts keep their styles' proportions (_layout.scss .wgt--fit): one factor
 * over them all.
 */
import { isObject } from '../is.js';

/** The text styles and their defaults (sizes in cells; at 1440px a cell is ~11.3px). */
export const TEXT_STYLES = {
  title: { label: 'Title', size: 19, line: 0.82, tracking: -0.02, min: 40 },
  heading: { label: 'Heading', size: 3, line: 1.1, tracking: -0.01, min: 20 },
  paragraph: { label: 'Paragraph', size: 1.4, line: 1.75, tracking: 0, min: 14 },
  label: { label: 'Label', size: 1, line: 1.3, tracking: 0.08, min: 10 },
  subheading: { label: 'Subheading', size: 2, line: 1.2, tracking: -0.005, min: 18 },
  statement: { label: 'Statement', size: 5, line: 1.06, tracking: -0.005, min: 26 },
  small: { label: 'Small', size: 1.05, line: 1.5, tracking: 0, min: 11 },
};
const STYLE_KEYS = ['size', 'line', 'tracking', 'min'];

/** Widget types whose text can fit (the toolbar's Fit). */
export const FIT_TYPES = ['text', 'button'];

/** Is a widget's text fitted to its width? */
export const fitted = (widget) => FIT_TYPES.includes(widget?.type) && widget?.fit === true;

/** site.json typography merged over the defaults: { style: { size, line, tracking, min } }. */
export function typographyOf(site) {
  const own = isObject(site?.typography) ? site.typography : {};
  return Object.fromEntries(
    Object.entries(TEXT_STYLES).map(([k, d]) => {
      const o = isObject(own[k]) ? own[k] : {};
      const pick = (key) =>
        typeof o[key] === 'number' && Number.isFinite(o[key]) ? o[key] : d[key];
      return [k, Object.fromEntries(STYLE_KEYS.map((key) => [key, pick(key)]))];
    }),
  );
}

/** The CSS variables of site.json's typography (only what differs from the defaults). */
export function typographyVars(site) {
  const t = typographyOf(site);
  const out = [];
  for (const [k, s] of Object.entries(t)) {
    const d = TEXT_STYLES[k];
    if (s.size !== d.size) out.push(`--ts-${k}: ${s.size}`);
    if (s.line !== d.line) out.push(`--ts-${k}-lh: ${s.line}`);
    if (s.tracking !== d.tracking) out.push(`--ts-${k}-tr: ${s.tracking}em`);
    if (s.min !== d.min) out.push(`--ts-${k}-min: ${s.min}px`);
  }
  return out.join('; ');
}

/** Problems of site.json "typography". */
export function checkTypography(t) {
  if (t === undefined) return [];
  if (!isObject(t))
    return ['"typography" must be an object { <style>: { size, line, tracking, min } }'];
  const out = [];
  for (const [k, s] of Object.entries(t)) {
    if (!TEXT_STYLES[k]) {
      out.push(`typography: unknown style "${k}" (${Object.keys(TEXT_STYLES).join(', ')})`);
      continue;
    }
    if (!isObject(s)) {
      out.push(`typography.${k} must be an object { size, line, tracking, min }`);
      continue;
    }
    for (const key of Object.keys(s)) {
      const v = s[key];
      if (!STYLE_KEYS.includes(key)) out.push(`typography.${k}: unknown key "${key}"`);
      else if (typeof v !== 'number' || !Number.isFinite(v))
        out.push(`typography.${k}.${key} must be a number`);
      else if (key !== 'tracking' && v <= 0 && !(key === 'min' && v === 0))
        out.push(`typography.${k}.${key} must be more than 0`);
    }
  }
  return out;
}

/** Problems of a widget's "fit" (and the "scale" it replaced). */
export function checkFit(widget) {
  const out = [];
  if (widget?.scale !== undefined)
    out.push('"scale" is gone: use "fit": true (fit text to the width)');
  if (widget?.fit === undefined) return out;
  if (!FIT_TYPES.includes(widget.type))
    out.push(`"fit" is for text widgets (${FIT_TYPES.join(', ')})`);
  else if (typeof widget.fit !== 'boolean') out.push('"fit" must be true or false');
  return out;
}
