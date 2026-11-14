/**
 * Hand-made List items (./index.js): config.handmade + config.items. Each item is
 * { title, photo, link, source?, unit }; a pointed source fills the link when it is empty and
 * supplies the Panel count (how many items + unit). The photo is the item's own.
 */
import { pad } from '../../helpers.js';
import { hrefOf, linkProblem } from '../../hrefs.js';
import { isObject } from '../../is.js';
import { sourcePage } from '../data.js';

/** Is this List in Hand-made mode (config.handmade)? */
export const isHandmade = (widget) => widget?.config?.handmade === true;

/** A new hand-made item (Add): empty texts; source left for the editor to pick. */
export const HANDMADE_ITEM = Object.freeze({
  title: '',
  photo: '',
  source: '',
  unit: '',
});

/**
 * One hand-made config item as a List item for presets: title, photo (its own),
 * unit, source id, link (as written), href (own link or the pointed source's page) and count
 * (the pointed source's items, two digits as the Panel shows it: "04"; '' without one). Every key is always there, '' when empty. No
 * source-item id.
 */
export function resolveHandmadeItem(ctx, raw = {}) {
  const title = typeof raw.title === 'string' ? raw.title : '';
  const unit = typeof raw.unit === 'string' ? raw.unit : '';
  const source = typeof raw.source === 'string' ? raw.source : '';
  // its own photo only: nothing is taken from the pointed source's items
  const photo = typeof raw.photo === 'string' ? raw.photo : '';
  let href = '';
  if (raw.link !== undefined && raw.link !== null)
    href = hrefOf(ctx, raw.link, 'a List item') || '';
  if (!href && source) href = sourcePage(ctx, source) || '';
  // every key, even empty: a part's {unit} / {count} never falls through to a same-named
  // property of an outer scope (the page's item, its sources)
  const link = isObject(raw.link) || typeof raw.link === 'string' ? raw.link : '';
  const count =
    source && Array.isArray(ctx?.sources?.[source]) ? pad(ctx.sources[source].length) : '';
  return { title, photo, link, href, unit, source, count };
}

/** config.items resolved for render and {items}. */
export const handmadeItemsOf = (ctx, widget) =>
  (Array.isArray(widget?.config?.items) ? widget.config.items : []).map((it) =>
    resolveHandmadeItem(ctx, it),
  );

/**
 * What's wrong with one hand-made item (null when fine). `where` prefixes messages
 * (e.g. config.items.0).
 */
export function handmadeItemProblem(it, where = 'item') {
  if (!isObject(it)) return `${where} must be an object`;
  for (const k of ['title', 'photo', 'unit', 'source'])
    if (it[k] !== undefined && typeof it[k] !== 'string') return `${where}.${k} must be a text`;
  if (it.link !== undefined && it.link !== null) {
    const p = linkProblem(it.link);
    if (p) return `${where}.link: ${p}`;
  }
  const unknown = Object.keys(it).filter(
    (k) => !['title', 'photo', 'link', 'source', 'unit'].includes(k),
  );
  if (unknown.length) return `${where} has no "${unknown[0]}"`;
  return null;
}
