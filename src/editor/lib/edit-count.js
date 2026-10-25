/**
 * The edits a content file's change is made of, counted the way its author sees them (the
 * Publish footer's "N changes to publish"; editor-server.mjs contentStatus): not every value
 * that differs, but
 *   - a widget added, removed, moved, resized or restyled: 1 each (a drag changing its column,
 *     row, width and height at once is 1);
 *   - a section added or removed, or its own settings changed: 1 each;
 *   - a page setting (each field of meta: title, description, …; any other top-level key): 1 each;
 *   - any other file (settings, sources, strings): 1 per setting changed (its first two keys).
 * What the editor tidies up by itself doesn't count: the rows it stores for the widgets a drag
 * moved along, a link's gap, the phone places a first phone edit copies from the default
 * stack, the rows a section grows to. A section where only those changed (one widget dragged
 * straight down) counts 1.
 */
import { isObject } from '../../site/is.js';
import { diff, equal } from './diff.js';

const byId = (list) =>
  new Map((Array.isArray(list) ? list : []).filter((x) => x?.id).map((x) => [x.id, x]));

/** A widget's layout without what the editor tidies: its stored row and rows (flow), a link's gap, its phone place. */
function shape(w) {
  const { layout, ...rest } = w || {};
  const base = { ...(layout?.base || {}) };
  delete base.row;
  if (w?.size !== 'rows' && w?.size !== undefined) delete base.rows;
  if (isObject(base.link)) base.link = base.link.to;
  return { ...rest, base };
}
/** Only what a first phone edit copies: a phone place added; else its phone place as edited. */
const phoneOf = (w) => w?.layout?.phone;

/** Edits between two lists of sections. */
function sectionEdits(a = [], b = []) {
  const A = byId(a);
  const B = byId(b);
  let n = 0;
  for (const id of A.keys()) if (!B.has(id)) n++; // removed
  for (const [id, s] of B) {
    const was = A.get(id);
    if (!was) {
      n++; // added
      continue;
    }
    const { widgets: wa = [], ...ra } = was;
    const { widgets: wb = [], ...rb } = s;
    let real = 0;
    let tidy = false;
    const WA = byId(wa);
    const WB = byId(wb);
    for (const wid of WA.keys()) if (!WB.has(wid)) real++;
    for (const [wid, w] of WB) {
      const v = WA.get(wid);
      if (!v) real++;
      else if (!equal(shape(v), shape(w))) real++;
      else if (!equal(v, w)) {
        // its row or rows (a drag, or the flow stored), its gap, its phone place
        const pa = phoneOf(v);
        const pb = phoneOf(w);
        if (pa && pb && !equal({ ...pa, rows: 0, link: 0 }, { ...pb, rows: 0, link: 0 })) real++;
        else tidy = true;
      }
    }
    const order = (l) => l.map((x) => x?.id).filter((x) => WA.has(x) && WB.has(x));
    if (!equal(order(wa), order(wb))) real++; // layered
    const own = (r) => ({
      ...r,
      rows: undefined,
      phone: r.phone && { ...r.phone, rows: undefined },
    });
    if (!equal(own(ra), own(rb))) real++;
    else if (!equal(ra, rb) && !real) tidy = true; // only its rows: 1 if nothing else counts
    n += real || (tidy ? 1 : 0);
  }
  return n;
}

/** The edits that turn `before` into `after` (content file `name`); at least 1 when they differ. */
export function countEdits(before, after, name = '') {
  if (equal(before, after)) return 0;
  if (!isObject(before) || !isObject(after)) return 1;
  let n = 0;
  if (Array.isArray(before.sections) || Array.isArray(after.sections))
    n += sectionEdits(before.sections, after.sections);
  const page = /^pages\//.test(name);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  keys.delete('sections');
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (equal(a, b)) continue;
    if (page && k !== 'meta') n++;
    else if (isObject(a) && isObject(b)) {
      // per setting (meta: per field), its first two keys
      const paths = new Set(diff(a, b).map((op) => op.path[0]));
      n += paths.size;
    } else n++;
  }
  return Math.max(1, n);
}
