/**
 * Show only (a List from a source, config.showOnly): the items whose `field` is `value`, one
 * condition and nothing more (no and / or, dates, order or first N).
 *
 *   "config": { "showOnly": { "field": "category", "value": "uitstraling" } }
 *
 * Values are compared as text (String(a) === String(b)): a number or choice field matches what
 * was picked; a list value matches when one of its values does. Without it (or half filled in)
 * the List shows every item, as before. Used where the List's items are made
 * (../../layout/source.js widgetItems), so the editor's preview and the build agree.
 */
import { isObject } from '../../is.js';

// the property types a value can be picked from (not photos, long texts or links)
const PICKABLE = ['text', 'number', 'choice', 'boolean', 'reference', 'date'];

/** A List's show only { field, value }, or null (none, or not filled in). */
export function showOnlyOf(widget) {
  const s = widget?.config?.showOnly;
  if (!isObject(s) || typeof s.field !== 'string' || !s.field) return null;
  if (s.value === undefined || s.value === null || s.value === '') return null;
  return { field: s.field, value: String(s.value) };
}

/** Does item `it` have `value` in `field` (as text)? */
const matches = (it, { field, value }) => {
  const v = it?.[field];
  return Array.isArray(v) ? v.some((x) => String(x) === value) : v != null && String(v) === value;
};

/** `items` with the List's show only applied (all of them without one). */
export function showOnlyItems(items, showOnly) {
  return showOnly && Array.isArray(items) ? items.filter((it) => matches(it, showOnly)) : items;
}

/** What's wrong with config.showOnly (null when fine or left out). */
export function showOnlyProblem(s) {
  if (s === undefined) return null;
  if (!isObject(s)) return 'config.showOnly must be { "field": "<property>", "value": "<value>" }';
  const extra = Object.keys(s).filter((k) => k !== 'field' && k !== 'value');
  if (extra.length) return `config.showOnly has no "${extra[0]}" (one field and one value)`;
  if (typeof s.field !== 'string') return 'config.showOnly.field must be a property name';
  if (s.value !== undefined && !['string', 'number', 'boolean'].includes(typeof s.value))
    return 'config.showOnly.value must be a text, number or true / false';
  return null;
}

/**
 * The fields a List can show only by: [{ key, label }] from the source's schema (the kinds with
 * a value to pick), else from the items themselves (their keys with plain values, not id).
 */
export function showOnlyFields(schema, items = []) {
  const props = Array.isArray(schema?.properties) ? schema.properties : null;
  if (props?.length)
    return props
      .filter((p) => typeof p?.key === 'string' && PICKABLE.includes(p.type || 'text'))
      .map((p) => ({ key: p.key, label: p.label || p.key }));
  const keys = [];
  for (const it of Array.isArray(items) ? items : [])
    for (const [k, v] of Object.entries(isObject(it) ? it : {}))
      if (k !== 'id' && !keys.includes(k) && ['string', 'number', 'boolean'].includes(typeof v))
        keys.push(k);
  return keys.map((key) => ({ key, label: key }));
}

/**
 * The values `field` has, as text, to pick from: a choice field's options first (in their
 * order), then the others found in the items (sorted); empty ones left out.
 */
export function showOnlyValues(schema, items, field) {
  const prop = (schema?.properties || []).find((p) => p?.key === field);
  const out = (Array.isArray(prop?.options) ? prop.options : []).map((o) =>
    String(isObject(o) ? o.value : o),
  );
  const found = new Set();
  for (const it of Array.isArray(items) ? items : []) {
    const v = it?.[field];
    for (const x of Array.isArray(v) ? v : [v])
      if (x != null && x !== '' && typeof x !== 'object') found.add(String(x));
  }
  return [...out, ...[...found].filter((v) => !out.includes(v)).sort((a, b) => a.localeCompare(b))];
}
