// Tests: a template's widgets placed on its grid (src/site/widgets/list/item-grid.js), each
// full width below the one before (as Duplicate from a preset does).
import { stackToGrid } from '../src/site/widgets/list/item-grid.js';

/** `widgets` on the template grid: ids "w-g001" … by place, each following the one before. */
export function onGrid(widgets, style) {
  let n = 0;
  return stackToGrid(widgets, style, () => `w-g${String(++n).padStart(3, '0')}`);
}
