/**
 * Stable ids of sections ("s-k3x9") and widgets ("w-7qpa"): given once, when a section or
 * widget is made, and kept when it moves or its content changes. The editor finds a section
 * or widget in the preview by its id; later, bindings and animations will point at them too.
 */

/** Is `id` a section (kind 's'), widget ('w') or source item ('p') id? */
export const isId = (id, kind) => new RegExp(`^${kind}-[a-z0-9]{4,12}$`).test(String(id ?? ''));

/** A new id of `kind` ('s', 'w' or 'p') not in `taken` (a Set of ids), then added to it. */
export function newId(kind, taken = new Set()) {
  for (;;) {
    const id = `${kind}-${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`;
    if (taken.has(id)) continue;
    taken.add(id);
    return id;
  }
}

/**
 * Every widget of `sections` (a page's or the footer's), in order, as [widget, section, at, j]
 * (section `at`, its widget `j`); a section without a widgets list has none.
 */
export function* eachWidget(sections) {
  for (const [at, s] of (Array.isArray(sections) ? sections : []).entries())
    if (Array.isArray(s?.widgets))
      for (const [j, widget] of s.widgets.entries()) yield [widget, s, at, j];
}

/** Every widget of a page (its sections' widgets, in order). */
export const widgetsOf = (page) =>
  (Array.isArray(page?.sections) ? page.sections : []).flatMap((s) =>
    Array.isArray(s?.widgets) ? s.widgets : [],
  );

/** Every section and widget id of a page's sections. */
export function idsOf(sections) {
  const ids = new Set();
  for (const s of Array.isArray(sections) ? sections : []) {
    if (s?.id) ids.add(s.id);
    for (const widget of Array.isArray(s?.widgets) ? s.widgets : [])
      if (widget?.id) ids.add(widget.id);
  }
  return ids;
}
