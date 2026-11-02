/**
 * A Text widget's sizes. By default each line has its style's size (the site's stylesheets,
 * src/client/styles/_text.scss). Two things change that, both worked out live in the page
 * (src/client/modules/fit.js):
 *
 *   a line's "fit": true    Fit width (src/site/text.js): that line alone fills the widget's
 *                           WIDTH, on one line (its own --tkf); the other lines keep theirs
 *   the widget's "scale"    Scale to fit (the popup's switch, off by default): the whole text
 *                           at its styles' normal sizes, scaled down as one,
 *                           until it fits the widget's width and (a fixed height) its height
 *                           (the widget's --tks, never above 1); a fit line still fills the width
 *
 * Each text style is defined once, in cells of the 120-column grid (site.json "typography";
 * TEXT_STYLES are the defaults):
 *
 *   "typography": { "paragraph": { "size": 1.4, "line": 1.75, "tracking": 0, "min": 14 } }
 *
 *   size      font size in cells (on the phone grid half a cell each)
 *   line      line height, × the font size (so it scales with it)
 *   tracking  letter spacing, em (likewise)
 *   min       the smallest font size, px (a fit line has none)
 *
 * A fit line's size is in cells × its own factor (_layout.scss .ts[data-fit]).
 */
import { isObject } from '../is.js';
import { WIDGET_TYPES } from '../widgets/index.js';

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

/** Can a type's text scale to fit (its definition's `scaleToFit`: Scale to fit)? */
export const canScale = (type) =>
  (typeof type === 'string' ? WIDGET_TYPES[type] : type)?.scaleToFit === true;

/** Can a type's lines each fill its width (its definition's `fitWidth`: Fit width)? */
export const canFitWidth = (type) =>
  (typeof type === 'string' ? WIDGET_TYPES[type] : type)?.fitWidth === true;

/** Does a widget's text scale down to fit it (Scale to fit)? */
export const scaled = (widget) => canScale(widget?.type) && widget?.scale === true;

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

/** Problems of a widget's "scale" (and the whole-widget "fit" a line's "fit" replaced). */
export function checkScale(widget) {
  const out = [];
  if (widget?.fit !== undefined)
    out.push(
      '"fit" is a line\'s now (a line\'s "fit": true): node scripts/rename-0-2-0.mjs converts it',
    );
  if (widget?.scale === undefined) return out;
  if (!canScale(widget.type)) {
    const types = Object.values(WIDGET_TYPES).filter(canScale);
    out.push(`"scale" is for text widgets (${types.map((t) => t.type).join(', ')})`);
  } else if (widget.scale !== true) out.push('"scale" must be true (or left out: off)');
  return out;
}
