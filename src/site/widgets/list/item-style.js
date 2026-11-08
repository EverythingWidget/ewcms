/**
 * Item style (step 9): an item template's "style" (content/templates/t-….json), how each
 * item looks, over the theme's --item-* tokens (theme-default/styles/_tokens.scss). Every
 * key is optional: left out, the theme's value shows ("Theme" in the editor, never saved).
 * Sizes are px on the 4px grid. The presets are style values too (PRESET_STYLES): a List on
 * a preset shows that preset's style, Duplicate writes it into the new template.
 *
 *   photoRatio       "1/1" | "4/5" | "4/3" | "3/2" | "16/9" | "auto"   the photo's shape
 *   photoFit         "fill" | "fit"            fill the shape (cropped) or fit in it
 *   radius           0 | 4 | 8 | 12 | 16 | 24  the item's and its photo's corners
 *   border           "none" | "line" | "strong" | "bottom"   an inset ring (no layout shift);
 *                    bottom: a divider line under the item (square corners, 16px more above
 *                    and below)
 *   shadow           "none" | "s" | "m" | "l"
 *   padding          0 | 8 | 12 | 16 | 24 | 32
 *   spacing          0 | 4 | 8 | 12 | 16 | 24  between the item's widgets
 *   background       "none" | "surface" | "surface-2"
 *   hoverBackground  "none" | "surface" | "surface-2"
 *   textOverPhoto    "none" | "bottom"         the text over the photo's foot, a shade under it
 *   hoverEffect      "none" | "accent" | "zoom" | "shift" | "lift"   on hover: the title in the
 *                    accent (a linked item), plus zoom the photo, slide the title or lift the item
 *   align            "start" | "center" | "end"   the text
 */
import { isObject } from '../../is.js';

const PX = (...n) => n;
export const STYLE_KEYS = {
  photoRatio: ['1/1', '4/5', '4/3', '3/2', '16/9', 'auto'],
  photoFit: ['fill', 'fit'],
  radius: PX(0, 4, 8, 12, 16, 24),
  border: ['none', 'line', 'strong', 'bottom'],
  shadow: ['none', 's', 'm', 'l'],
  padding: PX(0, 8, 12, 16, 24, 32),
  spacing: PX(0, 4, 8, 12, 16, 24),
  background: ['none', 'surface', 'surface-2'],
  hoverBackground: ['none', 'surface', 'surface-2'],
  textOverPhoto: ['none', 'bottom'],
  hoverEffect: ['none', 'accent', 'zoom', 'shift', 'lift'],
  align: ['start', 'center', 'end'],
};

/** The presets as style values (their look, the same pixels as before step 9). */
export const PRESET_STYLES = {
  'preset:card': { photoRatio: '4/5', hoverEffect: 'accent' },
  'preset:plain': {
    photoRatio: '4/3',
    padding: 0,
    border: 'none',
    shadow: 'none',
    background: 'none',
    hoverEffect: 'accent',
  },
  'preset:panel': { photoRatio: '4/5', padding: 0, textOverPhoto: 'bottom', hoverEffect: 'zoom' },
  'preset:row': { photoRatio: '4/3', border: 'bottom', hoverEffect: 'shift' },
};
export const presetStyle = (id) => ({ ...(PRESET_STYLES[id] || PRESET_STYLES['preset:card']) });

/** Problems with a template's "style" ([] when fine). */
export function styleProblems(style) {
  if (style === undefined) return [];
  if (!isObject(style)) return ['"style" must be an object of item style keys'];
  const out = [];
  for (const [k, v] of Object.entries(style)) {
    const allowed = STYLE_KEYS[k];
    if (!allowed)
      out.push(`style.${k} is not an item style key (${Object.keys(STYLE_KEYS).join(', ')})`);
    else if (!allowed.includes(v))
      out.push(
        `style.${k} must be one of ${allowed.map((a) => JSON.stringify(a)).join(', ')} (left out: the theme's)`,
      );
  }
  return out;
}

/** Only the valid keys (a broken one shows the theme's). */
export const cleanStyle = (style) =>
  isObject(style)
    ? Object.fromEntries(Object.entries(style).filter(([k, v]) => STYLE_KEYS[k]?.includes(v)))
    : {};

const FILL = { none: 'transparent', surface: 'var(--bg-2)', 'surface-2': 'var(--solid-card)' };
const RING = {
  none: 'inset 0 0 0 0 transparent',
  line: 'inset 0 0 0 1px var(--line)',
  strong: 'inset 0 0 0 1px var(--muted)',
  bottom: 'inset 0 -1px 0 var(--line)',
};
const SHADOW = {
  none: '0 0 0 0 transparent',
  s: 'var(--item-shadow-s)',
  m: 'var(--item-shadow-m)',
  l: 'var(--item-shadow-l)',
};

/**
 * One item's style as markup: { cls: its modifier classes, vars: its inline --item-*
 * overrides ("" when none) }. A look (presets.js PRESET_LOOKS: the title's size, the photo
 * beside the text) comes with it.
 */
export function styleMarkup(style, look = {}) {
  const s = cleanStyle(style);
  const v = [];
  const put = (name, value) => value !== undefined && v.push(`${name}:${value}`);
  put('--item-photo-ratio', s.photoRatio && s.photoRatio.replace('/', ' / '));
  put('--item-photo-fit', s.photoFit && (s.photoFit === 'fit' ? 'contain' : 'cover'));
  put('--item-radius', s.radius !== undefined ? `${s.radius}px` : undefined);
  put('--item-border', s.border && RING[s.border]);
  put('--item-shadow', s.shadow && SHADOW[s.shadow]);
  put('--item-pad', s.padding !== undefined ? `${s.padding}px` : undefined);
  put('--item-gap', s.spacing !== undefined ? `${s.spacing}px` : undefined);
  put('--item-bg', s.background && FILL[s.background]);
  put('--item-bg-hover', s.hoverBackground && FILL[s.hoverBackground]);
  put('--li-title-size', look.titleSize);
  const cls = [
    s.border === 'bottom' && 'li--border-bottom',
    s.textOverPhoto === 'bottom' && 'li--over-bottom',
    s.hoverEffect && `li--hover-${s.hoverEffect}`,
    s.align && s.align !== 'start' && `li--align-${s.align}`,
    look.beside && 'li--beside',
    look.prose && 'li--prose',
  ].filter(Boolean);
  return { cls, vars: v.join(';') };
}
