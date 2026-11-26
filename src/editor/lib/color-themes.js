/**
 * Theme › Color's data (ThemePanel.svelte's Color part, ColorPart.svelte): what each palette
 * slot, role and sub-role shows, and the theme.json edit a pick makes. No Svelte, no DOM: the
 * panel calls these with theme.json (live.get(THEME, '')) and stores what they return with
 * live.store.set (one undo step per pick; a typed hex coalesces by its key).
 *
 * theme.json keeps only what differs (src/render/colors.js): a role picked back to the engine's
 * default, a sub-role cleared and a palette back to the engine's are left out, and empty objects
 * go with them (store.remove drops empty parents).
 */
import {
  COLOR_THEME_DEFAULTS,
  DEFAULT_COLOR_THEME,
  PALETTE_SIZE,
  ROLES,
  TEMPLATE_ROLES,
  TEXT_STYLE_NAMES,
  TEXT_STYLE_PARENT,
  THEMES,
  THEME_NAMES,
  buttonModeOf,
  isRoleValue,
  ownPaletteOf,
  paletteOf,
  rolesOf,
  siteColorThemeOf,
  templateRolesOf,
  textStyleRolesOf,
} from '../../render/colors.js';
import { TEXT_STYLES } from '../../render/layout/text-styles.js';
import { LINE_STYLES } from '../../render/text.js';
import { isObject } from '../../render/is.js';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
/** A custom colour as typed: #rgb or #rrggbb (any case). */
export const isHexColor = (v) => typeof v === 'string' && HEX.test(v.trim());
/** #rgb → #rrggbb, lowercase (the native picker and the dots need the long form). */
export const longHex = (v) => {
  const s = String(v).trim().toLowerCase();
  return s.length === 4 ? `#${[...s.slice(1)].map((c) => c + c).join('')}` : s;
};

const label = (name) => THEMES.find(([n]) => n === name)?.[1] || name;
/** A color theme's label (Lightest … Darkest). */
export const themeLabel = label;
const roleOf = (key) => ROLES.find((r) => r.key === key);
/** A text style's label (Title, Paragraph, …: layout/text-styles.js). */
export const textStyleLabel = (textStyle) => TEXT_STYLES[textStyle]?.label || textStyle;

/* ---------- the palette ---------- */

/** The palette without theme.json's (the engine's, color.brand as slot 4 until a site has one). */
export const defaultPaletteOf = (theme) => paletteOf({ ...(theme || {}), palette: undefined });

/** The palette the slots show (5 × #rrggbb). */
export const paletteShown = (theme) => paletteOf(theme);

/** Is slot i (0-based) not the default's? */
export const isCustomSlot = (theme, i) => paletteOf(theme)[i] !== defaultPaletteOf(theme)[i];

/**
 * Slot i set to `hex` (undefined: back to the default's): the value for /palette, the whole
 * array (undefined when it is the default's again); null when `hex` isn't a colour.
 */
export function paletteEdit(theme, i, hex) {
  if (!(i >= 0 && i < PALETTE_SIZE)) return null;
  if (hex !== undefined && !isHexColor(hex)) return null;
  const def = defaultPaletteOf(theme);
  const next = [...(ownPaletteOf(theme) || def)];
  next[i] = hex === undefined ? def[i] : longHex(hex);
  return next.every((c, j) => c === def[j]) ? undefined : next;
}

/* ---------- roles ---------- */

const own = (theme, name) => {
  const t = isObject(theme?.colorThemes) ? theme.colorThemes[name] : undefined;
  return isObject(t) ? t : {};
};
const norm = (v) => (typeof v === 'string' ? (isHexColor(v) ? longHex(v) : v.toLowerCase()) : v);

/**
 * Where a role or sub-role lives in theme.json: { theme, key } a theme's role; with textStyle a
 * text style's sub-role (key unused); with template its template's (key a TEMPLATE_ROLES one,
 * or textStyle).
 */
export function rolePointer({ theme: name, key, textStyle, template }) {
  const at = `/colorThemes/${name}${template ? `/templates/${template}` : ''}`;
  return textStyle ? `${at}/textStyles/${textStyle}` : `${at}/${key}`;
}

/**
 * What a sub-role follows when it is empty: its parent's label ("Text", "the section's
 * Background"; a template's text style: "the template's Text", roleRow says the section's when
 * the template sets no Text).
 */
export function followsOf({ key, textStyle, template }) {
  if (textStyle) {
    const parent = roleOf(TEXT_STYLE_PARENT[textStyle]).label;
    return template ? `the template's ${parent}` : parent;
  }
  if (template) return `the section's ${roleOf(key).label}`;
  return '';
}

/**
 * A role or sub-role's row: { label, own (its value in theme.json, else undefined), shown (what
 * applies: own, else the default or what it follows), custom (a base role not the engine's
 * default; a sub-role set at all), follows ('' for a base role), none, glass, mode (Button) }.
 */
