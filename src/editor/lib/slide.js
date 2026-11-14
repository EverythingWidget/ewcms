/**
 * The editor's one sideways slide (ContentPanel's Sections panes, the pages list's levels,
 * the pages list and a page's view): 0.35s power2.out, the width of what slides; reduced
 * motion: none.
 *
 * Swapping a view for another (a pages list level for the next, the list for a page):
 *   const play = swapView(host, [old elements]);   // before the old view goes (a copy of it)
 *   …the new view renders…
 *   play([new elements], dir);   // dir 1: the new comes in from the right (going in), -1: back
 * Copies of both views sit in a clipping layer that stays put over the host; only the
 * copies move (their `left`), so a transformed scroll container never paints past the
 * panel edge. The live incoming view stays in place, hidden, until the slide ends.
 * A new swap in the same host ends a running one at once.
 */
import { gsap } from 'gsap';

export const SLIDE = { duration: 0.35, ease: 'power2.out' };

export const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const running = new WeakMap(); // host → end the slide in it now

function layer(host) {
  const el = document.createElement('div');
  el.inert = true;
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'clip',
    pointerEvents: 'none',
  });
  const h = host.getBoundingClientRect();
  const scrolled = [];
  const bases = [];
  function fill(els) {
    for (const src of els) {
      const r = src.getBoundingClientRect();
      const copy = src.cloneNode(true);
      for (const n of [copy, ...copy.querySelectorAll('[id]')]) n.removeAttribute('id');
      const left = r.left - h.left - host.clientLeft + host.scrollLeft;
      Object.assign(copy.style, {
        position: 'absolute',
        margin: '0',
        boxSizing: 'border-box',
        overflow: 'clip',
        containerType: 'normal',
        left: `${left}px`,
        top: `${r.top - h.top - host.clientTop + host.scrollTop}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
      el.append(copy);
      bases.push([copy, left]);
      if (src.scrollTop) scrolled.push([copy, src.scrollTop]);
    }
  }
  const applyScroll = () => {
    for (const [copy, top] of scrolled) copy.scrollTop = top;
  };
  const slide = (fromShift, toShift, at) => {
    for (const [copy, left] of bases)
      at.fromTo(copy, { left: left + fromShift }, { left: left + toShift }, 0);
  };
  return { el, fill, applyScroll, slide };
}

export function swapView(host, els) {
  running.get(host)?.();
  els = els.filter(Boolean);
  if (!host || !els.length || still()) return () => {};
  const out = layer(host);
  out.el.style.zIndex = '4';
  out.fill(els);
  return (next, dir = 1) => {
    next = next.filter(Boolean);
    const prevPosition = host.style.position;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const inn = layer(host);
    inn.el.style.zIndex = '3';
    inn.fill(next);
    for (const el of next) el.style.visibility = 'hidden';
    host.append(out.el, inn.el);
    out.applyScroll();
    inn.applyScroll();
    const w = host.clientWidth;
    const tl = gsap.timeline({ defaults: { ...SLIDE, force3D: false }, onComplete: () => end() });
    out.slide(0, -dir * w, tl);
    inn.slide(dir * w, 0, tl);
    function end() {
      tl.kill();
      out.el.remove();
      inn.el.remove();
      for (const el of next) el.style.visibility = '';
      host.style.position = prevPosition;
      running.delete(host);
    }
    running.set(host, end);
  };
}
