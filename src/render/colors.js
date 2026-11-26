/**
 * The site's colours: one palette of 5 colours and 5 color themes that give them jobs (roles).
 * content/theme.json:
 *
 *   {
 *     "palette": ["#050505", "#101010", "#212121", "#cfc8b8", "#f2efe9"],
 *     "colorThemes": {
 *       "dark": {
 *         "background": 2, "text": 5, "link": "#c9a27a", "button": "none",
 *         "typography": { "label": 4 },
 *         "templates": { "preset:card": { "background": 3 }, "t-pmor": { "text": 4 } }
 *       }
 *     },
 *     "colorTheme": "darkest"
 *   }
 *
 *   palette       5 × #rrggbb; slot 1 is the calm, background end (--palette-1 … --palette-5)
 *   colorThemes   per theme (THEME_NAMES), only what differs from COLOR_THEME_DEFAULTS. A role's
 *                 value: a palette slot 1-5, a custom colour (#rgb or #rrggbb: it doesn't follow
 *                 the palette) or "none" (fill roles only: no fill, transparent)
 *     typography  sub-roles: one text style's colour (TYPE_PARENT: left out, it follows Heading or Text)
 *     templates   sub-roles of an item template (its id, as a List's config.template: "preset:card",
 *                 "t-…"): TEMPLATE_ROLES and typography; left out, it follows its parent (a site
 *                 template's basedOn, then the section)
 *   colorTheme    the site color theme: the page, the chrome and every section that picks none
 *
 * Sections (page and footer) and header.json pick a theme with "colorTheme" (class ct-<name>).
 * Everything else (hover, pressed, faded, focus, …) is a smart colour (SMART), worked out from the
 * roles in CSS, never picked. All of it is one static <style id="color-themes"> in the head
 * (shell/layout.js); theme.json's palette is on :root:root (theme.js themeVarList), so a palette
 * edit swaps 5 values and everything follows.
 */
import { isObject } from './is.js';

export const PALETTE_SIZE = 5;

/** The engine's palette (today's default-site look), when theme.json sets none. */
export const DEFAULT_PALETTE = Object.freeze(['#050505', '#101010', '#212121', '#cfc8b8', '#f2efe9']);

/** The color themes, lightest first: [name, label]. */
export const THEMES = Object.freeze([
  ['lightest', 'Lightest'],
  ['light', 'Light'],
  ['accent', 'Accent'],
  ['dark', 'Dark'],
  ['darkest', 'Darkest'],
]);
export const THEME_NAMES = Object.freeze(THEMES.map(([name]) => name));

/** The site color theme when theme.json picks none. */
export const DEFAULT_COLOR_THEME = 'darkest';

/** camelCase → kebab-case (buttonText → button-text). */
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * The roles, the one table every name comes from. key: JSON; css: its variable; none: may be
 * "none" (no fill); template: a template may set it (TEMPLATE_ROLES); on: the role whose colour
 * it is read against (the contrast check), min: the contrast it needs (WCAG).
 */
export const ROLES = Object.freeze(
  [
    { key: 'background', label: 'Background', kind: 'fill', none: true, template: true },
    { key: 'text', label: 'Text', kind: 'text', template: true, on: 'background', min: 4.5 },
    { key: 'heading', label: 'Heading', kind: 'text', template: true, on: 'background', min: 3 },
    { key: 'link', label: 'Link', kind: 'text', template: true, on: 'background', min: 4.5 },
    { key: 'accent', label: 'Accent', kind: 'text' },
    { key: 'button', label: 'Button', kind: 'fill', none: true, template: true },
    { key: 'buttonText', label: 'Button text', kind: 'text', template: true, on: 'button', min: 4.5 },
    { key: 'line', label: 'Line', kind: 'fill', none: true, template: true },
    { key: 'header', label: 'Header', kind: 'fill', none: true },
    { key: 'headerText', label: 'Header text', kind: 'text', on: 'header', min: 4.5 },
    { key: 'curtain', label: 'Curtain', kind: 'fill' },
    { key: 'curtainText', label: 'Curtain text', kind: 'text', on: 'curtain', min: 4.5 },
  ].map((r) => ({ none: false, template: false, ...r, css: `--color-${kebab(r.key)}` })),
);
export const ROLE_KEYS = Object.freeze(ROLES.map((r) => r.key));
const roleOf = (key) => ROLES.find((r) => r.key === key);

