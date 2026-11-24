/**
 * The widget registry: what a widget of each type shows and which settings the editor offers
 * for it. Every widget, built in or the site's own, is a widget module: a folder whose
 * index.js default-exports its definition (below), with an optional style.scss (its look,
 * bundled into the site's stylesheet) and client.js (its behaviour on the page: a default
 * export `(el) => cleanup?`, run for every one of its elements, .wgt--<type>). The built-ins
 * are the folders here, always on; a site adds its own in ewcms.config.mjs `widgets`
 * (src/cli/site-widgets.mjs loads them; the browser gets them from virtual:site-widgets). Widgets sit in the sections of a page (src/render/layout/index.js places them):
 *
 *   { "id": "w-k3x9", "type": "list", "label": "People", "heading": "Models",
 *     "source": { "mode": "all", "from": "people" }, "config": { "template": "preset:card" },
 *     "layout": { "base": { "col": 1, "span": 120, "row": 1 } } }
 *
 * The widget's own content (texts, photos) sits next to its type, the items it shows under
 * "source" (../layout/source.js); how it works (its look, on/off) is under "config"; where it sits is the layout's (id, layout, layer,
 * size: layout keys, never a setting's key). A type:
 *
 *   type      its name in the content
 *   label     its name in the editor; icon: a Font Awesome icon name (no "fa-")
 *   line      one line on what it is, under its name in the editor's Add widget modal
 *   sketch    the modal's drawing of it: a type's name, or another type's (its drawing)
 *   drawing   the drawing itself (WidgetsModal.svelte): its shapes, each a string of the modal's
 *             shape classes (w40..w90 width, h4..h16 height, img, box, pill, sc s1..s3, mid) or
 *             { grid: n }, a row of n tiles; none: two plain lines
 *   placement optional { axes, box, fill, place, media }: its content box's Fit / Fill and
 *             place in the widget (../layout/place.js)
 *   fitWidth  optional true: its text lines can each fill its width (a line's "fit", the
 *             toolbar's Full-width line; ../text.js)
 *   scaleToFit  optional true: its whole text can scale down to fit it (the widget's "scale",
 *             Shrink to fit; ../layout/type.js)
 *   size      optional false: no Size (Auto / Rows / Aspect); every built-in has it
 *   settings  its content settings for the editor (each one field there; an item's properties
 *             can fill them, ../layout/bindings.js): [{ key, label, type?, width?, list?, item?, blank?, inPlace? }]
 *               type: 'text' (default) | 'multiline' (multi-line) | 'words' | 'number' | 'photo'
 *                     (the types: ../property-types.js)
 *               width: 'half' shares a row with a half setting next to it (short texts)
 *               list: the setting is a list: a type for a list of values ('multiline'), or
 *                     { subkey: type } for a list of objects ({ title: 'text' }; a subkey
 *                     can also be 'source', a content/en/sources file, 'boolean' (a switch), or
 *                     { type, label, width?, options? }: a type with its label, 'select' with options
 *                     [[value, label]])
 *               item: a new item of the list (default: '' or the subkeys empty)
 *               check(value): optional, problems with the setting's value beyond its type
 *                     ('"photos.0.phone" must be …', src/render/validate.js; the Hero's
 *                     photos: each one's phone place)
 *               itemDefaults: { name, values }: an item's values never stored (each left out
 *                     when it equals its default, src/render/defaults.js; e.g. the Hero's
 *                     photos: { name: 'photo', values: { layer: 'back' } }); name: an item
 *                     in its messages ("section 1, widget 2 photo 3")
 *               blank: 'keep': emptied, its element stays (render shows '' in it), so the
 *                     editor writes an emptied value in place too; without it an emptied
 *                     text renders the widget again (it may leave the element out or show a
 *                     default instead)
 *               inPlace: { after(el, value) }: run in the editor's preview after it wrote a typed
 *                     value into the setting's element el (data-edit), for what the render
 *                     writes beside it (the Hero's name: --hero-word on its title)
 *             A text, multi-line, words or number setting typed is written into its elements
 *             in place (src/editor/layout-sync.js patchTexts); anything else renders the
 *             widget again.
 *   config    how it works (its look, on/off): [{ key, label, type, options?, empty?, inPlace? }]
 *               type: 'source' (a content/en/sources file) | 'select' (options [[value, label]])
 *                     | 'text' | 'boolean'; every widget also has config.enabled (on/off)
 *               inPlace: how the editor's preview shows a changed value in place, as render()
 *                     writes it, instead of rendering the widget again (src/editor/
 *                     widget-fields.js configStep): { on, var } sets the CSS variable var on
 *                     the widget's own element matching the selector on, or { on, class, when }
 *                     toggles class on it (on when the value is when); value(config) optional:
 *                     the value from the widget's config (default: config[key]; '', null or
 *                     undefined removes the variable). E.g. a List's gap:
 *                     { on: '.list__items--grid', var: '--list-gap', value: (c) => gapOf(c) || null }
 *   inTemplate  optional { missing?, join?, fields? }: what the Template editor offers for it in a List's
 *             item template (TemplateWidgetFields.svelte): missing, When a value is missing
 *             (config.missing, ../layout/missing.js); join, Between facts (its join);
 *             fields, its own Content rows (a Photo's photo, a Button's label and link, an
 *             inner List's Items from, Summary and details' template): [{ key, label, type?,
 *             binds?, options?, help?, disabled?, value?, write?, structure?, replace?, empty? }]
 *               key: the path under the widget ('src', 'config/link', 'source/mode')
 *               type: 'text' (default) | 'boolean' | 'select' | 'match' (an inner List's two
 *                     Match fields; theirs, ours, between: the two labels and the text between)
 *               binds: true: a parts field (the sample's properties, {number}, {back}, parent:
 *                     keys)
 *               options: a list [[value, label]], or a name of a set the Template editor
 *                     provides ('itemsFrom', 'listProps', 'sources', 'innerTemplates',
 *                     'detailsTemplates', 'bindsOrSummary')
 *               help: a string, or a function of the widget
 *               disabled: a function of the widget
 *               value(widget): the field's value (default: the key's)
 *               write(value): what to store (default: the value)
 *               structure: true: a structural change (the preview renders again)
 *               replace: 'source': changing it replaces the widget's source (an inner List's
 *                     Items from)
 *               empty: a first option ['', empty] for a select (a Details template: 'Pick a
 *                     template')
 *   hint      optional: a line the editor shows first in its Content tab (a Text: where its
 *             words are typed)
 *   defaults  a new widget of this type (Add widget)
 *   check(widget)  optional: more problems than its settings' types (src/render/validate.js)
 *   pageTitle(widget)  optional: the page's title from this widget, { title } (title undefined:
 *             none), or null to ask the next widget: its page's first one that gives one names it
 *             (src/render/routes.js pageTitle; a Text: its first title line)
 *   warn(widget)   optional: things to tell, not problems (ewcms check shows them, e.g. a
 *             List's leftover config.properties; src/render/validate.js)
 *   list      a list widget: it shows all its source's items (its source: All / From URL /
 *             None), not one (Item / From URL / None): ../layout/source.js
 *   item      it needs an item (its source's first): without one it is skipped
 *   render(data, ctx, widget)  its HTML, one root element. data: the widget's values (bound
 *             settings filled in with the item's properties); widget: { id, file, ed, source,
 *             items, item, index, indexOf }: the widget's id, the page file, ed(key or path, type, { inline }), the editor marker of one
 *             of its settings, and what its source shows (widgetItems, ../layout/source.js)
 */
