/**
 * The site's colours: one palette of 5 colours and 5 color themes that give them jobs (roles).
 * content/theme.json:
 *
 *   {
 *     "palette": ["#050505", "#101010", "#212121", "#cfc8b8", "#f2efe9"],
 *     "colorThemes": {
 *       "dark": {
 *         "background": 2, "text": 5, "link": "#c9a27a", "button": "transparent",
 *         "textStyles": { "label": 4 },
 *         "templates": { "preset:card": { "background": 3 }, "t-pmor": { "text": 4 } }
 *       }
 *     },
 *     "colorTheme": "darkest"
 *   }
 *
 *   palette       5 × #rrggbb; slot 1 is the calm, background end (--palette-1 … --palette-5)
 *   colorThemes   per theme (THEME_NAMES), only what differs from COLOR_THEME_DEFAULTS. A role's
 *                 value: a palette slot 1-5, a custom colour (#rgb or #rrggbb: it doesn't follow
 *                 the palette) or "transparent" (fill roles only: no fill). Button also
 *                 takes "glass" (the engine's glass pill, its default): see BUTTON_MODES
 *     textStyles  sub-roles: one text style's colour (Title, Heading, …; left out, it follows Text)
 *     templates   sub-roles of an item template (its id, as a List's config.template: "preset:card",
 *                 "t-…"): TEMPLATE_ROLES and textStyles; left out, the section's roles. A template
 *                 is its own thing: one made from another gets a copy of its sub-roles once
 *                 (templateRoleCopies, when it is added), basedOn is only a note
 *   colorTheme    the site color theme: the page, the chrome and every section that picks none
 *
 * Sections (page and footer) and header.json pick a theme with "colorTheme" (class ct-<name>).
 * Everything else (hover, pressed, faded, focus, …) is a smart colour (SMART), worked out from the
 * roles in CSS, never picked. All of it is one static <style id="color-themes"> in the head
 * (shell/layout.js); theme.json's palette is on :root:root (theme.js themeVarList), so a palette
 * edit swaps 5 values and everything follows.
 */
import { isObject } from './is.js';
import { isTemplateRef } from './files.js';
import { TEXT_STYLES } from './layout/text-styles.js';

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
 * The roles, the one table every name comes from. key: JSON; css: its variable; transparent: may
 * be "transparent" (no fill); template: a template may set it (TEMPLATE_ROLES); on: the role whose colour
 * it is read against (the contrast check), min: the contrast it needs (WCAG).
 */
export const ROLES = Object.freeze(
  [
    { key: 'background', label: 'Background', kind: 'fill', transparent: true, template: true },
    { key: 'text', label: 'Text', kind: 'text', template: true, on: 'background', min: 4.5 },
    { key: 'link', label: 'Link', kind: 'text', template: true, on: 'background', min: 4.5 },
    { key: 'accent', label: 'Accent', kind: 'text' },
    { key: 'button', label: 'Button', kind: 'fill', transparent: true, glass: true, template: true },
    { key: 'buttonText', label: 'Button text', kind: 'text', template: true, on: 'button', min: 4.5 },
    { key: 'line', label: 'Line', kind: 'fill', transparent: true, template: true },
    { key: 'header', label: 'Header', kind: 'fill', transparent: true },
    { key: 'headerText', label: 'Header text', kind: 'text', on: 'header', min: 4.5 },
    { key: 'curtain', label: 'Curtain', kind: 'fill' },
    { key: 'curtainText', label: 'Curtain text', kind: 'text', on: 'curtain', min: 4.5 },
  ].map((r) => ({ transparent: false, glass: false, template: false, ...r, css: `--color-${kebab(r.key)}` })),
);
export const ROLE_KEYS = Object.freeze(ROLES.map((r) => r.key));
const roleOf = (key) => ROLES.find((r) => r.key === key);

/** The roles a template may set (besides its textStyles). */
export const TEMPLATE_ROLES = Object.freeze(ROLES.filter((r) => r.template).map((r) => r.key));

/**
 * Each text style's parent role (the text styles: layout/text-styles.js TEXT_STYLES): Text, for
 * all of them; a sub-role left out follows it. Heading is a text style, not a role.
 */
export const TEXT_STYLE_PARENT = Object.freeze(Object.fromEntries(Object.keys(TEXT_STYLES).map((textStyle) => [textStyle, 'text'])));
/** The heading text styles: when set, they need 3:1 on Background (the others 4.5:1). */
const HEADING_TEXT_STYLES = ['title', 'heading', 'subheading', 'statement'];
export const TEXT_STYLE_NAMES = Object.freeze(Object.keys(TEXT_STYLE_PARENT));