/** The roles a template may set (besides its typography). */
export const TEMPLATE_ROLES = Object.freeze(ROLES.filter((r) => r.template).map((r) => r.key));

/** Each text style's parent role: a sub-role left out follows it. */
export const TYPE_PARENT = Object.freeze({
  title: 'heading',
  heading: 'heading',
  subheading: 'heading',
  statement: 'heading',
  paragraph: 'text',
  label: 'text',
  small: 'text',
});
export const TYPE_STYLES = Object.freeze(Object.keys(TYPE_PARENT));

/** A text style's sub-role variable (--color-type-<style>; the role Heading is --color-heading). */
export const typeVar = (style) => `--color-type-${style}`;

/** The engine's color themes: each role's palette slot (a theme.json theme overrides any). */
export const COLOR_THEME_DEFAULTS = Object.freeze({
  lightest: { background: 5, text: 1, heading: 1, link: 3, accent: 3, button: 1, buttonText: 5, line: 4, header: 5, headerText: 1, curtain: 4, curtainText: 1 },
  light: { background: 4, text: 1, heading: 1, link: 2, accent: 2, button: 1, buttonText: 4, line: 5, header: 4, headerText: 1, curtain: 5, curtainText: 1 },
  accent: { background: 3, text: 5, heading: 5, link: 4, accent: 4, button: 4, buttonText: 1, line: 2, header: 3, headerText: 5, curtain: 1, curtainText: 5 },
  dark: { background: 2, text: 5, heading: 5, link: 4, accent: 4, button: 4, buttonText: 1, line: 3, header: 1, headerText: 5, curtain: 1, curtainText: 5 },
  darkest: { background: 1, text: 5, heading: 5, link: 5, accent: 4, button: 4, buttonText: 1, line: 3, header: 2, headerText: 5, curtain: 2, curtainText: 5 },
});

/**
 * Smart colours: worked out from the roles, never picked: [name, CSS (with --color-* of the
 * same element), the rule in words, CSS when the fill it depends on is "none"].
 */
const mix = (a, pa, b) => `color-mix(in oklab, var(${a}) ${pa}%, ${b})`;
export const SMART = Object.freeze([
  {
    name: 'button-hover',
    css: `color-mix(in oklab, var(--color-button), var(--color-button-text) 12%)`,
    rule: 'Button, mixed 12% toward Button text',
    whenNone: 'button',
    none: mix('--color-text', 10, 'var(--color-background)'),
  },
  {
    name: 'button-pressed',
    css: `color-mix(in oklab, var(--color-button), var(--color-background) 18%)`,
    rule: 'Button, mixed 18% toward Background',
    whenNone: 'button',
    none: mix('--color-text', 18, 'var(--color-background)'),
  },
  { name: 'link-hover', css: mix('--color-link', 65, 'var(--color-background)'), rule: 'Link at 65% over Background' },
  { name: 'faded', css: mix('--color-text', 60, 'var(--color-background)'), rule: 'Text at 60% over Background' },
  { name: 'focus', css: 'var(--color-accent)', rule: 'Accent, as a ring outside the element' },
  { name: 'disabled', css: mix('--color-text', 35, 'var(--color-background)'), rule: 'Text at 35% over Background' },
  {
    name: 'line-hover',
    css: `color-mix(in oklab, var(--color-line), var(--color-text) 35%)`,
    rule: 'Line, mixed 35% toward Text',
    whenNone: 'line',
    none: 'transparent',
  },
  { name: 'selection', css: mix('--color-accent', 35, 'var(--color-background)'), rule: 'Accent at 35% over Background' },
  {
    name: 'header-glass',
    css: mix('--color-header', 93, 'transparent'),
    rule: 'Header, a little see-through over the page',
  },
  { name: 'field', css: `color-mix(in oklab, var(--color-background), var(--color-text) 6%)`, rule: 'Background, mixed 6% toward Text' },
].map((s) => ({ ...s, var: `--smart-${s.name}` })));

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const isSlot = (v) => Number.isInteger(v) && v >= 1 && v <= PALETTE_SIZE;
const isHex = (v) => typeof v === 'string' && HEX.test(v);

/** A palette colour: #rrggbb. */
export const isPaletteColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** A role's value is valid: a slot, a custom hex, or "none" where the role allows it. */
export const isRoleValue = (v, none = false) => isSlot(v) || isHex(v) || (none && v === 'none');

