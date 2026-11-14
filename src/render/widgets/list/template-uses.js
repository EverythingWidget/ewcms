/**
 * Which sections of a page (or the footer) show an item template or a source: the editor
 * renders those again in place when the template or the source is edited (src/editor/main.js),
 * instead of reloading the preview.
 *
 * A section uses template X when one of its Lists has config.template X, or a template it uses
 * does (an inner List's template, a details template: any "template" value in it, at any depth).
 * It uses source S when one of its widgets lists or shows S (a "source" with from S, at any
 * depth), or a template it uses does.
 */
import { isTemplateId } from '../../files.js';
import { isObject } from '../../is.js';

/** The template ids and source ids named in `value` (any depth), into the two sets. */
function collect(value, out) {
  if (Array.isArray(value)) for (const v of value) collect(v, out);
  else if (isObject(value))
    for (const [k, v] of Object.entries(value)) {
      if (k === 'template' && isTemplateId(v)) out.templates.add(v);
      else if (k === 'source' && isObject(v) && typeof v.from === 'string' && v.from)
        out.sources.add(v.from);
      collect(v, out);
    }
}

/**
 * The templates and sources `value` uses, those of the templates it uses included
 * (`templates`: id → template data). { templates: Set, sources: Set }
 */
export function usesOf(value, templates = {}) {
  const out = { templates: new Set(), sources: new Set() };
  collect(value, out);
  const queue = [...out.templates];
  while (queue.length) {
    const own = { templates: new Set(), sources: new Set() };
    collect(templates[queue.pop()]?.sections, own);
    for (const s of own.sources) out.sources.add(s);
    for (const t of own.templates) if (!out.templates.has(t)) (out.templates.add(t), queue.push(t));
  }
  return out;
}

/**
 * The ids of `doc`'s sections (a page's or the footer's data) that use any of `templates` or
 * `sources` (ids). `all`: every template, id → its data (for templates used by templates).
 */
export function sectionsUsing(doc, { templates = [], sources = [] } = {}, all = {}) {
  const t = new Set(templates);
  const s = new Set(sources);
  if (!t.size && !s.size) return [];
  return (Array.isArray(doc?.sections) ? doc.sections : [])
    .filter((sec) => {
      const uses = usesOf(sec?.widgets, all);
      return (
        [...uses.templates].some((id) => t.has(id)) || [...uses.sources].some((id) => s.has(id))
      );
    })
    .map((sec) => sec.id)
    .filter((id) => typeof id === 'string');
}
