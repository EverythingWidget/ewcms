/**
 * The editor's one sideways slide (the pages list's levels, the pages list and a page's or
 * template's view): 0.35s power2.out, the width of what slides; reduced motion: none.
 *
 * Swapping a view for another (a pages list level for the next, the list for a page):
 *   const play = swapView(host, box);   // before the old view goes: one copy of `box`
 *   …the new view renders…
 *   play(dir);   // dir 1: the new comes in from the right (going in), -1: back
 * `box` (the host itself by default) is copied whole, as one block, padding and all: one old
 * copy and one new copy slide, nothing else. They sit in clipping layers that stay put over
 * the host (ContentPanel's `.ed-view`: its edge is the panel's), so a transformed scroll
 * container never paints past it. The layers keep the larger of the host's size before and
 * after the swap, so a view that gets shorter doesn't crop the one sliding out. The live host
 * stays in place, hidden, until the slide ends; when the live view changed during the slide
 * (it loaded, say), the new copy fades into it over the last FADE seconds instead of swapping
 * at once. A new swap in the same host ends a running one at once.
 */
import { gsap } from 'gsap';

export const SLIDE = { duration: 0.35, ease: 'power2.out' };
export const FADE = 0.08; // the copy → live view crossfade, at the slide's end

export const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const running = new WeakMap(); // host → end the slide in it now

// what `box` shows (its content, not the slide's own layers in it)
const shows = (box) =>
  [...box.childNodes]
    .filter((n) => !(n.dataset && 'slide' in n.dataset))
    .map((n) => n.outerHTML ?? n.textContent)
    .join('');

// one still copy of `box` in a clipping layer over `host`
function layer(host, box) {
  const el = document.createElement('div');
  el.dataset.slide = '';
  el.inert = true;
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    overflow: 'clip',
    pointerEvents: 'none',
    visibility: 'visible', // over the hidden live host
  });
  const h = host.getBoundingClientRect();
  const r = box.getBoundingClientRect();
  const html = shows(box); // to tell whether the live view changed since
  const scroll = box.scrollTop;
  const copy = box.cloneNode(true);
  for (const n of [copy, ...copy.querySelectorAll('[id]')]) n.removeAttribute('id');
  // a modal is never part of a view (they are mounted in App.svelte); a guard all the same
  for (const d of copy.querySelectorAll('dialog')) d.remove();
  const left = r.left - h.left - host.clientLeft + host.scrollLeft;
  Object.assign(copy.style, {
    position: 'absolute',
    margin: '0',
    boxSizing: 'border-box',
    overflow: 'hidden', // not clip: the copy keeps its scroll position
    visibility: '',
    left: `${left}px`,
    top: `${r.top - h.top - host.clientTop + host.scrollTop}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
  el.append(copy);
  return {
    el,
    size: (w, ht) => Object.assign(el.style, { width: `${w}px`, height: `${ht}px` }),
    applyScroll: () => void (scroll && (copy.scrollTop = scroll)),
    slide: (from, to, tl) => tl.fromTo(copy, { left: left + from }, { left: left + to }, 0),
    changed: () => !box.isConnected || shows(box) !== html,
  };
}

export function swapView(host, box = host) {
  running.get(host)?.();
  if (!host || !box || still()) return () => {};
  const before = { w: host.clientWidth, h: host.clientHeight };
  const out = layer(host, box);
  out.el.style.zIndex = '4';
  return (dir = 1) => {
    if (!box.isConnected) return;
    const prevPosition = host.style.position;
    const prevVisibility = host.style.visibility;
    const inn = layer(host, box);
    inn.el.style.zIndex = '3';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const w = Math.max(before.w, host.clientWidth);
    const h = Math.max(before.h, host.clientHeight);
    out.size(w, h);
    inn.size(w, h);
    host.style.visibility = 'hidden'; // the live view, and whatever renders in it meanwhile
    host.append(out.el, inn.el);
    out.applyScroll();
    inn.applyScroll();
    const tl = gsap.timeline({ defaults: { ...SLIDE, force3D: false }, onComplete: () => end() });
    out.slide(0, -dir * w, tl);
    inn.slide(dir * w, 0, tl);
    // the live view changed while it slid: show it under the copy and fade the copy away
    tl.call(
      () => {
        if (!inn.changed()) return;
        host.style.visibility = prevVisibility;
        tl.to(inn.el, { opacity: 0, duration: FADE, ease: 'none' }, SLIDE.duration - FADE);
      },
      [],
      SLIDE.duration - FADE,
    );
    function end() {
      tl.kill();
      out.el.remove();
      inn.el.remove();
      host.style.visibility = prevVisibility;
      host.style.position = prevPosition;
      running.delete(host);
    }
    running.set(host, end);
  };
}
