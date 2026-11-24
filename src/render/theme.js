/**
 * The theme's values: content/theme.json (the Theme area: Color, Typography, Layout). Every
 * key is optional; left out, the theme's tokens.scss defaults apply (and the engine's for
 * layout). They become CSS variables on the page's :root (shell/layout.js head, :root:root so
 * they beat the theme's stylesheet), and the editor's preview sets the same ones as they are
 * typed (src/editor/theme-vars.js).
 *
 *   {
 *     "version": 1,
 *     "color": { "brand": "#cc2020", "themeColor": "#050505", "scheme": "dark" },
 *     "typography": {
 *       "fonts": { "display": "Momo Trust Display", "body": "DM Mono" },
 *       "heading": { "min": 38, "max": 104, "line": 0.92, "font": "DM Mono" }
 *     },
 *     "layout": { "containedCols": 96, "sectionSpace": 0, "sectionSpacePhone": 0 }
 *   }
 *
 *   color.brand       --brand: links, the menu, the glass, focus rings (#rrggbb)
 *   color.themeColor  the browser's <meta name="theme-color"> (#rrggbb; left out: none)
 *   color.scheme      the browser's <meta name="color-scheme"> (dark, light, …; left out: none)
 *   typography        the text styles' sizes and fonts (layout/type.js): --type-<style>-min,
 *                     -max, -lh, -font, and typography.fonts display / body (--f-display, --f-body)
 *   layout            contained width and space between sections (layout/contain.js, space.js)
 */
import { isObject } from './is.js';
import { TYPE_VARS, checkType, typeVarList } from './layout/type.js';
import { LAYOUT_VARS, checkLayout, layoutVarList } from './layout/contain.js';

/** A colour in theme.json: #rrggbb only. */
export const isThemeColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** color.scheme values the color-scheme meta accepts. */
export const SCHEMES = Object.freeze([
  'normal',
  'light',
  'dark',
  'light dark',
  'dark light',
  'only light',
  'only dark',
]);

/** A color-scheme in theme.json: one of SCHEMES, any case or spacing. */
export const schemeValue = (v) =>
  typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ') : '';

export const isScheme = (v) => SCHEMES.includes(schemeValue(v));

/** The keys of theme.json "color": [key, what it is]. */
export const COLOR_KEYS = [
  ['brand', 'the brand color (--brand)'],
  ['themeColor', "the browser's theme-color meta"],
  ['scheme', "the browser's color-scheme meta"],
];

const colorOf = (theme, key) => {
  const v = isObject(theme?.color) ? theme.color[key] : undefined;
  return isThemeColor(v) ? v.toLowerCase() : '';
};

/** The brand colour theme.json sets, or '' (the theme's --brand). */
export const brandOf = (theme) => colorOf(theme, 'brand');

/** The theme-color meta theme.json sets, or '' (none). */
export const themeColorOf = (theme) => colorOf(theme, 'themeColor');

/** The color-scheme meta theme.json sets, or '' (none). */
export const schemeOf = (theme) => {
  const v = isObject(theme?.color) ? theme.color.scheme : undefined;
  return isScheme(v) ? schemeValue(v) : '';
};

/** theme.json as :root CSS variables: [[name, value]], only what it sets. */
export function themeVarList(theme, fonts) {
  const brand = brandOf(theme);
  return [
    ...(brand ? [['--brand', brand]] : []),
    ...typeVarList(theme, fonts),
    ...layoutVarList(theme),
  ];
}

/** The :root declarations of theme.json ('' when it sets none). */
export const themeVars = (theme, fonts) =>
  themeVarList(theme, fonts)
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');

/** Every variable theme.json can set (the editor's preview clears the ones no longer set). */
export const THEME_VARS = ['--brand', ...TYPE_VARS, ...LAYOUT_VARS];

const THEME_KEYS = ['color', 'typography', 'layout'];

const COLOR_SHAPE = COLOR_KEYS.map(([key]) => key).join(', ');

/** Problems of theme.json (without "version"). */
export function checkTheme(d) {
  const out = [];
  for (const k of Object.keys(d)) {
    if (THEME_KEYS.includes(k)) continue;
    out.push(
      k === 'type'
        ? '"type" is "typography" now (the text styles\' sizes)'
        : `"${k}" is not a theme setting (${THEME_KEYS.join(', ')})`,
    );
  }
  if (d.color !== undefined) {
    if (!isObject(d.color)) out.push(`"color" must be an object { ${COLOR_SHAPE} }`);
    else
      for (const [k, v] of Object.entries(d.color)) {
        if (!COLOR_KEYS.some(([key]) => key === k))
          out.push(`"color.${k}" is not a color setting (${COLOR_SHAPE})`);
        else if (k === 'scheme') {
          if (!isScheme(v))
            out.push(
              `"color.scheme" must be ${SCHEMES.map((s) => JSON.stringify(s)).join(', ')}, not ${JSON.stringify(v)}`,
            );
        } else if (!isThemeColor(v))
          out.push(`"color.${k}" must be a hex color #rrggbb, not ${JSON.stringify(v)}`);
      }
  }
  return [...out, ...checkType(d.typography), ...checkLayout(d.layout)];
}