/** theme.json's palette (5 × #rrggbb), or null when it sets none or it isn't valid. */
export function ownPaletteOf(theme) {
  const p = theme?.palette;
  return Array.isArray(p) && p.length === PALETTE_SIZE && p.every(isPaletteColor)
    ? p.map((c) => c.toLowerCase())
    : null;
}

/**
 * The palette a site shows: theme.json's, else the engine's. Until a site has a palette, its
 * color.brand (Theme › Color's Brand color) stands in for slot 4, the default accent.
 */
export function paletteOf(theme) {
  const own = ownPaletteOf(theme);
  if (own) return own;
  const brand = isObject(theme?.color) ? theme.color.brand : undefined;
  const out = [...DEFAULT_PALETTE];
  if (isPaletteColor(brand)) out[3] = brand.toLowerCase();
  return out;
}

/** theme.json's palette as :root variables ([[name, value]]: only what differs from the engine's). */
export function paletteVarList(theme) {
  const p = paletteOf(theme);
  return p
    .map((c, i) => [`--palette-${i + 1}`, c])
    .filter(([, c], i) => c !== DEFAULT_PALETTE[i]);
}
export const PALETTE_VARS = Array.from({ length: PALETTE_SIZE }, (_, i) => `--palette-${i + 1}`);

/** The site color theme's name (theme.json colorTheme, else DEFAULT_COLOR_THEME). */
export const siteColorThemeOf = (theme) =>
  THEME_NAMES.includes(theme?.colorTheme) ? theme.colorTheme : DEFAULT_COLOR_THEME;

/** A color theme's class (ct-<name>), '' for an unknown name or none. */
export const colorThemeClass = (name) => (THEME_NAMES.includes(name) ? `ct-${name}` : '');

/** An item template's class: tpl-<id>, ":" and anything else not a class character as "-". */
export const templateClass = (id) => `tpl-${String(id).replace(/[^\w-]/g, '-')}`;

const own = (theme, name) => {
  const t = isObject(theme?.colorThemes) ? theme.colorThemes[name] : undefined;
  return isObject(t) ? t : {};
};

/** A theme's 12 roles: its theme.json values over the engine's ({ key: slot | hex | "none" }). */
export function rolesOf(theme, name) {
  const set = own(theme, name);
  const out = {};
  for (const r of ROLES) {
    const v = set[r.key];
    out[r.key] = isRoleValue(v, r.none) ? normal(v) : COLOR_THEME_DEFAULTS[name][r.key];
  }
  return out;
}

const normal = (v) => (typeof v === 'string' ? v.toLowerCase() : v);

/** A theme's text-style sub-roles that are set: { style: value }. */
export function typeRolesOf(set) {
  const t = isObject(set?.typography) ? set.typography : {};
  const out = {};
  for (const s of TYPE_STYLES) if (isRoleValue(t[s])) out[s] = normal(t[s]);
  return out;
}

/**
 * A template's sub-roles in a theme, resolved: its own over its parent's (a site template's
 * basedOn, another site template or a preset), only what is set: { roles, typography }.
 * templates: the site's (content/templates, by id).
 */
export function templateRolesOf(theme, name, id, templates = {}, seen = new Set()) {
  const all = own(theme, name).templates;
  const set = isObject(all) && isObject(all[id]) ? all[id] : {};
  const parent = templates?.[id]?.basedOn;
  const base =
    typeof parent === 'string' && parent !== id && !seen.has(parent)
      ? templateRolesOf(theme, name, parent, templates, seen.add(id))
      : { roles: {}, typography: {} };
  const roles = { ...base.roles };
  for (const k of TEMPLATE_ROLES) if (isRoleValue(set[k], roleOf(k).none)) roles[k] = normal(set[k]);
  return { roles, typography: { ...base.typography, ...typeRolesOf(set) } };
}

/** A role value as CSS: a slot's var, a custom colour, or transparent. */
export const valueCss = (v) =>
  v === 'none' ? 'transparent' : isSlot(v) ? `var(--palette-${v})` : String(v);

