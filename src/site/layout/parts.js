/**
 * Parts: one way to put an item's fields into any widget value (a Button's label, a Photo's
 * caption, a link, the Text widget's lines: ../text.js).
 *
 *   "label": "Models"                                   its own text (Custom)
 *   "label": [{ "field": "name" }]                      the item's name (any type: a photo, a
 *                                                       link, a list of photos, when it fits)
 *   "label": [{ "field": "count" }, { "t": " photos in " }, { "field": "city" }]
 *                                                       text with fields
 *   { "field": "count", "format": "{value} photos" }    a field with a text around it (an
 *                                                       empty value leaves the part empty)
 *
 * A value is parts when it is a list of { t } and { field } with at least one field (a value
 * of only text is a plain string). Typed, `{name}` is a field and `{{` a literal `{`
 * (parseTyped, typedText).
 *
 * A name is the item's field; a name that isn't one but is a source's id (content/en/sources)
 * is that source's list: `{people}` with no item shows how many people there are. A list
 * shows its length (an empty list "0"). A field the item doesn't have, or has empty, is
 * missing: its part is empty, the rest shows; when every field part of a widget is missing
 * the widget isn't on the site (./index.js; the editor shows it dimmed: "No value for …").
 */
import { isObject } from '../is.js';

const isTextPart = (p) => isObject(p) && typeof p.t === 'string';
export const isFieldPart = (p) => isObject(p) && typeof p.field === 'string';
/** A list of parts with a field in it. */
export const isParts = (v) =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((p) => isTextPart(p) || isFieldPart(p)) &&
  v.some(isFieldPart);
/** A single field, no format: the item's value as a whole (any type). */
export const isWhole = (v) => isParts(v) && v.length === 1 && v[0].format === undefined;

export const NAME = /^[\w-]+$/;

/** Typed text as parts ({name}: a field, {{ a literal {); only text: a string. */
export function parseTyped(s) {
  const out = [];
  const text = (t) => {
    const z = out.at(-1);
    if (isTextPart(z)) z.t += t;
    else if (t) out.push({ t });
  };
  const re = /\{\{|\{([\w-]+)\}/g;
  let at = 0;
  for (const m of String(s ?? '').matchAll(re)) {
    text(s.slice(at, m.index));
    if (m[0] === '{{') text('{');
    else out.push({ field: m[1] });
    at = m.index + m[0].length;
  }
  text(String(s ?? '').slice(at));
  return out.some(isFieldPart) ? out : out.map((p) => p.t).join('');
}

/** Parts (or a string) as typed text: the inverse of parseTyped. */
export const typedText = (v) =>
  typeof v === 'string'
    ? v.replaceAll('{', '{{')
    : (Array.isArray(v) ? v : [])
        .map((p) => (isFieldPart(p) ? `{${p.field}}` : String(p.t ?? '').replaceAll('{', '{{')))
        .join('');

/** Is a name known: a field of the item (keys: its source's fields) or a source? */
export const knownName = (name, { keys, item, sources } = {}) =>
  !!(keys?.has(name) || (item && name in item) || Array.isArray(sources?.[name]));

/** A name's value: the item's field, else a source's list; undefined when neither. */
export function fieldValue(name, { item, sources } = {}) {
  if (isObject(item) && name in item) return item[name];
  return Array.isArray(sources?.[name]) ? sources[name] : undefined;
}

const empty = (v) => v === undefined || v === null || v === '';

/** A value as text: a list its length, an object nothing. */
export const asText = (v) =>
  Array.isArray(v) ? String(v.length) : empty(v) || typeof v === 'object' ? '' : String(v);

/** A field part's text ('' when missing), in its format. */
export function partText(part, scope) {
  const v = asText(fieldValue(part.field, scope));
  if (v === '') return '';
  return typeof part.format === 'string' ? part.format.replaceAll('{value}', v) : v;
}

/** Is a field part missing (nothing to show)? An empty list isn't: it shows "0". */
export const partMissing = (part, scope) => {
  const v = fieldValue(part.field, scope);
  return Array.isArray(v) ? false : asText(v) === '';
};