import text from './text/index.js';
import photo from './photo/index.js';
import button from './button/index.js';
import form from './form/index.js';
import hero from './hero/index.js';
import list from './list/index.js';
import { details } from './list/details.js';

/** The built-in widgets, always on, in the order the editor offers them. */
export const BUILTIN_WIDGETS = Object.freeze([
  text,
  photo,
  button,
  form,
  hero,
  list,
]);

/**
 * Widget types that are gone, each with what to write instead: content that still has one is
 * rejected (src/render/validate.js); nothing converts it.
 */
export const RETIRED_WIDGETS = Object.freeze({
  panels:
    'Photo panels ("panels") is gone: use a List ("list") with "config": { "custom": true, "template": "preset:panel", "columns": "2", "items": [{ "title", "source", "unit" }] }',
  grid: 'Photo grid ("grid") is gone: use a List ("list") with a template (Album card: "t-acrp" / "t-acrl", or a preset)',
  projects:
    'Project list ("projects") is gone: use a List ("list") with "config": { "template": "t-prow", "columns": "1" } (or a row preset)',
  albums:
    'Album cards ("albums") is gone: use a List ("list") with a Card template ("preset:card", or "t-acrp" / "t-acrl")',
  album:
    'Album (the item) ("album") is gone: use a List ("list") with a From URL source and a template ("preset:plain", or a site template such as "t-albp" / "t-albl")',
});

