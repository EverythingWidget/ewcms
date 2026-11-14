/**
 * Where an item template was opened from (a List pop-up's Edit template): the origin stack
 * (ui.originStack), bottom first. Each entry is the place to go back to: the page (or the
 * template, one level down) the List is on, the List selected, its pop-up's tab and the panel
 * and pop-up scroll, the path the preview showed. Back in the template editor pops one
 * (main.js returnToOrigin); a template opened from the Templates list pushes nothing (Back goes
 * to the pages list, as before), and going anywhere else clears it.
 *
 * At most two deep: a page's List opens template A, A's inner List opens template B, and B
 * holds no List (the nested-list rule, src/render/widgets/list/nested.js).
 *
 * The page head's second line is the path back (originCrumbs), never the template's own name,
 * and its title row says how many Lists use the template (listUses, usesLabel).
 */
import { FOOTER, HEADER, pageIdOf, templateIdOf } from '../../render/files.js';

export const MAX_ORIGINS = 2;

/** `stack` with `origin` on top (the oldest dropped past MAX_ORIGINS); a new array. */
export const pushOrigin = (stack, origin) =>
  origin ? [...(stack || []), origin].slice(-MAX_ORIGINS) : [...(stack || [])];

/** The top origin and the stack without it: { origin (null when empty), stack }. */
export const popOrigin = (stack) => {
  const list = stack || [];
  return { origin: list.at(-1) ?? null, stack: list.slice(0, -1) };
};

/**
 * The crumbs of the path back, bottom first ([{ label, at }], at: its index in the stack):
 * a page's title, a template's name (`nameOf(id)`: its current one, else the one kept).
 */
export const originCrumbs = (stack, nameOf = () => '') =>
  (stack || []).map((o, at) => ({
    label:
      (o?.target?.kind === 'item-template' && nameOf(o.target.id)) ||
      o?.title ||
      o?.target?.title ||
      '',
    at,
  }));

/** Back's tooltip: "Back to People" with an origin, else the pages list's. */
export const backLabelOf = (stack, nameOf) => {
  const top = originCrumbs(stack, nameOf).at(-1);
  return top ? `Back to ${top.label}` : 'Back to pages';
};

/** The Lists in `value` (any depth) whose config.template is `id`. */
function countLists(value, id) {
  if (Array.isArray(value)) return value.reduce((n, v) => n + countLists(v, id), 0);
  if (!value || typeof value !== 'object') return 0;
  let n = value.type === 'list' && value.config?.template === id ? 1 : 0;
  for (const v of Object.values(value)) n += countLists(v, id);
  return n;
}

/**
 * How many Lists use template `id` (their config.template): on every page, the header and
 * the footer, and in the item templates (inner Lists). `files`: the store's (file → data).
 */
export function listUses(files, id) {
  if (!id) return 0;
  let n = 0;
  for (const [file, data] of Object.entries(files || {}))
    if (pageIdOf(file) || file === HEADER || file === FOOTER || templateIdOf(file))
      n += countLists(data?.sections, id);
  return n;
}

/** "Used in 1 list", "Used in 0 lists", "Used in 3 lists". */
export const usesLabel = (n) => `Used in ${n} list${n === 1 ? '' : 's'}`;
