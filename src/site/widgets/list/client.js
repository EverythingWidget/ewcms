/**
 * The List widget's behaviour on the page (a widget module's client.js: run on every
 * .wgt--list, ../index.js has the format): the arrow keys move between its items' links
 * (Left / Right by one, Up / Down by a column of the grid, Home / End), so a long list is
 * quick to go through by keyboard. Works for every column count (1–6).
 */

/**
 * The index to move to from `at` for key `key` in a grid of `cols` columns and `length`
 * items (null: ignore the key). Used by the keydown handler and its tests.
 */
export function nextItemIndex(at, key, cols, length) {
  const n = Math.max(1, cols | 0);
  const to =
    key === 'Home'
      ? 0
      : key === 'End'
        ? length - 1
        : key === 'ArrowRight'
          ? at + 1
          : key === 'ArrowLeft'
            ? at - 1
            : key === 'ArrowDown'
              ? at + (n === 1 ? 1 : n)
              : key === 'ArrowUp'
                ? at - (n === 1 ? 1 : n)
                : null;
  return to === null || to < 0 || to >= length ? null : to;
}

export default function listClient(el) {
  const list = el.querySelector('.list__items');
  if (!list) return undefined;
  const links = () => [...list.querySelectorAll(':scope > a.li')];
  const colsOf = () => Math.max(1, Number(list.dataset.cols) || 1);
  const onkey = (e) => {
    const all = links();
    const at = all.indexOf(document.activeElement);
    if (at < 0) return;
    const to = nextItemIndex(at, e.key, colsOf(), all.length);
    if (to === null) return;
    e.preventDefault();
    all[to].focus();
  };
  list.addEventListener('keydown', onkey);
  return () => list.removeEventListener('keydown', onkey);
}
