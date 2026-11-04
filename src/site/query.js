/**
 * Which items of a source a widget shows, from the page's address (a widget's From URL source,
 * src/site/layout/source.js; the main widget of a [param] page decides which pages exist,
 * src/site/routes.js). The one query the build, the preview and the editor share.
 *
 *   where   { "op": "and", "rules": [{ "param": "person", "property": "person" }, ...] }
 *           a rule: the item's `property` equals the page's value of `param` (its URL part);
 *           a param without a rule ("Any") doesn't filter. A rule can be a group itself
 *           ({ op: 'and' | 'or', rules }), so more kinds of rules can come later.
 *   params  the page's values: { person: "noor-vermeer", year: "2018" }
 *
 * A property's value is compared as a URL part: "slug" is the item's slug (itemSlug: its schema's
 * slug property, else its name slugified), any other property its value slugified ("2018", "Noor
 * Vermeer" -> "noor-vermeer"). refs: { person: "p-qw7b" } also lets a property that holds the id
 * of the param's item match (a reference to another source's item).
 */
import { itemSlug, slugify } from './helpers.js';

export const SLUG = 'slug';

/** The rules of `where` ([] when there are none). */
export const rulesOf = (where) => (Array.isArray(where?.rules) ? where.rules : []);

/** The rule of `param` in `where` (top level), else undefined: Any. */
export const ruleOf = (where, param) => rulesOf(where).find((r) => r?.param === param);

/** `property` of `item` as a URL part ('' when empty). */
export function valueOf(item, property, schema) {
  if (property === SLUG) return itemSlug(item, schema || {});
  const v = item?.[property];
  return v === undefined || v === null ? '' : slugify(String(v));
}

/** Does `property` exist on items of `schema` ("slug" always does)? */
export const hasProperty = (schema, property) =>
  property === SLUG || (schema?.properties || []).some((f) => f.key === property);

/** A param's default property: the source's property of the same name, else slug. */
export const defaultProperty = (param, schema) =>
  param !== SLUG && hasProperty(schema, param) ? param : SLUG;

/** `where` for the params of an address, each on its default property. */
export const defaultWhere = (params, schema) => ({
  op: 'and',
  rules: params.map((param) => ({ param, property: defaultProperty(param, schema) })),
});

function test(node, item, params, opts) {
  if (Array.isArray(node?.rules)) {
    const each = (r) => test(r, item, params, opts);
    return node.op === 'or' ? node.rules.some(each) : node.rules.every(each);
  }
  if (typeof node?.param !== 'string' || typeof node.property !== 'string') return false;
  const want = params?.[node.param];
  if (want === undefined) return true; // the page has no such param: nothing to match
  if (valueOf(item, node.property, opts.schema) === String(want)) return true;
  const ref = opts.refs?.[node.param];
  return ref !== undefined && ref !== '' && String(item?.[node.property] ?? '') === String(ref);
}

/** Does `item` match `where` for the page's `params`? */
export const matches = (item, where, params, { schema, refs } = {}) =>
  test(where || { rules: [] }, item, params, { schema, refs });

/** The items of `list` that match `where` for `params`, in their order. */
export const query = (list, where, params, opts = {}) =>
  (Array.isArray(list) ? list : []).filter((item) => matches(item, where, params, opts));

/**
 * What keeps a main widget from deciding pages, per param of the address: [{ param, problem }]
 * with problem 'any' (no rule: it would make the same page under many addresses) or 'missing'
 * (its property isn't in the source). [] when every param matches a property.
 */
export const unmatched = (where, params, schema) =>
  params.flatMap((param) => {
    const rule = ruleOf(where, param);
    if (!rule) return [{ param, problem: 'any' }];
    return hasProperty(schema, rule.property)
      ? []
      : [{ param, problem: 'missing', property: rule.property }];
  });