/** The template ids any theme sets sub-roles for, with their site templates' children. */
function templateIds(theme, templates) {
  const ids = new Set();
  for (const name of THEME_NAMES) {
    const t = own(theme, name).templates;
    if (isObject(t)) for (const id of Object.keys(t)) ids.add(id);
  }
  // a site template follows its parent's sub-roles: it needs its own rules too
  let grew = true;
  while (grew) {
    grew = false;
    for (const [id, tpl] of Object.entries(templates || {}))
      if (!ids.has(id) && ids.has(tpl?.basedOn)) {
        ids.add(id);
        grew = true;
      }
  }
  return [...ids];
}

const decls = (list) => list.map(([k, v]) => `${k}: ${v}`).join('; ');

/** The smart colours that change when a fill is "none": [[var, css]]. */
const noneSmart = (roles) =>
  SMART.filter((s) => s.whenNone && roles[s.whenNone] === 'none').map((s) => [s.var, s.none]);

/**
 * Old token names (a site's own CSS, tokens.scss) as aliases of the roles and smart colours,
 * set wherever a color theme is: a site's tokens.scss value still wins on :root. [[name, css]]
 */
const faded = (n) => `color-mix(in oklab, var(--color-text) ${n}%, var(--color-background))`;
const toward = (n) => `color-mix(in oklab, var(--color-background), var(--color-text) ${n}%)`;
export const TOKEN_ALIASES = Object.freeze([
  ['--bg', 'var(--color-background)'],
  ['--bg-2', 'var(--color-curtain)'],
  ['--fg', 'var(--color-text)'],
  ['--muted', 'var(--smart-faded)'],
  ['--faint', 'var(--smart-disabled)'],
  ['--solid-faint', 'var(--smart-faded)'],
  ['--soft', faded(78)],
  ['--line', 'var(--color-line)'],
  ['--brand', 'var(--color-accent)'],
  ['--on-fg', 'var(--color-background)'],
  ['--solid-card', toward(12)],
  ['--solid-card-peek', toward(18)],
  ['--header-fill', 'var(--smart-header-glass)'],
  ['--hover-fill', 'color-mix(in oklab, var(--color-text) 8%, transparent)'],
  ['--hover-fill-soft', 'color-mix(in oklab, var(--color-text) 7%, transparent)'],
  ['--open-fill', toward(16)],
]);

/**
 * The chrome that re-sets Background and Text to its own roles (the header and the phone menu:
 * Header, Header text), so everything in it, smart colours too, follows them.
 */
export const CHROME_ROLES = Object.freeze([['.header, .mmenu', [['background', 'header'], ['text', 'headerText']]]]);

let builds = 0;
/** How many times colorThemeCss built its CSS (a test guards it is once per theme). */
export const colorCssBuilds = () => builds;
const cache = new WeakMap();
const NO_THEME = {};
const NO_TEMPLATES = {};

/**
 * The color themes as one static stylesheet ('' never: the engine's always apply):
 *   :root { --palette-n }                  the engine's palette (theme.json's is :root:root)
 *   :root, .ct-<site> / .ct-<name> { … }   each theme's roles (and its set sub-roles)
 *   …, .tpl-<id> { --smart-…; aliases }    the smart colours, worked out on each element
 *   .ct-<name> .tpl-<id> { … }            a template's sub-roles inside a theme
 * Built once per theme.json (and templates) object.
 */
export function colorThemeCss(theme, templates) {
  const a = theme || NO_THEME;
  const b = templates || NO_TEMPLATES;
  let byTpl = cache.get(a);
  if (!byTpl) cache.set(a, (byTpl = new WeakMap()));
  if (byTpl.has(b)) return byTpl.get(b);
  builds++;
  const css = buildCss(theme, templates);
  byTpl.set(b, css);
  return css;
}

