/**
 * Hand-made List items (./index.js): config.hand + config.items. Each item is
 * { title, photo, link, source?, unit }; a pointed source fills photo and link when those
 * are empty, and supplies the Panel count ({people} + unit).
 */
import { coverOf } from '../../helpers.js';
import { hrefOf, linkProblem } from '../../hrefs.js';
import { isObject } from '../../is.js';
import { sourcePage } from '../data.js';

/** Is this List in hand-made mode (config.hand)? */
export const isHandList = (widget) => widget?.config?.hand === true;

/** A new hand-made item (Add): empty texts; source left for the editor to pick. */
export const HAND_ITEM = Object.freeze({
  title: '',
  photo: '',
  source: '',
  unit: '',
});

/**
 * The first cover photo among a source's items (Photo panels: list.map(coverOf).find).
 * '' when the source is missing or has no covers.
 */
export function sourceCover(ctx, source) {
  const list = Array.isArray(ctx?.sources?.[source]) ? ctx.sources[source] : [];
  return list.map(coverOf).find(Boolean) || '';
}

/**
 * One hand-made config item as a List item for presets: title, photo (own or source cover),
 * unit, source id, and href (own link or the pointed source's page). No source-item id.
 */
export function resolveHandItem(ctx, raw = {}) {
  const title = typeof raw.title === 'string' ? raw.title : '';
  const unit = typeof raw.unit === 'string' ? raw.unit : '';
  const source = typeof raw.source === 'string' ? raw.source : '';
  const photo =
    typeof raw.photo === 'string' && raw.photo ? raw.photo : source ? sourceCover(ctx, source) : '';
  let href = '';
  if (raw.link !== undefined && raw.link !== null) href = hrefOf(ctx, raw.link, 'a List item') || '';
  if (!href && source) href = sourcePage(ctx, source) || '';
  return { title, photo, unit, source, href };
}

/** config.items resolved for render and {items}. */
export const handItemsOf = (ctx, widget) =>
  (Array.isArray(widget?.config?.items) ? widget.config.items : []).map((it) =>
    resolveHandItem(ctx, it),
  );

/**
 * What's wrong with one hand-made item (null when fine). `where` prefixes messages
 * (e.g. config.items.0).
 */
export function handItemProblem(it, where = 'item') {
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
