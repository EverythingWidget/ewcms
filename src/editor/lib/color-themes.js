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
  OPACITY_ROLES,
  PALETTE_SIZE,
  ROLES,
  TEMPLATE_OPACITY_ROLES,
  TEMPLATE_ROLES,
  TEXT_STYLE_NAMES,
  TEXT_STYLE_PARENT,
  THEMES,
  THEME_NAMES,
  buttonModeOf,
  contrastResults,
  isOpacity,
  isRoleValue,
  opacityOf,
  ownPaletteOf,
  pagePaletteOf,
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

/* ---------- a page's own palette (the page's Style tab, PageStylePanel.svelte) ---------- */

/**
 * A page's 5 slots as its Style tab shows them: [{ hex, own }], hex its own colour or the site's
 * (theme.json's palette, else the engine's), own whether the page sets it.
 */
export function pagePaletteShown(theme, page) {
  const own = pagePaletteOf(page);
  return paletteOf(theme).map((site, i) => ({ hex: own?.[i] || site, own: !!own?.[i] }));
}

/**
 * Slot i of a page set to `hex` (undefined: the site's again): the value for the page's
 * /palette, 5 × (#rrggbb | null), undefined when every slot is the site's (left out); null when
 * `hex` isn't a colour.
 */
export function pagePaletteEdit(page, i, hex) {
  if (!(i >= 0 && i < PALETTE_SIZE)) return null;
  if (hex !== undefined && !isHexColor(hex)) return null;
  const next = [...(pagePaletteOf(page) || Array(PALETTE_SIZE).fill(null))];
  next[i] = hex === undefined ? null : longHex(hex);
  return next.some(Boolean) ? next : undefined;
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
 * default; a sub-role set at all), follows ('' for a base role), transparent, glass, mode (Button) }.
 */
export function roleRow(theme, spec) {
  const { theme: name, key, textStyle, template } = spec;
  const roles = rolesOf(theme, name);
  let ownValue;
  let shown;
  let r;
  let follows = followsOf(spec);
  if (textStyle) {
    r = { label: textStyleLabel(textStyle), transparent: false, glass: false };
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
      ownValue = isRoleValue(v, r.transparent, r.glass) ? norm(v) : undefined;
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
    transparent: !!r.transparent,
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
  const r = textStyle ? { transparent: false, glass: false } : roleOf(key);
  if (!r || (template && !textStyle && !TEMPLATE_ROLES.includes(key))) return null;
  const ptr = rolePointer(spec);
  if (value === undefined) return { ptr, value: undefined };
  const v = norm(value);
  if (!isRoleValue(v, r.transparent, r.glass)) return null;
  if (!textStyle && !template && v === COLOR_THEME_DEFAULTS[name][key]) return { ptr, value: undefined };
  return { ptr, value: v };
}

/**
 * The Button row's Glass / Color / Transparent: the value a mode stores. Color keeps the colour already
 * there, else takes the theme's Accent (a colour to start from; the dots change it).
 */
export function buttonModeValue(theme, spec, mode) {
  if (mode === 'glass' || mode === 'transparent') return mode;
  const now = roleRow(theme, spec).shown;
  if (buttonModeOf(now) === 'color') return now;
  return rolesOf(theme, spec.theme).accent;
}

/** A role value as a colour for a dot or a chip: '#rrggbb', or '' for transparent / glass. */
export function swatchOf(theme, v) {
  if (Number.isInteger(v)) return paletteOf(theme)[v - 1] || '';
  return isHexColor(v) ? longHex(v) : '';
}

/** A theme's preview chip: { background, text, title (the Title text style), accent } as colours ('' for transparent). */
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
  n += Object.keys(textStyleRolesOf(set)).length + Object.keys(opacityOf(set)).length;
  for (const t of Object.values(isObject(set.templates) ? set.templates : {}))
    if (isObject(t))
      n +=
        Object.keys(t).filter((k) => k !== 'textStyles' && k !== 'opacity').length +
        Object.keys(textStyleRolesOf(t)).length +
        Object.keys(isObject(t.opacity) ? t.opacity : {}).filter((k) => isOpacity(t.opacity[k])).length;
  return n;
}

/* ---------- the site color theme ---------- */

/**
 * A "colorTheme" pick's value to store, for every kind (ColorThemePicker.svelte): the name, or
 * undefined (left out) for an unknown name or the one it falls back to when it picks none.
 */
export const themeEdit = (name, fallback) =>
  THEME_NAMES.includes(name) && name !== fallback ? name : undefined;

/** What a stored "colorTheme" shows: its name, else the one it falls back to. */
export const themeShown = (value, fallback) => (THEME_NAMES.includes(value) ? value : fallback);

/** The site color theme's value for /colorTheme (undefined: the default, left out). */
export const siteThemeEdit = (name) => themeEdit(name, DEFAULT_COLOR_THEME);
export { siteColorThemeOf };

/**
 * The text style rows, right after Text in a theme and a template entry: the 7 text styles in the
 * editor's picker order (Title, Heading, Subheading, Statement, Paragraph, Label, Small).
 */
