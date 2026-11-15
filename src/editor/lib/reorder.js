/**
 * Reordering a list by drag or Alt+↑/↓ (list-drag.svelte.js gives `to` as the item's place
 * after the move): the Sources modal's items (a source's order is the order every List of it
 * shows) and a List's Custom items (ListLead.svelte, ListField.svelte).
 */

/** A copy of `list` with item `from` moved to place `to` (clamped); the same list when nothing moves. */
export function moveAt(list, from, to) {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const at = Math.max(0, Math.min(to, out.length - 1));
  if (at === from) return out;
  out.splice(at, 0, ...out.splice(from, 1));
  return out;
}

/** Where item `i` is after item `from` moved to `to` (a selection follows its item). */
export function movedIndex(i, from, to) {
  if (i === from) return to;
  if (from < i && to >= i) return i - 1;
  if (from > i && to <= i) return i + 1;
  return i;
}
