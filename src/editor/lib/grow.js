/**
 * The editor's one open / close: 0.25s power2.out (Collapsible.svelte's body; GSAP's power2.out
 * is a cubic ease out, svelte/easing's cubicOut). Reduced motion: none.
 *
 * grow: a Svelte transition for what opens under something by being added (a widget card's
 * motion, a row's animated elements): its height from 0 and back, clipped while it moves, so
 * only its own height animates (what follows moves with it, nothing jumps). Use it on a block of
 * its own (display: flow-root, so a child's margin is inside the height that animates).
 */
import { cubicOut } from 'svelte/easing';

export const OPEN = { duration: 0.25, ease: 'power2.out' };

export function grow(node) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { duration: 0 };
  const h = node.offsetHeight;
  return {
    duration: OPEN.duration * 1000,
    easing: cubicOut,
    css: (t) => `height: ${t * h}px; overflow: hidden;`,
  };
}