/** A text style's sub-role variable (--color-type-<text style>; left out, the text style's colour is --color-text). */
export const textStyleVar = (textStyle) => `--color-type-${textStyle}`;

/**
 * The engine's color themes: each role's palette slot (a theme.json theme overrides any). Button:
 * glass, today's pill; its text the theme's Text, as the glass pill's was.
 */
export const COLOR_THEME_DEFAULTS = Object.freeze({
  lightest: { background: 5, text: 1, link: 3, accent: 3, button: 'glass', buttonText: 1, line: 4, header: 5, headerText: 1, curtain: 4, curtainText: 1 },
  light: { background: 4, text: 1, link: 2, accent: 2, button: 'glass', buttonText: 1, line: 5, header: 4, headerText: 1, curtain: 5, curtainText: 1 },
  accent: { background: 3, text: 5, link: 4, accent: 4, button: 'glass', buttonText: 5, line: 2, header: 3, headerText: 5, curtain: 1, curtainText: 5 },
  dark: { background: 2, text: 5, link: 4, accent: 4, button: 'glass', buttonText: 5, line: 3, header: 1, headerText: 5, curtain: 1, curtainText: 5 },
  darkest: { background: 1, text: 5, link: 5, accent: 4, button: 'glass', buttonText: 5, line: 3, header: 2, headerText: 5, curtain: 2, curtainText: 5 },
});

/**
 * The Button role's modes (the Button widget, the Form's Send, the header's CTA: .btn): a colour
 * (a palette slot or a custom hex: a solid fill), "glass" (the glass pill: the theme's Background a
 * step toward Text, see-through, blurred) or "transparent" (text only). Button text in all of them; hover
 * and pressed are the smart colours (button-hover, button-pressed), visible in each mode.
 */
export const BUTTON_MODES = Object.freeze(['color', 'glass', 'transparent']);
/** A Button value's mode: "glass", "transparent" or "color". */
export const buttonModeOf = (v) => (v === 'glass' || v === 'transparent' ? v : 'color');

/**
 * Smart colours: worked out from the roles, never picked: [name, CSS (with --color-* of the
 * same element), the rule in words, CSS when the fill it depends on is "transparent"].
 */
const mix = (a, pa, b) => `color-mix(in oklab, var(${a}) ${pa}%, ${b})`;
// the glass (client/styles/_glass.scss .glass): Background a step toward Text, see-through, tinted
// by Accent; t: the tint, step: toward Text, alpha: how solid (its rest: 8, 10, 42)
const glassMix = (t, step, alpha) =>
  `color-mix(in oklab, var(--color-accent) ${t}%, color-mix(in oklab, color-mix(in oklab, var(--color-background), var(--color-text) ${step}%) ${alpha}%, transparent))`;
