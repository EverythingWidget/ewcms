/**
 * The widget toolbar's distance from its widget's edge (WidgetToolbar.svelte), px: 8, or 24 when
 * the bar (from x, w wide) is across the widget's link circles (overlay.js: centred on the
 * widget, 12px outside its top and bottom edges, 12px wide), so the bar never covers them.
 */
export const CIRCLE_CLEAR = 24;
export function circleGap(x, w, box) {
  const mid = box.x + box.w / 2;
  return x - 6 < mid + 6 && x + w + 6 > mid - 6 ? CIRCLE_CLEAR : 8;
}
