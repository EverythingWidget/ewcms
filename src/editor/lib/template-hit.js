/**
 * The template editor's preview: the element a pointer event is on, for the widget and section
 * under it (overlay.js). An item that is a link or a button (a clickable template's <a>, details'
 * summary) takes no pointer in arrange mode (bridge.js: a widget's links and buttons are off, so
 * the page shows no hover, active or focus look and nothing follows), and nor does anything in it:
 * the event lands on the List around the item. Its widget is then found by where the pointer is:
 * the one on top whose box holds it (the highest layer, --z; then the last one), else the item.
 * Anything else (an event inside the item, or not over it): the event's own target.
 */
const inBox = (el, x, y) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};
const layerOf = (el) => parseInt(el.style?.getPropertyValue('--z'), 10) || 0;

/**
 * @param {Element} target the event's target
 * @param {Element|null} sec the template's item (.sec--item), null when no template is open
 * @param {Element[]} widgets the item's own widget elements, in document order
 */
export function templateHit(target, sec, x, y, widgets) {
  // only an event that fell through to the item's List (an element around the item)
  if (!sec || !target?.contains || target === sec || !target.contains(sec) || !inBox(sec, x, y))
    return target;
  let top = null;
  for (const w of widgets)
    if (!w.hidden && inBox(w, x, y) && (!top || layerOf(w) >= layerOf(top))) top = w;
  return top || sec;
}
