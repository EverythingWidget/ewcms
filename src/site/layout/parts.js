/**
 * Parts: one way to put an item's properties into any widget value (a Button's label, a
 * Photo's caption, a link, the Text widget's lines: ../text.js).
 *
 *   "label": "Models"                                   its own text (Custom)
 *   "label": [{ "property": "name" }]                   the item's name (any type: a photo, a
 *                                                       link, a list of photos, when it fits)
 *   "label": [{ "property": "count" }, { "t": " photos in " }, { "property": "city" }]
 *                                                       text with properties
 *   { "property": "count", "format": "{value} photos" } a property with a text around it (an
 *                                                       empty value leaves the part empty)
 *
 * A value is parts when it is a list of { t } and { property } with at least one property (a
 * value of only text is a plain string). Typed, `{name}` is a property, `{{` a literal `{`
 * and `}}` a literal `}` (parseTyped, typedText).
 *
 * A name is a property of the item (keys: its source's schema). A name that isn't one but is
 * a source's id (content/en/sources) is that source's list: `{people}` with no item shows how
 * many people there are. A schema property never falls back to a source of the same name: an
 * item without it is missing. A list shows its length (an empty list "0").
 *
 * `items` is a reserved name: the widget's own items (scope.items: a List's, or a list widget's
 * source items), a list, so it shows how many. The same A1 rule: the item's own `items`
 * property (or one its schema names) wins, then the widget's items, then a source called
 * "items". Order: item property > schema property (missing) > {items} > a source.
 *
 * Empty: missing, null or '' (0, false and an empty list are values). An empty property's part
 * is empty, the rest shows; when every property part of a widget is empty the widget isn't on
 * the published page (./index.js; the editor shows it dimmed: "No value for …").
 */
import { isObject } from '../is.js';

const isTextPart = (p) => isObject(p) && typeof p.t === 'string';
export const isPropertyPart = (p) => isObject(p) && typeof p.property === 'string';
/** A list of parts with a property in it. */
export const isParts = (v) =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((p) => isTextPart(p) || isPropertyPart(p)) &&
  v.some(isPropertyPart);
/** A single property, no format: the item's value as a whole (any type). */
export const isWhole = (v) => isParts(v) && v.length === 1 && v[0].format === undefined;

export const NAME = /^[\w-]+$/;

/** The reserved name of a widget's own items ({items}: how many it shows). */
export const ITEMS = 'items';

/** Typed text as parts ({name}: a property, {{ a literal {, }} a literal }); only text: a string. */
export function parseTyped(s) {
  const str = String(s ?? '');
  const out = [];
  const text = (t) => {
    const z = out.at(-1);
    if (isTextPart(z)) z.t += t;
    else if (t) out.push({ t });
  };
  const re = /\{\{|\}\}|\{([\w-]+)\}/g;
  let at = 0;
  for (const m of str.matchAll(re)) {
    text(str.slice(at, m.index));
    if (m[0] === '{{') text('{');
    else if (m[0] === '}}') text('}');
    else out.push({ property: m[1] });
    at = m.index + m[0].length;
  }
  text(str.slice(at));
  return out.some(isPropertyPart) ? out : out.map((p) => p.t).join('');
}

const escText = (t) => String(t ?? '').replace(/[{}]/g, (c) => c + c);
/** Parts (or a string) as typed text: the inverse of parseTyped. */
export const typedText = (v) =>
  typeof v === 'string'
    ? escText(v)
    : (Array.isArray(v) ? v : [])
        .map((p) => (isPropertyPart(p) ? `{${p.property}}` : escText(p.t)))
        .join('');

/** Is a name known: a property of the item (keys: its schema's) or a source? */
export const knownName = (name, { keys, item, sources, items } = {}) =>
  !!(
    keys?.has(name) ||
    (item && name in item) ||
    (name === ITEMS && Array.isArray(items)) ||
    Array.isArray(sources?.[name])
  );

/**
 * A name's value: the item's property, else a source's list; undefined when neither. A name
 * the item's schema has (keys) or the item has is never a source's.
 */
export function propertyValue(name, { item, keys, sources, items } = {}) {
  if (isObject(item) && name in item) return item[name];
  if (keys?.has(name)) return undefined;
  if (name === ITEMS && Array.isArray(items)) return items;
  return Array.isArray(sources?.[name]) ? sources[name] : undefined;
}

/** Empty: missing, null or '' (0, false and [] are values). */
export const isEmpty = (v) => v === undefined || v === null || v === '';

/** A value as text: a list its length, an object nothing. */
export const asText = (v) =>
  Array.isArray(v) ? String(v.length) : isEmpty(v) || typeof v === 'object' ? '' : String(v);

/** A property part's text ('' when empty), in its format. */
export function partText(part, scope) {
  const v = asText(propertyValue(part.property, scope));
  if (v === '') return '';
  return typeof part.format === 'string' ? part.format.replaceAll('{value}', v) : v;
}

/** Is a property part empty (missing, null or '')? */
export const partEmpty = (part, scope) => isEmpty(propertyValue(part.property, scope));