export const TEXT_STYLE_ROWS = Object.freeze(
  LINE_STYLES.map(([textStyle]) => textStyle).filter((textStyle) => TEXT_STYLE_NAMES.includes(textStyle)),
);

/* ---------- a fill role's opacity ---------- */

/** Where a fill role's opacity lives: /colorThemes/<name>[/templates/<id>]/opacity/<key>. */
export const opacityPointer = ({ theme: name, key, template }) =>
  `/colorThemes/${name}${template ? `/templates/${template}` : ''}/opacity/${key}`;

/** Can this row have an opacity: a fill role (never a text role or a text style). */
export const hasOpacity = ({ key, textStyle, template }) =>
  !textStyle && (template ? TEMPLATE_OPACITY_ROLES : OPACITY_ROLES).includes(key);

/**
 * A fill row's opacity: { own (its percent in theme.json, else undefined), inherited (what it is
 * when empty: 100, a template's the section's), shown, off (no colour to make see-through: a
 * Transparent fill, a Glass or Transparent button) }; null for a row that has none.
 */
export function opacityRow(theme, spec) {
  if (!hasOpacity(spec)) return null;
  const { theme: name, key, template } = spec;
  const section = opacityOf(own(theme, name))[key];
  let ownValue;
  let inherited = 100;
  if (template) {
    const all = own(theme, name).templates;
    const set = isObject(all) && isObject(all[template]) ? all[template] : {};
    const v = isObject(set.opacity) ? set.opacity[key] : undefined;
    ownValue = isOpacity(v) ? v : undefined;
    inherited = section ?? 100;
  } else ownValue = section;
  const shown = roleRow(theme, spec).shown;
  return {
    own: ownValue,
    inherited,
    shown: ownValue ?? inherited,
    off: shown === 'transparent' || shown === 'glass',
  };
}

/**
 * An opacity typed or stepped: { ptr, value } for live.store.set (value undefined: left out); a
 * theme's 100 is left out (solid, the default), a template's 100 kept (over a section's
 * see-through one). null when it isn't a whole percent 0-100 or the row has no opacity.
 */
export function opacityEdit(theme, spec, pct) {
  if (!THEME_NAMES.includes(spec.theme) || !hasOpacity(spec)) return null;
  const ptr = opacityPointer(spec);
  if (pct === undefined) return { ptr, value: undefined };
  if (!isOpacity(pct)) return null;
  return { ptr, value: !spec.template && pct === 100 ? undefined : pct };
}

/**
 * A fill row's reset: its colour and its opacity back to the default (a template's: following the
 * section's) as one edit, { ptr, value } on the theme's (or template entry's) object; empty
 * objects left out.
 */
export function roleResetEdit(theme, spec) {
  const { theme: name, key, template } = spec;
  const ptr = `/colorThemes/${name}${template ? `/templates/${template}` : ''}`;
  const base = own(theme, name);
  const cur = template ? (isObject(base.templates) ? base.templates[template] : undefined) : base;
  const next = isObject(cur) ? structuredClone(cur) : {};
  delete next[key];
  if (isObject(next.opacity)) {
    delete next.opacity[key];
    if (!Object.keys(next.opacity).length) delete next.opacity;
  }
  return { ptr, value: Object.keys(next).length ? next : undefined };
}

/**
 * A row's contrast result, as the check works it out (a see-through fill blended over what is
 * behind it first): { ratio, min, pass, on, seeThrough } for a text role read against a fill and
 * for Line; null for the others (and the text styles). seeThrough: the templates whose items
 * show no Background of their own.
 */
export function contrastRow(theme, spec, seeThrough = []) {
  if (spec.textStyle) return null;
  return contrastIndex(theme, spec.theme, spec.template, seeThrough).get(spec.key) || null;
}

/**
 * A theme's (or one template's in it) contrast results by role key, worked out once: the panel
 * builds one per theme card and one for the template its Templates fold shows, then each row
 * looks its own up (not a check per row).
 */
export function contrastIndex(theme, name, template = null, seeThrough = []) {
  const all = contrastResults(theme, name, { template: template || null, seeThrough });
  return new Map(all.filter((c) => !c.textStyle).map((c) => [c.key, c]));
}

/**
 * A contrast result in words, a hint (never a gate): { ratio "15.4:1", verdict "Pass" / "Fail"
 * (a text role; '' for Line, decorative: its ratio only, never a fail), need }.
 */
export function contrastText(c) {
  if (!c) return null;
  const on = roleOf(c.on).label;
  const blended = c.seeThrough ? ' (blended)' : '';
  if (c.ratio === null)
    return {
      ratio: '',
      verdict: 'Not checked',
      need: c.key === 'line' && !c.fg ? 'no line' : "what's behind the page isn't known",
    };
  const ratio = `${(Math.floor(c.ratio * 10) / 10).toFixed(1)}:1`;
  if (c.hint) return { ratio, verdict: '', need: `on ${on}${blended} · a hint: 3:1 shows well` };
  return { ratio, verdict: c.pass ? 'Pass' : 'Fail', need: `${c.min}:1 on ${on}${blended}` };
}
