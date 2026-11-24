/**
 * A Text widget's sizes and fonts. By default each line has its style's size (the site's
 * stylesheets, src/client/styles/_text.scss). Two things change the size, both worked out live
 * in the page (src/client/modules/fit.js):
 *
 *   a line's "fit": true    Full-width line (src/render/text.js): that line alone fills the widget's
 *                           WIDTH, on one line (its own --tkf); the other lines keep theirs
 *   the widget's "scale"    Shrink to fit (the popup's switch, off by default): the whole text
 *                           at its styles' normal sizes, scaled down as one,
 *                           until it fits the widget's width and (a fixed height) its height
 *                           (the widget's --tks, never above 1); a fit line still fills the width
 *
 * Each style's usual size is the site's type scale (content/theme.json "typography"; TYPE_SCALE
 * are the defaults, the same as the theme's in src/client/styles/_tokens.scss):
 *
 *   "typography": {
 *     "fonts": { "display": "Momo Trust Display", "body": "DM Mono" },
 *     "heading": { "min": 38, "max": 104, "line": 0.92, "font": "DM Mono" }
 *   }
 *
 *   min, max  the font size, px: it grows with the window between the two (equal: fixed)
 *   line      line height, × the font size
 *   font      a family name the theme provides (theme/meta.json "fonts"); writes --type-<style>-font
 *   fonts     typography.fonts { display?, body? }: the global families (--f-display, --f-body).
 *             This is a reserved typography key, not a text style: see TYPE_RESERVED (the one
 *             table checkType uses).
 *
 * Each left out is the theme's. They become CSS variables on the page's :root
 * (--type-<style>-min, -max, -lh, -font, and --f-display / --f-body; typeVars), so they change
 * the site, never the editor. A font name the theme does not list is kept but not emitted.
 *
 * Full-width line starts from TEXT_STYLES' size in cells (--ts-<style>, _tokens.scss), only a
 * starting point: the line's own factor (--tkf) scales it to the widget's width.
 * A fit line's size is in cells × its own factor (_layout.scss .ts[data-fit]).
 */
import { isObject } from '../is.js';
import { WIDGET_TYPES } from '../../widgets/index.js';

/** The text styles and a full-width line's starting sizes (in cells; at 1440px a cell is ~11.3px). */
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

/**
 * typography keys that are not a text style. checkType uses this table; add a reserved
 * name here only (not as a scattered special case). The value is the object's allowed keys.
 *
 *   fonts  typography.fonts { display?, body? }: the global font family names
 */
export const TYPE_RESERVED = {
  fonts: ['display', 'body'],
};

/** The global font a style follows when typography.<style>.font is unset. */
export const TYPE_FONT_OF = {
  title: 'display',
  heading: 'display',
  subheading: 'display',
  statement: 'display',
  paragraph: 'body',
  label: 'body',
  small: 'body',
};

