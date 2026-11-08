/**
 * The List widget's behaviour on the page (a widget module's client.js: run on every
 * .wgt--list, ../index.js has the format): the arrow keys move between its items' links
 * (Left / Right by one, Up / Down by a column of the grid, Home / End), so a long list is
 * quick to go through by keyboard. Works for every column count (1–6). Items that open
 * (./details.js): a click, Enter or Space on a summary opens or closes it (one open at a time
 * unless data-opens="several"), Esc closes the open one and gives its summary focus back,
 * and "#<slug>" opens that item on load.
 */
import { carouselClient } from './carousel-client.js';

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

/**
 * Open (or close) item `li` of `list`: its data-open, the summary's aria-expanded, the details'
 * inert; one at a time unless the list is data-opens="several".
 */
export function setOpen(list, li, open) {
  if (!li?.hasAttribute('data-opens')) return;
  if (open && list.getAttribute('data-opens') !== 'several')
    for (const o of list.querySelectorAll(':scope > .li[data-open]'))
      if (o !== li) setOpen(list, o, false);
  li.toggleAttribute('data-open', open);
  li.querySelector('.li__summary')?.setAttribute('aria-expanded', String(open));
  li.querySelector('.li__details')?.toggleAttribute('inert', !open);
}

/** What a key on an item that opens does: 'toggle', 'close' or null. */
export function opensKey(key, onSummary, isOpen) {
  if (onSummary && (key === 'Enter' || key === ' ' || key === 'Spacebar')) return 'toggle';
  if (key === 'Escape' && isOpen) return 'close';
  return null;
}

export default function listClient(el) {
  // carousels (./carousel-client.js), an inner List's too
  const cars = [...el.querySelectorAll('[data-carousel]')].map(carouselClient);
  const list = el.querySelector('.list__items');
  if (!list) return cars.length ? () => cars.forEach((f) => f()) : undefined;
  // its items' links, or their summaries (items that open)
  const links = () => [
    ...list.querySelectorAll(':scope > a.li, :scope > .li > .li__opens > .li__summary'),
  ];
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
  const summaryOf = (t) => t?.closest?.('.li__summary');
  const onclick = (e) => {
    const s = summaryOf(e.target);
    if (!s || !list.contains(s)) return;
    const li = s.closest('.li');
    setOpen(list, li, !li.hasAttribute('data-open'));
  };
  const onopenkey = (e) => {
    const li = e.target?.closest?.('.li[data-opens]');
    if (!li || !list.contains(li)) return;
    const s = summaryOf(e.target);
    const what = opensKey(e.key, !!s && e.target === s, li.hasAttribute('data-open'));
    if (!what) return;
    e.preventDefault();
    if (what === 'toggle') setOpen(list, li, !li.hasAttribute('data-open'));
    else {
      setOpen(list, li, false);
      li.querySelector('.li__summary')?.focus();
    }
  };
  if (list.hasAttribute('data-opens')) {
    list.addEventListener('click', onclick);
    list.addEventListener('keydown', onopenkey);
    const slug = decodeURIComponent((globalThis.location?.hash || '').slice(1));
    if (slug)
      for (const li of list.querySelectorAll(':scope > .li[data-slug]'))
        if (li.getAttribute('data-slug') === slug) setOpen(list, li, true);
  }
  list.addEventListener('keydown', onkey);
  return () => {
    cars.forEach((f) => f());
    list.removeEventListener('keydown', onkey);
    list.removeEventListener('click', onclick);
    list.removeEventListener('keydown', onopenkey);
  };
}
