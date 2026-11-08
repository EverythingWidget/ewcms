/**
 * The template editor's (TemplatePanel.svelte) edits of an item template
 * (content/templates/t-….json, src/site/widgets/list/presets.js): its stack of widgets and
 * the {property} parts in them. Pure: each returns a new value.
 */
import { isObject } from '../../site/is.js';
import { isPropertyPart } from '../../site/layout/parts.js';

/** The widget types a template stacks (no List inside one: nested Lists come later). */
export const STACK_TYPES = [
  ['text', 'Text'],
  ['photo', 'Photo'],
  ['button', 'Button'],
  ['list', 'List'],
  ['sideBySide', 'Side by side'],
];
export const typeLabel = (type) => STACK_TYPES.find(([t]) => t === type)?.[1] || type;

/** A new widget for the stack (Add): its first line, photo or button bound to `property`. */
export function newStackWidget(type, property = 'title', open = 'View', listProperty = 'photos') {
  // an inner List (two levels: src/site/widgets/list/nested.js): the item's list property
  if (type === 'list')
    return {
      type: 'list',
      role: 'list',
      source: { mode: 'property', property: listProperty },
      config: { template: 'preset:card', columns: '4', gap: 's' },
    };
  // Side by side (src/site/widgets/list/side-by-side.js): {number}, then the property filling the space
  if (type === 'sideBySide')
    return {
      type: 'sideBySide',
      config: { align: 'center', spacing: 16, phone: 'wrap' },
      widgets: [
        { type: 'text', body: [{ style: 'label', text: [{ property: 'number' }] }] },
        { type: 'text', grow: true, body: [{ style: 'paragraph', text: [{ property }] }] },
      ],
    };
  if (type === 'photo') return { type: 'photo', src: [{ property }] };
  if (type === 'button') return { type: 'button', label: open, itemLink: true, config: {} };
  return { type: 'text', body: [{ style: 'paragraph', text: [{ property }] }] };
}

/** A widget row's name: "Text · title" (its role), else its type's. */
export const stackName = (w) => [typeLabel(w?.type), w?.role].filter(Boolean).join(' · ');

const walk = (v, fn) =>
  Array.isArray(v)
    ? v.map((x) => walk(x, fn))
    : isPropertyPart(v)
      ? fn(v)
      : isObject(v)
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, fn)]))
        : v;

/** The properties the template's widgets bind ({name} parts), first use first. */
export function templateProperties(widgets) {
  const out = [];
  walk(widgets, (p) => {
    if (!out.includes(p.property)) out.push(p.property);
    return p;
  });
  return out;
}

/** The widgets with every {from} part bound to `to` instead (its format kept). */
export const renameProperty = (widgets, from, to) =>
  !to || from === to
    ? widgets
    : walk(widgets, (p) => (p.property === from ? { ...p, property: to } : p));

/** A text field's value (PartsInput: a string or parts) as a text line's runs. */
export const runsOf = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? [{ t: v }] : []);

/** The widgets with the one at `from` moved to `to`. */
export function moveStack(widgets, from, to) {
  const next = [...widgets];
  const [w] = next.splice(from, 1);
  next.splice(to, 0, w);
  return next;
}

// ---- a line's marks (bold, italic, a link) kept through an edit in a chips box, which shows
// and gives back plain text and chips only
const attrsOf = (run) => {
  const { t: _t, property: _p, format: _f, ...rest } = run; // eslint-disable-line no-unused-vars
  return rest;
};
const tokensOf = (runs) =>
  runs.flatMap((r) =>
    isPropertyPart(r)
      ? [{ key: `\u0000${r.property}\u0000${r.format ?? ''}`, run: r, attrs: attrsOf(r) }]
      : [...String(r.t ?? '')].map((c) => ({ key: c, c, attrs: attrsOf(r) })),
  );
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * `next` (the box's runs, no marks) with the marks `prev` had: what stayed (the unchanged start
 * and end) keeps its own, what was typed takes the marks of the text before it (else after).
 */
export function keepMarks(prev, next) {
  const a = tokensOf(Array.isArray(prev) ? prev : []);
  const b = tokensOf(next);
  let s = 0;
  while (s < a.length && s < b.length && a[s].key === b[s].key) s++;
  let e = 0;
  while (
    e < a.length - s &&
    e < b.length - s &&
    a[a.length - 1 - e].key === b[b.length - 1 - e].key
  )
    e++;
  const near = a[s - 1]?.attrs ?? a[a.length - e]?.attrs ?? {};
  const out = [];
  b.forEach((tok, i) => {
    const attrs =
      i < s ? a[i].attrs : i >= b.length - e ? a[a.length - (b.length - i)].attrs : near;
    if (!tok.c) return out.push({ ...tok.run, ...attrs });
    const z = out.at(-1);
    if (z && 't' in z && same(attrsOf(z), attrs)) z.t += tok.c;
    else out.push({ t: tok.c, ...attrs });
  });
  return out;
}

/** The inner List's "Items from" options (its source's mode; one item of a source shows as A source). */
export const ITEMS_FROM = [
  ['property', 'A property of this item'],
  ['all', 'A source'],
  ['match', 'A source, matched to this item'],
];

/**
 * An inner List's source for a new "Items from" (`mode`), keeping what fits from `prev`:
 * property (the item's first list property), all (a source), match (one rule).
 */
export function innerSourceFor(
  mode,
  prev = {},
  { listProperty = 'photos', source = '', own = 'slug', theirs = '' } = {},
) {
  const from = prev.from || source;
  if (mode === 'property') return { mode, property: prev.property || listProperty };
  if (mode === 'all') return { mode, from };
  return {
    mode: 'match',
    from,
    where: prev.where || { op: 'and', rules: [{ property: theirs || own, parent: own }] },
  };
}
