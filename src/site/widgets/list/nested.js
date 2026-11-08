/**
 * Nested Lists (step 10): a List inside an item template, two levels at most. The inner
 * List's "source" takes one of three forms (only inside a template):
 *   { "mode": "property", "property": "photos" }   each entry of a list property of the
 *                     outer item: a photo path → { photo }, a text → { title }, an object as
 *                     it is (each with the List's {number})
 *   { "mode": "match", "from": "shoots", "where": { "op": "and", "rules":
 *       [{ "property": "person", "parent": "slug" }] } }
 *                     another source's items whose property equals the outer item's
 *   { "mode": "all" | "item", "from": … }           a fixed source, as on a page
 * Its widgets reach the outer item with { "property": "title", "of": "parent" } (the chip
 * {parent: title}). The property form is the shape a later top-level "per" can reuse.
 */
import { isObject } from '../../is.js';
import { isTemplateId } from '../../files.js';

export const INNER_MODES = ['property', 'match', 'all', 'item'];
const NAME = /^[\w-]+$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
/** The inner List's items for the outer `item` ({ source: its source name or '', items }). */
export function innerItems(ctx, source, item) {
  const s = isObject(source) ? source : {};
  if (s.mode === 'property') {
    const v = isObject(item) ? item[s.property] : undefined;
    // {number} is the List's own (every item's, ./index.js)
    const items = (Array.isArray(v) ? v : []).map((e) =>
      isObject(e)
        ? e
        : typeof e === 'string' && /\.(jpe?g|png|webp|avif|gif)$/i.test(e)
          ? { photo: e }
          : { title: String(e ?? '') },
    );
    return { source: '', items };
  }
  const list = Array.isArray(ctx?.sources?.[s.from]) ? ctx.sources[s.from] : [];
  if (s.mode === 'all') return { source: s.from, items: list };
  if (s.mode === 'item')
    return { source: s.from, items: list.filter((it) => it?.id === s.id).slice(0, 1) };
  if (s.mode === 'match') {
    const rules = Array.isArray(s.where?.rules) ? s.where.rules : [];
    const hit = (it, r) => {
      const want = item?.[r.parent];
      return (
        want !== undefined &&
        want !== null &&
        want !== '' &&
        String(it?.[r.property] ?? '') === String(want)
      );
    };
    const any = s.where?.op === 'or';
    return {
      source: s.from,
      items: rules.length
        ? list.filter((it) =>
            any ? rules.some((r) => hit(it, r)) : rules.every((r) => hit(it, r)),
          )
        : [],
    };
  }
  return { source: '', items: [] };
}

/** The keys an inner List's items have (for its binds): the property form's, else null. */
export const innerKeys = (source) =>
  source?.mode === 'property' ? new Set(['photo', 'title']) : null;

/** Problems with an inner List's source ([] when fine). */
export function innerSourceProblems(src, at) {
  const shape = `${at}.source must be { "mode": "property", "property" }, { "mode": "match", "from", "where": { "op", "rules": [{ "property", "parent" }] } }, { "mode": "all", "from" } or { "mode": "item", "from", "id" }`;
  if (!isObject(src) || !INNER_MODES.includes(src.mode)) return [shape];
  if (src.mode === 'property')
    return typeof src.property === 'string' &&
      NAME.test(src.property) &&
      Object.keys(src).length === 2
      ? []
      : [shape];
  if (typeof src.from !== 'string' || !SLUG.test(src.from)) return [shape];
  if (src.mode === 'all') return Object.keys(src).length === 2 ? [] : [shape];
  if (src.mode === 'item')
    return typeof src.id === 'string' && Object.keys(src).length === 3 ? [] : [shape];
  const w = src.where;
  const ok =
    isObject(w) &&
    ['and', 'or'].includes(w.op) &&
    Array.isArray(w.rules) &&
    w.rules.length > 0 &&
    w.rules.every(
      (r) =>
        isObject(r) &&
        NAME.test(r.property ?? '') &&
        NAME.test(r.parent ?? '') &&
        Object.keys(r).length === 2,
    );
  return ok ? [] : [shape];
}

/** The templates a template's inner Lists use (their config.template "t-…"). */
export const innerTemplates = (tpl) =>
  (Array.isArray(tpl?.widgets) ? tpl.widgets : [])
    .filter((w) => w?.type === 'list' && isTemplateId(w.config?.template))
    .map((w) => w.config.template);

/** Does a template hold a List? */
export const holdsList = (tpl) =>
  (Array.isArray(tpl?.widgets) ? tpl.widgets : []).some((w) => w?.type === 'list');

const labelOf = (templates, id) => templates?.[id]?.label || id;

/**
 * Across every template (content.templates): loops (a template its inner List leads back to)
 * and a third level (an inner List whose template holds a List). [{ level, message }]
 */
export function nestingProblems(templates = {}) {
  const out = [];
  for (const [id, tpl] of Object.entries(templates || {}))
    for (const inner of innerTemplates(tpl)) {
      // the chain from inner back to id: a loop
      const seen = new Set();
      const leads = (t) => {
        if (t === id) return true;
        if (seen.has(t)) return false;
        seen.add(t);
        return innerTemplates(templates[t]).some(leads);
      };
      if (leads(inner))
        out.push({
          level: 'error',
          message: `templates/${id}.json: This list can't use ${labelOf(templates, inner)}, because ${labelOf(templates, inner)} already contains it.`,
        });
      else if (holdsList(templates[inner]))
        out.push({
          level: 'error',
          message: `templates/${id}.json: A list inside a list's template can't hold another list (two levels at most): ${labelOf(templates, inner)} holds one.`,
        });
    }
  return out;
}

/** Would `inner` in template `id`'s inner List loop ('loop'), go three deep ('deep') or be fine ('')? */
export function innerChoice(templates, id, inner) {
  if (!isTemplateId(inner)) return '';
  if (
    nestingProblems({
      ...templates,
      [id]: { ...templates?.[id], widgets: [{ type: 'list', config: { template: inner } }] },
    }).some(
      (p) => p.message.startsWith(`templates/${id}.json:`) && /already contains it/.test(p.message),
    )
  )
    return 'loop';
  return holdsList(templates?.[inner]) ? 'deep' : '';
}
