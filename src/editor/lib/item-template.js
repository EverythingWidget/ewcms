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
];
export const typeLabel = (type) => STACK_TYPES.find(([t]) => t === type)?.[1] || type;

/** A new widget for the stack (Add): its first line, photo or button bound to `property`. */
export function newStackWidget(type, property = 'title', open = 'View') {
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