/**
 * Every widget type: the built-ins, then the site's own (registerWidgets, from ewcms.config.mjs
 * `widgets`), by type. One object for the whole app: registering adds to it.
 */
export const WIDGET_TYPES = Object.fromEntries(BUILTIN_WIDGETS.map((t) => [t.type, t]));

/**
 * Template-only widget types: they sit on an item template, never on a page (the List
 * renders them). Not in WIDGET_TYPES, so a page's Add widget does not offer them.
 */
export const TEMPLATE_WIDGETS = Object.freeze([details]);
const TEMPLATE_TYPES = Object.fromEntries(TEMPLATE_WIDGETS.map((t) => [t.type, t]));

/** A type's definition: a page widget, or a template-only one (Summary and details). */
export const widgetType = (type) => WIDGET_TYPES[type] || TEMPLATE_TYPES[type];

const BUILTIN = new Set(BUILTIN_WIDGETS.map((t) => t.type));
const TYPE_NAME = /^[a-z][a-z0-9-]*$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** What is wrong with a widget definition (a widget module's default export): messages. */
export function widgetProblems(def) {
  if (!isObj(def)) return ['its default export must be a widget definition (an object)'];
  const out = [];
  if (typeof def.type !== 'string' || !TYPE_NAME.test(def.type))
    out.push('"type" must be a name in lowercase letters, digits and "-" ("quote", "price-list")');
  if (typeof def.label !== 'string' || !def.label) out.push('"label" must be a text');
  if (typeof def.render !== 'function') out.push('"render" must be a function (data, ctx, widget)');
  if (def.fields !== undefined)
    out.push('"fields" is "settings" now: write `settings: [{ key, label, type? }]`');
  if (def.settings !== undefined && !Array.isArray(def.settings))
    out.push('"settings" must be a list');
  if (def.config !== undefined && !Array.isArray(def.config)) out.push('"config" must be a list');
  if (def.defaults !== undefined && !isObj(def.defaults)) out.push('"defaults" must be an object');
  for (const k of ['icon', 'line', 'sketch'])
    if (def[k] !== undefined && typeof def[k] !== 'string') out.push(`"${k}" must be a text`);
  return out;
}

/**
 * Add a site's own widgets (definitions) to WIDGET_TYPES, after the built-ins. A bad
 * definition or a built-in's type throws; the same type again replaces it (a reload).
 * `from`: where they come from, for the messages.
 */
export function registerWidgets(defs, from = 'ewcms.config.mjs widgets') {
  for (const def of defs) {
    const problems = widgetProblems(def);
    const name = def?.type || '?';
    if (problems.length) throw new Error(`${from}: widget "${name}": ${problems.join('; ')}`);
    if (BUILTIN.has(def.type))
      throw new Error(`${from}: widget "${def.type}" is a built-in widget's type: use another`);
    WIDGET_TYPES[def.type] = def;
  }
  return WIDGET_TYPES;
}

/** Whether a type is one of the site's own (not built in). */
export const isCustomWidget = (type) => !!WIDGET_TYPES[type] && !BUILTIN.has(type);

/**
 * What the preview can't show without rendering the widget again: its type, content and
 * config, but not on/off, where it sits, its size, link, text scale or motion (the
 * editor applies those).
 */
export function kindOf(widget) {
  // eslint-disable-next-line no-unused-vars
  const { layout, layer, size, aspect, motion, scale, config, ...rest } = widget || {};
  const { enabled, ...settings } = config || {}; // eslint-disable-line no-unused-vars
  return JSON.stringify([rest, settings]);
}