const quoteFamily = (name) => `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * The theme's provided fonts (theme/meta.json "fonts"): [{ family, fallback, stack }].
 * Invalid entries are left out. `stack` is the CSS font-family value (quoted family + fallback).
 */
export function fontsOf(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!isObject(item) || typeof item.family !== 'string') continue;
    const family = item.family.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
    if (!family || seen.has(family)) continue;
    seen.add(family);
    const fallback =
      typeof item.fallback === 'string' && item.fallback.trim()
        ? item.fallback.trim()
        : 'sans-serif';
    out.push({ family, fallback, stack: `${quoteFamily(family)}, ${fallback}` });
  }
  return out;
}

/** Warnings when typography names a font the theme's list does not provide. */
export function typeFontWarnings(typography, fonts) {
  const names = fontsOf(fonts).map((f) => f.family);
  const listed = names.join(', ') || 'none';
  const known = new Set(names);
  const typo = isObject(typography) ? typography : {};
  const out = [];
  const global = isObject(typo.fonts) ? typo.fonts : {};
  for (const role of TYPE_RESERVED.fonts) {
    const v = global[role];
    if (typeof v === 'string' && v.trim() && !known.has(v))
      out.push(
        `"typography.fonts.${role}" "${v}" is not a font this theme provides (${listed})`,
      );
  }
  for (const k of Object.keys(TYPE_SCALE)) {
    const v = isObject(typo[k]) ? typo[k].font : undefined;
    if (typeof v === 'string' && v.trim() && !known.has(v))
      out.push(`"typography.${k}.font" "${v}" is not a font this theme provides (${listed})`);
  }
  return out;
}

/** Can a type's text scale to fit (its definition's `scaleToFit`: Shrink to fit)? */
export const hasScaleToFit = (type) =>
  (typeof type === 'string' ? WIDGET_TYPES[type] : type)?.scaleToFit === true;

/** Can a type's lines each fill its width (its definition's `fitWidth`: Full-width line)? */
export const hasFitWidth = (type) =>
  (typeof type === 'string' ? WIDGET_TYPES[type] : type)?.fitWidth === true;

/** Does a widget's text scale down to fit it (Shrink to fit)? */
export const scaledToFit = (widget) => hasScaleToFit(widget?.type) && widget?.scale === true;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** theme.json's own typography, the valid ones only: { style: { min?, max?, line? } }. */
export function typeOf(theme) {
  const own = isObject(theme?.typography) ? theme.typography : {};
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

/** theme.json typography as CSS variables: [[name, value]] (only those it sets). */
export function typeVarList(theme, fonts) {
  const out = [];
  for (const [k, s] of Object.entries(typeOf(theme)))
    for (const [key, suffix, unit] of TYPE_KEYS)
      if (s[key] !== undefined) out.push([`--type-${k}-${suffix}`, `${s[key]}${unit}`]);
  // fonts: only a name the theme lists (fonts: theme/meta.json "fonts"); unknown names are kept
  // in theme.json but not emitted, so the theme's stack shows
  const known = new Map(fontsOf(fonts).map((f) => [f.family, f.stack]));
  const typo = isObject(theme?.typography) ? theme.typography : {};
  const global = isObject(typo.fonts) ? typo.fonts : {};
  for (const role of TYPE_RESERVED.fonts) {
    const stack = known.get(typeof global[role] === 'string' ? global[role] : '');
    if (stack) out.push([`--f-${role}`, stack]);
  }
  for (const k of Object.keys(TYPE_SCALE)) {
    const name = isObject(typo[k]) ? typo[k].font : undefined;
    const stack = known.get(typeof name === 'string' ? name : '');
    if (stack) out.push([`--type-${k}-font`, stack]);
  }
  return out;
}

/** Every typography variable name (the editor's preview clears the ones no longer set). */
export const TYPE_VARS = [
  ...TYPE_RESERVED.fonts.map((role) => `--f-${role}`),
  ...Object.keys(TYPE_SCALE).flatMap((k) => [
    ...TYPE_KEYS.map(([, suffix]) => `--type-${k}-${suffix}`),
    `--type-${k}-font`,
  ]),
];

/** The :root declarations of theme.json typography ('' when it sets none). */
export const typeVars = (theme, fonts) =>
  typeVarList(theme, fonts)
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');

/** Problems of theme.json "typography" (the text styles' sizes and fonts). */
export function checkType(t) {
  const out = [];
  if (t === undefined) return out;
  if (!isObject(t))
    return ['"typography" must be an object { fonts?, <style>: { min, max, line, font } }'];
  const keys = TYPE_KEYS.map(([key]) => key);
  for (const [k, s] of Object.entries(t)) {
    const reserved = TYPE_RESERVED[k];
    if (reserved) {
      if (!isObject(s)) {
        out.push(`typography.${k} must be an object { ${reserved.join(', ')} }`);
        continue;
      }
      for (const [key, v] of Object.entries(s)) {
        if (!reserved.includes(key)) out.push(`typography.${k}: unknown key "${key}"`);
        else if (typeof v !== 'string' || !v.trim())
          out.push(`typography.${k}.${key} must be a string`);
      }
      continue;
    }
    if (!TYPE_SCALE[k]) {
      out.push(`typography: unknown style "${k}" (${Object.keys(TYPE_SCALE).join(', ')})`);
      continue;
    }
    if (!isObject(s)) {
      out.push(`typography.${k} must be an object { min, max, line, font }`);
      continue;
    }
    for (const [key, v] of Object.entries(s)) {
      if (key === 'font') {
        if (typeof v !== 'string' || !v.trim())
          out.push(`typography.${k}.font must be a string`);
        continue;
      }
      if (!keys.includes(key)) out.push(`typography.${k}: unknown key "${key}"`);
      else if (!isNum(v)) out.push(`typography.${k}.${key} must be a number`);
      else if (v <= 0) out.push(`typography.${k}.${key} must be more than 0`);
    }
    const min = isNum(s.min) ? s.min : TYPE_SCALE[k].min;
    const max = isNum(s.max) ? s.max : TYPE_SCALE[k].max;
    if (min > max) out.push(`typography.${k}: min (${min}px) is more than max (${max}px)`);
  }
  return out;
}

/** Problems of a widget's "scale" (and the whole-widget "fit" a line's "fit" replaced). */
export function checkScale(widget) {
  const out = [];
  if (widget?.fit !== undefined)
    out.push(
      '"fit" is a line\'s now (a line\'s "fit": true for Full-width line); for Shrink to fit on the whole widget write "scale": true',
    );
  if (widget?.scale === undefined) return out;
  if (!hasScaleToFit(widget.type)) {
    const types = Object.values(WIDGET_TYPES).filter(hasScaleToFit);
    out.push(`"scale" is for text widgets (${types.map((t) => t.type).join(', ')})`);
  } else if (widget.scale !== true) out.push('"scale" must be true (or left out: off)');
  return out;
}