export const SMART = Object.freeze([
  {
    name: 'button-hover',
    css: `color-mix(in oklab, var(--color-button), var(--color-button-text) 12%)`,
    rule: 'Button, mixed 12% toward Button text (Transparent: Text at 10% over Background; Glass: the glass a step lighter)',
    whenTransparent: 'button',
    transparent: mix('--color-text', 10, 'var(--color-background)'),
    glass: glassMix(12, 20, 50),
  },
  {
    name: 'button-pressed',
    css: `color-mix(in oklab, var(--color-button), var(--color-background) 18%)`,
    rule: 'Button, mixed 18% toward Background (Transparent: Text at 18% over Background; Glass: the glass two steps lighter)',
    whenTransparent: 'button',
    transparent: mix('--color-text', 18, 'var(--color-background)'),
    glass: glassMix(16, 30, 58),
  },
  { name: 'link-hover', css: mix('--color-link', 65, 'var(--color-background)'), rule: 'Link at 65% over Background' },
  { name: 'faded', css: mix('--color-text', 60, 'var(--color-background)'), rule: 'Text at 60% over Background' },
  { name: 'focus', css: 'var(--color-accent)', rule: 'Accent, as a ring outside the element' },
  { name: 'disabled', css: mix('--color-text', 35, 'var(--color-background)'), rule: 'Text at 35% over Background' },
  {
    name: 'line-hover',
    css: `color-mix(in oklab, var(--color-line), var(--color-text) 35%)`,
    rule: 'Line, mixed 35% toward Text',
    whenTransparent: 'line',
    transparent: 'transparent',
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

/** A role's value is valid: a slot, a custom hex, or "transparent" / "glass" where the role allows it. */
export const isRoleValue = (v, transparent = false, glass = false) =>
  isSlot(v) || isHex(v) || (transparent && v === 'transparent') || (glass && v === 'glass');

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

/** A theme's 12 roles: its theme.json values over the engine's ({ key: slot | hex | "transparent" }). */
export function rolesOf(theme, name) {
  const set = own(theme, name);
  const out = {};
  for (const r of ROLES) {
    const v = set[r.key];
    out[r.key] = isRoleValue(v, r.transparent, r.glass) ? normal(v) : COLOR_THEME_DEFAULTS[name][r.key];
  }
  return out;
}

const normal = (v) => (typeof v === 'string' ? v.toLowerCase() : v);

/** A theme's (or template's) text-style sub-roles that are set: { textStyle: value }. */
export function textStyleRolesOf(set) {
  const t = isObject(set?.textStyles) ? set.textStyles : {};
  const out = {};
  for (const textStyle of TEXT_STYLE_NAMES) if (isRoleValue(t[textStyle])) out[textStyle] = normal(t[textStyle]);
  return out;
}

/**
 * A template's own sub-roles in a theme, only what is set: { roles, textStyles } (none: the
 * section's roles; its parent's are never read, see copyTemplateRoles).
 */
export function templateRolesOf(theme, name, id) {
  const all = own(theme, name).templates;
  const set = isObject(all) && isObject(all[id]) ? all[id] : {};
  const roles = {};
  for (const k of TEMPLATE_ROLES)
    if (isRoleValue(set[k], roleOf(k).transparent, roleOf(k).glass)) roles[k] = normal(set[k]);
  return { roles, textStyles: textStyleRolesOf(set) };
}

/**
 * A template made from another (a preset or a site template: its basedOn): the edits that copy
 * the parent's sub-roles into the new one's own entry, in each color theme that has them:
 * [[JSON pointer in theme.json, value]] ([] when there is nothing to copy). The editor applies
 * them to its theme.json (unsaved edits too) as one undo step, when it adds the template; then
 * each is its own.
 */
export function templateRoleCopies(theme, from, to) {
  if (!isObject(theme?.colorThemes) || !from || !to || from === to) return [];
  const ptr = (...parts) => `/${parts.map((p) => String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;
  return Object.entries(theme.colorThemes).flatMap(([name, t]) => {
    const tpl = isObject(t) && isObject(t.templates) ? t.templates : null;
    return tpl && isObject(tpl[from]) && tpl[to] === undefined
      ? [[ptr('colorThemes', name, 'templates', to), structuredClone(tpl[from])]]
      : [];
  });
}

/** A role value as CSS: a slot's var, a custom colour, or transparent ("transparent"; "glass": no colour of its own). */
export const valueCss = (v) =>
  v === 'transparent' || v === 'glass' ? 'transparent' : isSlot(v) ? `var(--palette-${v})` : String(v);

/** The template ids any theme sets sub-roles for. */
function templateIds(theme) {
  const ids = new Set();
  for (const name of THEME_NAMES) {
    const t = own(theme, name).templates;
    if (isObject(t)) for (const id of Object.keys(t)) ids.add(id);
  }
  return [...ids];
}

const decls = (list) => list.map(([k, v]) => `${k}: ${v}`).join('; ');

/**
 * The smart colours that depend on a fill's mode ("transparent", Button's "glass"), for these roles:
 * [[var, css]]; only the ones a mode changes, unless `all` (a template: over its section's).
 */
const modeSmart = (roles, all = false) =>
  SMART.filter((s) => s.whenTransparent)
    .map((s) => {
      const v = roles[s.whenTransparent];
      return [s.var, v === 'transparent' ? s.transparent : v === 'glass' && s.glass ? s.glass : s.css];
    })
    .filter(([v, css]) => all || css !== SMART.find((s) => s.var === v).css);

/**
 * A template that sets Text but no Button text, in a theme whose Button text is the default and
 * whose button is glass or transparent (it shows the template's text): its Button text follows its Text,
 * as the glass pill's text always did.
 */
const buttonTextFollows = (theme, name, set) =>
  set.buttonText === undefined &&
  set.text !== undefined &&
  own(theme, name).buttonText === undefined &&
  buttonModeOf(set.button ?? rolesOf(theme, name).button) !== 'color';

// the glass pill's blur (client/styles/_glass.scss .btn::before): a site's --btn-backdrop, else this
export const BUTTON_BLUR = 'var(--btn-backdrop, blur(22px) saturate(180%))';
/**
 * The button rules for the roles' Button under `scope` (selectors; '' for none): its fill and blur
 * at rest (glass: the .glass fill; a colour: Button; transparent: no fill), hover and pressed the smart
 * colours. Only written when some theme or template's Button is not glass (the engine's .btn is
 * the glass pill): then each theme says its own, so a section's wins over the site theme's.
 */
const buttonRules = (scopes, v) => {
  const at = (el) => scopes.map((sc) => `${sc} ${el}`).join(', ');
  const glass = buttonModeOf(v) === 'glass';
  const fill = glass ? 'var(--glass-fill)' : 'var(--color-button)';
  const blur = glass ? BUTTON_BLUR : 'none';
  return [
    `${at('.btn::before')} { background: ${fill}; -webkit-backdrop-filter: ${blur}; backdrop-filter: ${blur} }`,
    `${at('.btn:hover::before')} { background: var(--smart-button-hover) }`,
    `${at('.btn:active::before')} { background: var(--smart-button-pressed) }`,
  ];
};

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

/** Colour tokens retired (no alias): each colour is its role's or smart colour's now. */
export const RETIRED_COLOR_TOKENS = Object.freeze([
  '--btn-bg',
  '--btn-fg',
  '--btn-hover-bg',
  '--btn-hover-fg',
  '--nav-active-bg',
  '--nav-active-fg',
  '--menu-active-fg',
  '--selection-bg',
  '--selection-fg',
  '--skip-link-bg',
  '--skip-link-fg',
  '--tag-border-color',
]);

/** A list item's fill, once a site token: each item sets its own now (src/widgets/list/style.scss). */
const ITEM_FILL_TOKENS = ['--item-bg', '--item-bg-hover'];

/**
 * The colour tokens a site's tokens.scss may still set that colour nothing of the engine (ewcms
 * check warns): the aliases, the retired ones, the item fill and the old --type-<text style>-color.
 */
export const isOldColorToken = (name) =>
  TOKEN_ALIASES.some(([alias]) => alias === name) ||
  RETIRED_COLOR_TOKENS.includes(name) ||
  ITEM_FILL_TOKENS.includes(name) ||
  /^--type-[a-z]+-color$/.test(name);

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

/**
 * The color themes as one static stylesheet ('' never: the engine's always apply), as the page
 * head writes it in <style id="color-themes"> ("<" escaped: it can't end the element). Not cached:
 * the editor's theme.json changes in place (colorThemeCss caches it per object).
 */
export const colorThemeStyle = (theme) => buildCss(theme).replace(/</g, '\\3c ');

/**
 * The color themes as one static stylesheet ('' never: the engine's always apply):
 *   :root { --palette-n }                  the engine's palette (theme.json's is :root:root)
 *   :root, .ct-<site> / .ct-<name> { … }   each theme's roles (and its set sub-roles)
 *   …, .tpl-<id> { --smart-…; aliases }    the smart colours, worked out on each element
 *   .ct-<name> .tpl-<id> { … }            a template's sub-roles inside a theme
 * Built once per theme.json object.
 */
export function colorThemeCss(theme) {
  const key = theme || NO_THEME;
  if (cache.has(key)) return cache.get(key);
  builds++;
  const css = buildCss(theme).replace(/</g, '\\3c ');
  cache.set(key, css);
  return css;
}

function buildCss(theme) {
  const site = siteColorThemeOf(theme);
  const sel = (name) => (name === site ? `:root, .ct-${name}` : `.ct-${name}`);
  const ids = templateIds(theme);
  // a text style set in any theme or template: the others reset it, so it follows its parent
  const textStyleSet = new Set();
  for (const name of THEME_NAMES) {
    Object.keys(textStyleRolesOf(own(theme, name))).forEach((textStyle) => textStyleSet.add(textStyle));
    for (const id of ids)
      Object.keys(templateRolesOf(theme, name, id).textStyles).forEach((textStyle) =>
        textStyleSet.add(textStyle),
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
    const textStyles = textStyleRolesOf(own(theme, name));
    out.push(
      `${sel(name)} { ${decls([
        ...ROLES.map((r) => [r.css, valueCss(roles[r.key])]),
        ...[...textStyleSet].map((textStyle) => [
          textStyleVar(textStyle),
          textStyles[textStyle] !== undefined ? valueCss(textStyles[textStyle]) : 'initial',
        ]),
        ...modeSmart(roles),
      ])} }`,
    );
  }
  for (const [selector, map] of CHROME_ROLES)
    out.push(`${selector} { ${decls(map.map(([to, from]) => [roleOf(to).css, `var(${roleOf(from).css})`]))} }`);
  // the chrome works its smart colours out again (its own Background, Text): with the site
  // theme's fill modes, where the header picks no theme of its own
  out.push(
    `${chrome
      .join(', ')
      .split(', ')
      .map((c) => `${c}:not([class*=' ct-'])`)
      .join(', ')} { ${decls(modeSmart(rolesOf(theme, site)))} }`,
  );
  // buttons: the engine's .btn is the glass pill; another mode anywhere: each theme says its own
  const anyButton =
    THEME_NAMES.some((n) => buttonModeOf(rolesOf(theme, n).button) !== 'glass') ||
    ids.some((id) => THEME_NAMES.some((n) => buttonModeOf(templateRolesOf(theme, n, id).roles.button ?? 'glass') !== 'glass'));
  if (anyButton)
    for (const name of [site, ...THEME_NAMES.filter((n) => n !== site)])
      out.push(...buttonRules(name === site ? [':root', `.ct-${name}`] : [`.ct-${name}`], rolesOf(theme, name).button));
  // templates: after the themes; the site theme's first (it matches everywhere, as :root),
  // so a section's theme wins inside it. A role a template leaves out in a theme: inherit.
  const order = [site, ...THEME_NAMES.filter((n) => n !== site)];
  // the templates that set a Background in some theme
  const paints = new Set(
    ids.filter((id) =>
      THEME_NAMES.some((n) => templateRolesOf(theme, n, id).roles.background !== undefined),
    ),
  );
  for (const name of order)
    for (const id of ids) {
      const { roles, textStyles } = templateRolesOf(theme, name, id);
      const cls = templateClass(id);
      const selector =
        name === site ? `:root .${cls}, .ct-${name} .${cls}` : `.ct-${name} .${cls}`;
      const all = { ...rolesOf(theme, name), ...roles };
      // its item paints a Background it sets, when its style's fill is left empty (a fill set,
      // inline, wins: Transparent is see-through, Surface a surface of it); a theme where it sets none:
      // none (over the site theme's rule, which matches everywhere). Hover: .li's, its own fill
      const fill = [['--item-bg', roles.background !== undefined ? 'var(--color-background)' : 'transparent']];
      out.push(
        `${selector} { ${decls([
          ...TEMPLATE_ROLES.map((k) => [
            roleOf(k).css,
            roles[k] !== undefined
              ? valueCss(roles[k])
              : k === 'buttonText' && buttonTextFollows(theme, name, roles)
                ? 'var(--color-text)'
                : 'inherit',
          ]),
          ...(paints.has(id) ? fill : []),
          ['color', 'var(--color-text)'],
          // a text style it leaves out: its own Text when it sets one (over the section's text
          // style, as the editor shows it), else the section's
          ...[...textStyleSet].map((textStyle) => [
            textStyleVar(textStyle),
            textStyles[textStyle] !== undefined
              ? valueCss(textStyles[textStyle])
              : roles.text !== undefined
                ? 'var(--color-text)'
                : 'inherit',
          ]),
          ...modeSmart(all, true),
        ])} }`,
      );
      if (anyButton && roles.button !== undefined)
        out.push(...buttonRules(name === site ? [`:root .${cls}`, `.ct-${name} .${cls}`] : [`.ct-${name} .${cls}`], roles.button));
    }
  return out.join('\n');
}

/* ---------- the check: shape errors, contrast warnings ---------- */

const show = (v) => JSON.stringify(v);
const SLOT_TEXT = `a palette slot 1-${PALETTE_SIZE} or a color "#rrggbb"`;

function checkValue(where, v, transparent, glass = false) {
  if (isRoleValue(v, transparent, glass)) return [];
  // "none" was renamed "transparent": a leftover one says so
  if (v === 'none')
    return [
      transparent
        ? `"${where}" is "none": use "transparent" (no fill; "none" was renamed)`
        : `"${where}" can't be "none" (now "transparent"): only a fill can be transparent (Background, Button, Line, Header)`,
    ];
  if (v === 'transparent')
    return [`"${where}" can't be "transparent": only a fill can (Background, Button, Line, Header)`];
  if (v === 'glass') return [`"${where}" can't be "glass": only Button can`];
  const more = [glass && '"glass"', transparent && '"transparent"'].filter(Boolean).join(', ');
  return [`"${where}" must be ${SLOT_TEXT}${more ? `, ${more}` : ''}, not ${show(v)}`];
}

function checkTextStyles(where, t) {
  if (t === undefined) return [];
  if (!isObject(t)) return [`"${where}" must be an object of text styles { ${TEXT_STYLE_NAMES.join(', ')} }`];
  return Object.entries(t).flatMap(([textStyle, v]) =>
    TEXT_STYLE_NAMES.includes(textStyle)
      ? checkValue(`${where}.${textStyle}`, v, false)
      : [`"${where}.${textStyle}" is not a text style (${TEXT_STYLE_NAMES.join(', ')})`],
  );
}


function checkRoles(where, t, keys, extra) {
  if (!isObject(t)) return [`"${where}" must be an object of roles`];
  return Object.entries(t).flatMap(([k, v]) => {
    if (k === 'textStyles') return checkTextStyles(`${where}.textStyles`, v);
    if (k === 'templates' && extra.includes('templates')) {
      if (!isObject(v)) return [`"${where}.templates" must be an object { "<template id>": { … } }`];
      return Object.entries(v).flatMap(([id, s]) =>
        isTemplateRef(id)
          ? checkRoles(`${where}.templates.${id}`, s, TEMPLATE_ROLES, ['textStyles'])
          : [`"${where}.templates.${id}" is not a template id ("preset:card", "t-…")`],
      );
    }
    if (k === 'heading')
      return [
        `"${where}.heading" is not a role any more: Heading is a text style ("${where}.textStyles": { "heading": … }, as Title, Subheading and Statement); left out, a text style follows Text`,
      ];
    if (!keys.includes(k)) return [`"${where}.${k}" is not a role (${[...keys, ...extra].join(', ')})`];
    return checkValue(`${where}.${k}`, v, roleOf(k).transparent, roleOf(k).glass);
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
        ? checkRoles(`colorThemes.${name}`, t, ROLE_KEYS, ['textStyles', 'templates'])
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

const hexOf = (v, palette) => (v === 'transparent' || v === 'glass' ? null : isSlot(v) ? palette[v - 1] : v);

/**
 * Contrast warnings (ewcms check): per theme, each text colour against the background that
 * renders under it (a template's, the section's, the site theme's: "transparent" is see-through). WCAG
 * 4.5:1, 3:1 for the heading text styles. Only once a site has its own palette or color themes. seeThrough: the
 * templates whose item style's fill is Transparent (src/widgets/list/item-style.js): their Background
 * never shows, so their text is read against the section's.
 */
export function contrastWarnings(theme, { seeThrough = [] } = {}) {
  if (!ownPaletteOf(theme) && !isObject(theme?.colorThemes)) return [];
  const palette = paletteOf(theme);
  const siteBg = hexOf(rolesOf(theme, siteColorThemeOf(theme)).background, palette);
  const out = [];
  const label = (k) => roleOf(k)?.label || k;
  const check = (where, roles, textStyles, fallbackBg) => {
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
    for (const [textStyle, v] of Object.entries(textStyles)) {
      const fg = hexOf(v, palette);
      const min = HEADING_TEXT_STYLES.includes(textStyle) ? 3 : 4.5;
      const c = contrastOf(fg, bg);
      if (c < min)
        out.push(`${where}: the ${textStyle} text style on Background has contrast ${c.toFixed(1)}:1 (needs ${min}:1)`);
    }
    return bg;
  };
  for (const name of THEME_NAMES) {
    const roles = rolesOf(theme, name);
    const where = `colorThemes.${name}`;
    const bg = check(where, roles, textStyleRolesOf(own(theme, name)), siteBg);
    for (const id of templateIds(theme)) {
      const t = templateRolesOf(theme, name, id);
      if (!Object.keys(t.roles).length && !Object.keys(t.textStyles).length) continue;
      // a template's own background (when its fill lets it show): all its text against it; else
      // only what it sets, against the section's
      const { background, ...set } = t.roles;
      if (buttonTextFollows(theme, name, t.roles)) set.buttonText = set.text;
      const shows = background !== undefined && !seeThrough.includes(id);
      const eff = { ...roles, ...set, ...(shows ? { background } : {}) };
      const keys = shows ? TEMPLATE_ROLES : Object.keys(set);
      const merged = Object.fromEntries(
        ['background', 'button', ...keys].map((k) => [k, eff[k]]),
      );
      check(`${where}.templates.${id}`, merged, t.textStyles, bg);
    }
  }
  return out;
}
