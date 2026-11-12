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
 * Each style's usual size is the site's type scale (site.json "type"; TYPE_SCALE are the
 * defaults, the same as the theme's in src/client/styles/_tokens.scss):
 *
 *   "type": { "heading": { "min": 38, "max": 104, "line": 0.92 } }
 *
 *   min, max  the font size, px: it grows with the window between the two (equal: fixed)
 *   line      line height, × the font size
 *
 * Each left out is the theme's. They become CSS variables on the page's :root
 * (--type-<style>-min, -max, -lh; typeVars), so they change the site, never the editor.
 *
 * Fit width starts from TEXT_STYLES' size in cells (--ts-<style>, _tokens.scss), only a
 * starting point: the line's own factor (--tkf) scales it to the widget's width.
 * A fit line's size is in cells × its own factor (_layout.scss .ts[data-fit]).
 */
import { isObject } from '../is.js';
import { WIDGET_TYPES } from '../widgets/index.js';

/** The text styles and a Fit width line's starting sizes (in cells; at 1440px a cell is ~11.3px). */
export const TEXT_STYLES = {
  title: { label: 'Title', size: 19, line: 0.82, tracking: -0.02, min: 40 },
  heading: { label: 'Heading', size: 3, line: 1.1, tracking: -0.01, min: 20 },
  paragraph: { label: 'Paragraph', size: 1.4, line: 1.75, tracking: 0, min: 14 },
  label: { label: 'Label', size: 1, line: 1.3, tracking: 0.08, min: 10 },
  subheading: { label: 'Subheading', size: 2, line: 1.2, tracking: -0.005, min: 18 },
  statement: { label: 'Statement', size: 5, line: 1.06, tracking: -0.005, min: 26 },
  small: { label: 'Small', size: 1.05, line: 1.5, tracking: 0, min: 11 },
};

/** The type scale's defaults (the theme's: --type-<style>-min, -max, -lh in _tokens.scss). */
export const TYPE_SCALE = {
  title: { min: 72, max: 250, line: 0.82 },
  heading: { min: 38, max: 104, line: 0.92 },
  subheading: { min: 22, max: 36, line: 1.15 },
  statement: { min: 30, max: 72, line: 1.06 },
  paragraph: { min: 16, max: 16, line: 1.75 },
  label: { min: 11, max: 11, line: 1.55 },
  small: { min: 12, max: 12, line: 1.5 },
};
/** A style's settings: [key, CSS variable suffix, unit]. */
export const TYPE_KEYS = [
  ['min', 'min', 'px'],
  ['max', 'max', 'px'],
  ['line', 'lh', ''],
];

/** Can a type's text scale to fit (its definition's `scaleToFit`: Scale to fit)? */
export const hasScaleToFit = (type) =>
  (typeof type === 'string' ? WIDGET_TYPES[type] : type)?.scaleToFit === true;

/** Can a type's lines each fill its width (its definition's `fitWidth`: Fit width)? */
export const hasFitWidth = (type) =>
  (typeof type === 'string' ? WIDGET_TYPES[type] : type)?.fitWidth === true;

/** Does a widget's text scale down to fit it (Scale to fit)? */
export const scaledToFit = (widget) => hasScaleToFit(widget?.type) && widget?.scale === true;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** site.json's own type settings, the valid ones only: { style: { min?, max?, line? } }. */
export function typeOf(site) {
  const own = isObject(site?.type) ? site.type : {};
  const out = {};
  for (const k of Object.keys(TYPE_SCALE)) {
    const o = isObject(own[k]) ? own[k] : {};
    const set = Object.fromEntries(
      TYPE_KEYS.filter(([key]) => isNum(o[key]) && o[key] > 0).map(([key]) => [key, o[key]]),
    );
    if (Object.keys(set).length) out[k] = set;
  }
  return out;
}

/** site.json type as CSS variables: [[name, value]] (only those it sets). */
export function typeVarList(site) {
  const out = [];
  for (const [k, s] of Object.entries(typeOf(site)))
    for (const [key, suffix, unit] of TYPE_KEYS)
      if (s[key] !== undefined) out.push([`--type-${k}-${suffix}`, `${s[key]}${unit}`]);
  return out;
}

/** Every type scale variable name (the editor's preview clears the ones no longer set). */
export const TYPE_VARS = Object.keys(TYPE_SCALE).flatMap((k) =>
  TYPE_KEYS.map(([, suffix]) => `--type-${k}-${suffix}`),
);

/** The :root declarations of site.json type ('' when it sets none). */
export const typeVars = (site) =>
  typeVarList(site)
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');

/** Problems of site.json "type" (and the cell-based "typography" it replaced). */
export function checkType(t, typography) {
  const out = [];
  if (typography !== undefined)
    out.push(
      '"typography" is gone: text sizes are "type" { <style>: { min, max, line } } (px, px, × the size)',
    );
  if (t === undefined) return out;
  if (!isObject(t)) return [...out, '"type" must be an object { <style>: { min, max, line } }'];
  const keys = TYPE_KEYS.map(([key]) => key);
  for (const [k, s] of Object.entries(t)) {
    if (!TYPE_SCALE[k]) {
      out.push(`type: unknown style "${k}" (${Object.keys(TYPE_SCALE).join(', ')})`);
      continue;
    }
    if (!isObject(s)) {
      out.push(`type.${k} must be an object { min, max, line }`);
      continue;
    }
    for (const [key, v] of Object.entries(s)) {
      if (!keys.includes(key)) out.push(`type.${k}: unknown key "${key}"`);
      else if (!isNum(v)) out.push(`type.${k}.${key} must be a number`);
      else if (v <= 0) out.push(`type.${k}.${key} must be more than 0`);
    }
    const min = isNum(s.min) ? s.min : TYPE_SCALE[k].min;
    const max = isNum(s.max) ? s.max : TYPE_SCALE[k].max;
    if (min > max) out.push(`type.${k}: min (${min}px) is more than max (${max}px)`);
  }
  return out;
}

/** Problems of a widget's "scale" (and the whole-widget "fit" a line's "fit" replaced). */
export function checkScale(widget) {
  const out = [];
  if (widget?.fit !== undefined)
    out.push(
      '"fit" is a line\'s now (a line\'s "fit": true for Fit width); for Scale to fit on the whole widget write "scale": true',
    );
  if (widget?.scale === undefined) return out;
  if (!hasScaleToFit(widget.type)) {
    const types = Object.values(WIDGET_TYPES).filter(hasScaleToFit);
    out.push(`"scale" is for text widgets (${types.map((t) => t.type).join(', ')})`);
  } else if (widget.scale !== true) out.push('"scale" must be true (or left out: off)');
  return out;
}
