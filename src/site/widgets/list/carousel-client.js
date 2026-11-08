/**
 * A List's Carousel on the page (./carousel.js has the markup): one slide at a time. The arrows,
 * the thumbnails, swipe and the wheel (one step per gesture) move it; the keys only while focus
 * is in it (← → one slide, Home / End, G the grid with alsoGrid). The counter, the credit, each
 * thumbnail's aria-current and the hidden slides' inert follow. deepLink: "#3" opens slide 3
 * (on load and on a hash change) and moving writes it back. Reduced motion: no fade (CSS).
 */

/** What a key does in a carousel of `n` slides at `at`: a slide index, 'grid', or null. */
export function carouselKey(key, at, n, { alsoGrid = false, mode = 'carousel' } = {}) {
  if (alsoGrid && (key === 'g' || key === 'G')) return 'grid';
  if (mode !== 'carousel') return null;
  if (key === 'ArrowRight') return (at + 1) % n;
  if (key === 'ArrowLeft') return (at - 1 + n) % n;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return null;
}

/** The slide a page hash opens ("#3": 2), or null (not a slide number of `n`). */
export function slideFromHash(hash, n) {
  const m = /^#(\d+)$/.exec(String(hash || ''));
  const i = m ? Number(m[1]) - 1 : -1;
  return i >= 0 && i < n ? i : null;
}

const pad = (n) => String(n).padStart(2, '0');

/** Show slide `i` of carousel `root` (the attributes only: no animation). */
export function showSlide(root, i) {
  const slides = [...root.querySelectorAll(':scope > .car__stage > .car__slide')];
  slides.forEach((s, k) => {
    s.classList.toggle('is-active', k === i);
    s.toggleAttribute('inert', k !== i);
  });
  const thumbs = [...root.querySelectorAll(':scope > .car__bar .car__thumb')];
  thumbs.forEach((t, k) => {
    t.classList.toggle('is-active', k === i);
    if (k === i) t.setAttribute('aria-current', 'true');
    else t.removeAttribute('aria-current');
  });
  const cur = root.querySelector(':scope > .car__bar [data-car-current]');
  if (cur) cur.textContent = pad(i + 1);
  const credit = root.querySelector(':scope > .car__bar [data-car-credit]');
  const s = slides[i];
  if (credit && s) {
    const url = s.dataset.creditUrl || '';
    credit.textContent = s.dataset.credit || '';
    credit.setAttribute('href', url || '#');
    if (url) {
      credit.setAttribute('target', '_blank');
      credit.setAttribute('rel', 'noopener');
      credit.removeAttribute('aria-hidden');
      credit.removeAttribute('tabindex');
    } else {
      credit.removeAttribute('target');
      credit.setAttribute('aria-hidden', 'true');
      credit.setAttribute('tabindex', '-1');
    }
  }
  root.dataset.index = String(i);
}

/** Show the carousel or the grid (both rendered: the other is hidden). */
export function showView(root, mode) {
  const grid = root.querySelector(':scope > [data-car-grid]');
  if (!grid) return;
  root.dataset.view = mode;
  grid.hidden = mode !== 'grid';
  root.querySelector(':scope > .car__stage').hidden = mode === 'grid';
  for (const b of root.querySelectorAll(':scope > .car__bar [data-car-view]')) {
    const on = b.dataset.carView === mode;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  }
}

export function carouselClient(root) {
  const n = Number(root.dataset.count) || 0;
  if (!n) return () => {};
  const alsoGrid = !!root.querySelector(':scope > [data-car-grid]');
  const deep = root.hasAttribute('data-deep-link');
  const off = [];
  const on = (el, ev, fn, opts) => {
    if (!el) return;
    el.addEventListener(ev, fn, opts);
    off.push(() => el.removeEventListener(ev, fn, opts));
  };
  let at = 0;
  const go = (i, { write = true } = {}) => {
    at = ((i % n) + n) % n;
    showSlide(root, at);
    // warm the neighbours
    for (const k of [at - 1, at + 1]) {
      const im = root.querySelector(`:scope > .car__stage > [data-slide="${(k + n) % n}"] img`);
      if (im) im.loading = 'eager';
    }
    const t = root.querySelector(`:scope > .car__bar .car__thumb[data-goto="${at}"]`);
    const strip = t?.closest('.car__thumbs');
    if (strip && strip.scrollWidth > strip.clientWidth)
      strip.scrollTo({
        left: t.parentElement.offsetLeft - strip.clientWidth / 2 + t.offsetWidth / 2,
      });
    if (deep && write)
      history.replaceState(
        history.state,
        '',
        at === 0 ? location.pathname + location.search : `#${at + 1}`,
      );
  };
  const mode = () => root.dataset.view || 'carousel';
  on(root.querySelector(':scope > .car__stage > [data-car-prev]'), 'click', () => go(at - 1));
  on(root.querySelector(':scope > .car__stage > [data-car-next]'), 'click', () => go(at + 1));
  for (const b of root.querySelectorAll(':scope > .car__bar .car__thumb'))
    on(b, 'click', () => go(Number(b.dataset.goto)));
  for (const b of root.querySelectorAll(':scope > .car__bar [data-car-view]'))
    on(b, 'click', () => showView(root, b.dataset.carView));
  on(root, 'keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, [contenteditable]')) return;
    // the carousel's own, not a carousel inside one of its slides
    if (e.target.closest?.('[data-carousel]') !== root) return;
    const what = carouselKey(e.key, at, n, { alsoGrid, mode: mode() });
    if (what === null) return;
    e.preventDefault();
    if (what === 'grid') showView(root, mode() === 'grid' ? 'carousel' : 'grid');
    else go(what);
  });
  // swipe
  const stage = root.querySelector(':scope > .car__stage');
  let x0 = null;
  on(stage, 'pointerdown', (e) => (x0 = e.clientX));
  on(stage, 'pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) go(at + (dx < 0 ? 1 : -1));
  });
  // wheel: one step per gesture (sideways only, so the page still scrolls)
  let locked = false;
  on(
    stage,
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 40) return;
      e.preventDefault();
      if (locked) return;
      locked = true;
      setTimeout(() => (locked = false), 900);
      go(at + (e.deltaX > 0 ? 1 : -1));
    },
    { passive: false },
  );
  if (deep) {
    const fromHash = () => {
      const i = slideFromHash(location.hash, n);
      if (i !== null) {
        showView(root, 'carousel');
        go(i, { write: false });
      }
    };
    fromHash();
    on(window, 'hashchange', fromHash);
    on(window, 'router:hash', fromHash);
  }
  return () => off.forEach((f) => f());
}