export function roleRow(theme, spec) {
  const { theme: name, key, textStyle, template } = spec;
  const roles = rolesOf(theme, name);
  let ownValue;
  let shown;
  let r;
  let follows = followsOf(spec);
  if (textStyle) {
    r = { label: textStyleLabel(textStyle), none: false, glass: false };
    const parentKey = TEXT_STYLE_PARENT[textStyle];
    if (template) {
      // as colors.js writes it: the template's Text, else the section's text style, else its Text
      const t = templateRolesOf(theme, name, template);
      const section = textStyleRolesOf(own(theme, name))[textStyle];
      ownValue = t.textStyles[textStyle];
      shown = ownValue ?? t.roles[parentKey] ?? section ?? roles[parentKey];
      if (t.roles[parentKey] === undefined)
        follows = `the section's ${section !== undefined ? textStyleLabel(textStyle) : roleOf(parentKey).label}`;
    } else {
      ownValue = textStyleRolesOf(own(theme, name))[textStyle];
      shown = ownValue ?? roles[parentKey];
    }
  } else {
    r = roleOf(key);
    if (template) {
      ownValue = templateRolesOf(theme, name, template).roles[key];
      shown = ownValue ?? roles[key];
    } else {
      const v = own(theme, name)[key];
      ownValue = isRoleValue(v, r.none, r.glass) ? norm(v) : undefined;
      shown = roles[key];
    }
  }
  const sub = !!(textStyle || template);
  const custom = sub
    ? ownValue !== undefined
    : ownValue !== undefined && ownValue !== COLOR_THEME_DEFAULTS[name][key];
  return {
    label: r.label,
    own: ownValue,
    shown,
    custom,
    follows,
    none: !!r.none,
    glass: !!r.glass,
    mode: r.glass ? buttonModeOf(shown) : '',
  };
}

/**
 * A pick: { ptr, value } for live.store.set (value undefined: left out). A base role picked back
 * to the engine's default is left out; a sub-role's undefined (cleared) follows its parent
 * again. null when the value isn't one the role takes.
 */
export function roleEdit(theme, spec, value) {
  const { theme: name, key, textStyle, template } = spec;
  if (!THEME_NAMES.includes(name)) return null;
  const r = textStyle ? { none: false, glass: false } : roleOf(key);
  if (!r || (template && !textStyle && !TEMPLATE_ROLES.includes(key))) return null;
  const ptr = rolePointer(spec);
  if (value === undefined) return { ptr, value: undefined };
  const v = norm(value);
  if (!isRoleValue(v, r.none, r.glass)) return null;
  if (!textStyle && !template && v === COLOR_THEME_DEFAULTS[name][key]) return { ptr, value: undefined };
  return { ptr, value: v };
}

/**
 * The Button row's Glass / Color / None: the value a mode stores. Color keeps the colour already
 * there, else takes the theme's Accent (a colour to start from; the dots change it).
 */
export function buttonModeValue(theme, spec, mode) {
  if (mode === 'glass' || mode === 'none') return mode;
  const now = roleRow(theme, spec).shown;
  if (buttonModeOf(now) === 'color') return now;
  return rolesOf(theme, spec.theme).accent;
}

/** A role value as a colour for a dot or a chip: '#rrggbb', or '' for none / glass. */
export function swatchOf(theme, v) {
  if (Number.isInteger(v)) return paletteOf(theme)[v - 1] || '';
  return isHexColor(v) ? longHex(v) : '';
}

/** A theme's preview chip: { background, text, title (the Title text style), accent } as colours ('' for none). */
export function previewOf(theme, name) {
  const r = rolesOf(theme, name);
  return {
    background: swatchOf(theme, r.background),
    text: swatchOf(theme, r.text),
    title: swatchOf(theme, roleRow(theme, { theme: name, textStyle: 'title' }).shown),
    accent: swatchOf(theme, r.accent),
  };
}

/** How many of a theme's roles and sub-roles theme.json sets (its card's "custom" count). */
export function customCount(theme, name) {
  const set = own(theme, name);
  let n = ROLES.filter((r) => roleRow(theme, { theme: name, key: r.key }).custom).length;
  n += Object.keys(textStyleRolesOf(set)).length;
  for (const t of Object.values(isObject(set.templates) ? set.templates : {}))
    if (isObject(t)) n += Object.keys(t).filter((k) => k !== 'textStyles').length + Object.keys(textStyleRolesOf(t)).length;
  return n;
}

/* ---------- the site color theme ---------- */

/** The site color theme's value for /colorTheme (undefined: the default, left out). */
export const siteThemeEdit = (name) =>
  THEME_NAMES.includes(name) && name !== DEFAULT_COLOR_THEME ? name : undefined;
export { siteColorThemeOf };

/**
 * The text style rows, right after Text in a theme and a template entry: the 7 text styles in the
 * editor's picker order (Title, Heading, Subheading, Statement, Paragraph, Label, Small).
 */
export const TEXT_STYLE_ROWS = Object.freeze(
  LINE_STYLES.map(([textStyle]) => textStyle).filter((textStyle) => TEXT_STYLE_NAMES.includes(textStyle)),
);