function buildCss(theme, templates) {
  const site = siteColorThemeOf(theme);
  const sel = (name) => (name === site ? `:root, .ct-${name}` : `.ct-${name}`);
  const ids = templateIds(theme, templates);
  // a text style set in any theme or template: the others reset it, so it follows its parent
  const typeSet = new Set();
  for (const name of THEME_NAMES) {
    Object.keys(typeRolesOf(own(theme, name))).forEach((s) => typeSet.add(s));
    for (const id of ids)
      Object.keys(templateRolesOf(theme, name, id, templates).typography).forEach((s) =>
        typeSet.add(s),
      );
  }
  const chrome = CHROME_ROLES.map(([selector]) => selector);
  const out = [
    // the album glow (--accent: client/theme.js tweens it; a theme's tokens.scss may set it) is
    // the site theme's Accent until an album sets its own
    `:root { ${decls([...DEFAULT_PALETTE.map((c, i) => [`--palette-${i + 1}`, c]), ['--accent', 'var(--color-accent)']])} }`,
    `${[':root', ...THEME_NAMES.map((n) => `.ct-${n}`), ...chrome, ...ids.map((id) => `.${templateClass(id)}`)].join(', ')} { ${decls([
      ...SMART.map((s) => [s.var, s.css]),
      ...TOKEN_ALIASES,
    ])} }`,
  ];
  for (const name of THEME_NAMES) {
    const roles = rolesOf(theme, name);
    const type = typeRolesOf(own(theme, name));
    out.push(
      `${sel(name)} { ${decls([
        ...ROLES.map((r) => [r.css, valueCss(roles[r.key])]),
        ...[...typeSet].map((s) => [typeVar(s), type[s] !== undefined ? valueCss(type[s]) : 'initial']),
        ...noneSmart(roles),
      ])} }`,
    );
  }
  for (const [selector, map] of CHROME_ROLES)
    out.push(`${selector} { ${decls(map.map(([to, from]) => [roleOf(to).css, `var(${roleOf(from).css})`]))} }`);
  // templates: after the themes; the site theme's first (it matches everywhere, as :root),
  // so a section's theme wins inside it. A role a template leaves out in a theme: inherit.
  const order = [site, ...THEME_NAMES.filter((n) => n !== site)];
  for (const name of order)
    for (const id of ids) {
      const { roles, typography } = templateRolesOf(theme, name, id, templates);
      const cls = templateClass(id);
      const selector =
        name === site ? `:root .${cls}, .ct-${name} .${cls}` : `.ct-${name} .${cls}`;
      const all = { ...rolesOf(theme, name), ...roles };
      out.push(
        `${selector} { ${decls([
          ...TEMPLATE_ROLES.map((k) => [roleOf(k).css, roles[k] !== undefined ? valueCss(roles[k]) : 'inherit']),
          ...[...typeSet].map((s) => [typeVar(s), typography[s] !== undefined ? valueCss(typography[s]) : 'inherit']),
          ...SMART.filter((s) => s.whenNone).map((s) => [s.var, all[s.whenNone] === 'none' ? s.none : s.css]),
        ])} }`,
      );
    }
  return out.join('\n');
}

/* ---------- the check: shape errors, contrast warnings ---------- */

const show = (v) => JSON.stringify(v);
const SLOT_TEXT = `a palette slot 1-${PALETTE_SIZE} or a color "#rrggbb"`;

function checkValue(where, v, none) {
  if (isRoleValue(v, none)) return [];
  if (v === 'none')
    return [`"${where}" can't be "none": only a fill can (Background, Button, Line, Header)`];
  return [`"${where}" must be ${SLOT_TEXT}${none ? ' or "none"' : ''}, not ${show(v)}`];
}

function checkTypography(where, t) {
  if (t === undefined) return [];
  if (!isObject(t)) return [`"${where}" must be an object { ${TYPE_STYLES.join(', ')} }`];
  return Object.entries(t).flatMap(([k, v]) =>
    TYPE_STYLES.includes(k)
      ? checkValue(`${where}.${k}`, v, false)
      : [`"${where}.${k}" is not a text style (${TYPE_STYLES.join(', ')})`],
  );
}

const isTemplateId = (id) => /^preset:[a-z]+$/.test(id) || /^t-[\w-]+$/.test(id);

function checkRoles(where, t, keys, extra) {
  if (!isObject(t)) return [`"${where}" must be an object of roles`];
  return Object.entries(t).flatMap(([k, v]) => {
    if (k === 'typography') return checkTypography(`${where}.typography`, v);
    if (k === 'templates' && extra.includes('templates')) {
      if (!isObject(v)) return [`"${where}.templates" must be an object { "<template id>": { … } }`];
      return Object.entries(v).flatMap(([id, s]) =>
        isTemplateId(id)
          ? checkRoles(`${where}.templates.${id}`, s, TEMPLATE_ROLES, ['typography'])
          : [`"${where}.templates.${id}" is not a template id ("preset:card", "t-…")`],
      );
    }
    if (!keys.includes(k)) return [`"${where}.${k}" is not a role (${[...keys, ...extra].join(', ')})`];
    return checkValue(`${where}.${k}`, v, roleOf(k).none);
  });
}

/** Problems of theme.json's palette, colorThemes and colorTheme (validate.js, ewcms check). */
export function checkColors(d) {
  const out = [];
  if (d.palette !== undefined && !ownPaletteOf(d))
    out.push(`"palette" must be ${PALETTE_SIZE} colors "#rrggbb", slot 1 first`);
  if (d.colorTheme !== undefined && !THEME_NAMES.includes(d.colorTheme))
    out.push(`"colorTheme" must be ${THEME_NAMES.map(show).join(', ')}, not ${show(d.colorTheme)}`);
  if (d.colorThemes === undefined) return out;
  if (!isObject(d.colorThemes))
    return [...out, `"colorThemes" must be an object { ${THEME_NAMES.join(', ')} }`];
  for (const [name, t] of Object.entries(d.colorThemes))
    out.push(
      ...(THEME_NAMES.includes(name)
        ? checkRoles(`colorThemes.${name}`, t, ROLE_KEYS, ['typography', 'templates'])
        : [`"colorThemes.${name}" is not a color theme (${THEME_NAMES.join(', ')})`]),
    );
  return out;
}

/** #rgb / #rrggbb → [r, g, b] 0-255. */
const rgbOf = (hex) => {
  const h = hex.slice(1);
  const f = h.length === 3 ? [...h].map((c) => c + c) : h.match(/../g);
  return f.map((x) => parseInt(x, 16));
};
const lum = (hex) => {
  const [r, g, b] = rgbOf(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** The WCAG contrast ratio of two colours (#rgb / #rrggbb). */
export const contrastOf = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const hexOf = (v, palette) => (v === 'none' ? null : isSlot(v) ? palette[v - 1] : v);

/**
 * Contrast warnings (ewcms check): per theme, each text colour against the nearest real
 * background (a template's, the section's, the site theme's: "none" is see-through). WCAG
 * 4.5:1, 3:1 for headings. Only once a site has its own palette or color themes.
 */
export function contrastWarnings(theme, templates = {}) {
  if (!ownPaletteOf(theme) && !isObject(theme?.colorThemes)) return [];
  const palette = paletteOf(theme);
  const siteBg = hexOf(rolesOf(theme, siteColorThemeOf(theme)).background, palette);
  const out = [];
  const label = (k) => roleOf(k)?.label || k;
  const check = (where, roles, type, fallbackBg) => {
    const bg = hexOf(roles.background, palette) || fallbackBg;
    const against = { background: bg, button: hexOf(roles.button, palette) || bg, header: hexOf(roles.header, palette) || siteBg, curtain: hexOf(roles.curtain, palette) };
    for (const r of ROLES) {
      if (!r.on || roles[r.key] === undefined) continue;
      const fg = hexOf(roles[r.key], palette);
      const on = against[r.on];
      if (!fg || !on) continue;
      const c = contrastOf(fg, on);
      if (c < r.min)
        out.push(`${where}: ${label(r.key)} on ${label(r.on)} has contrast ${c.toFixed(1)}:1 (needs ${r.min}:1)`);
    }
    for (const [s, v] of Object.entries(type)) {
      const fg = hexOf(v, palette);
      const min = TYPE_PARENT[s] === 'heading' ? 3 : 4.5;
      const c = contrastOf(fg, bg);
      if (c < min) out.push(`${where}: ${s} text on Background has contrast ${c.toFixed(1)}:1 (needs ${min}:1)`);
    }
    return bg;
  };
  for (const name of THEME_NAMES) {
    const roles = rolesOf(theme, name);
    const where = `colorThemes.${name}`;
    const bg = check(where, roles, typeRolesOf(own(theme, name)), siteBg);
    for (const id of templateIds(theme, templates)) {
      const t = templateRolesOf(theme, name, id, templates);
      if (!Object.keys(t.roles).length && !Object.keys(t.typography).length) continue;
      // a template's own background: all its text against it; else only what it sets
      const eff = { ...roles, ...t.roles };
      const keys = t.roles.background !== undefined ? TEMPLATE_ROLES : Object.keys(t.roles);
      const merged = Object.fromEntries(
        ['background', 'button', ...keys].map((k) => [k, eff[k]]),
      );
      check(`${where}.templates.${id}`, merged, t.typography, bg);
    }
  }
  return out;
}
