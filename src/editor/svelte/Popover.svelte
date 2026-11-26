<!--
  The editor's shared floating popover (the Aspect ratios, a Position's grid): portalled to the
  page's top level (document.body), position fixed, so a popup's overflow never clips it.
  Centred on its trigger (anchor) 4px below it, kept 8px inside the editor panel (.ed-panel) when
  its trigger is in it, on every side, and inside the popup (the anchor's [role="dialog"]) left
  and right (it may hang below the popup); always inside the window. Above the trigger when it
  would leave the bottom; neither fits: as far up as it fits from below. Closes (onclose) on a click outside it and its
  trigger, and on Esc; follows its trigger on scroll and resize.
  width: px (190 by default) or 'anchor' (a select's: its trigger's width, at least
  min: 190 by default, more when its content needs it).
  tip: opt in to a tip (about 8 x 4.5px, the popover's surface and ring, no seam) pointing at
  the trigger's centre; the body then sits just under the trigger's icon (its <i>, else the
  trigger), or just over it when it opens above. Off by default: the other popovers are as
  they were.
-->
<script>
  let {
    open = false,
    anchor,
    width = 190,
    min = 190,
    onclose,
    label = '',
    class: cls = '',
    tip = false,
    children,
  } = $props();

  const GAP = 4;
  const EDGE = 8;
  const TIP = 4; // the tip's height over the body's edge (a 6px square turned 45°: ~4.5px)
  let el = $state();
  let pos = $state({ left: 0, top: 0, w: 0, arr: 0, above: false });

  // to the top level: no ancestor's overflow or transform reaches it
  function portal(node) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  function place() {
    if (!anchor || !el) return;
    const a = anchor.getBoundingClientRect();
    const w = width === 'anchor' ? Math.max(a.width, min) : width;
    // the bounds: the window, the panel (all sides), the popup it is in (left and right)
    const box = { left: 0, right: innerWidth, top: 0, bottom: innerHeight };
    const panel = anchor.closest('.ed-panel')?.getBoundingClientRect();
    const popup = anchor.closest('[role="dialog"]')?.getBoundingClientRect();
    for (const r of [panel, popup].filter(Boolean)) {
      box.left = Math.max(box.left, r.left);
      box.right = Math.min(box.right, r.right);
    }
    if (panel) {
      box.top = Math.max(box.top, panel.top);
      box.bottom = Math.min(box.bottom, panel.bottom);
    }
    let left = a.left + a.width / 2 - w / 2;
    left = Math.min(left, box.right - EDGE - w);
    left = Math.max(left, box.left + EDGE);
    // with a tip: just under (over) the trigger's icon, the tip between them
    const r = tip ? (anchor.querySelector('i') ?? anchor).getBoundingClientRect() : a;
    const gap = tip ? 1 + TIP : GAP;
    let top = r.bottom + gap;
    let above = false;
    const h = el.offsetHeight;
    if (top + h > box.bottom - EDGE) {
      above = r.top - gap - h >= box.top + EDGE;
      if (above) top = r.top - gap - h;
      else top = Math.max(box.top + EDGE, box.bottom - EDGE - h);
    }
    // the tip's left edge: centred on the trigger (the tip is 6px wide), kept off the corners
    const arr = Math.min(Math.max(a.left + a.width / 2 - left - 3, 6), w - 12);
    pos = { left: Math.round(left), top: Math.round(top), w, arr: Math.round(arr), above };
  }

  $effect(() => {
    if (!open) return;
    place();
    const away = (e) => {
      if (!el?.contains(e.target) && !anchor?.contains(e.target)) onclose?.();
    };
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); // the popup's own Esc (it closes) waits
      e.stopPropagation();
      onclose?.();
      anchor?.focus?.();
    };
    const follow = () => place();
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc, true);
    addEventListener('scroll', follow, true);
    addEventListener('resize', follow);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc, true);
      removeEventListener('scroll', follow, true);
      removeEventListener('resize', follow);
    };
  });
</script>

{#if open}
  <div
    use:portal
    bind:this={el}
    class={['pov', tip && 'has-tip', tip && pos.above && 'is-above', cls]}
    role="dialog"
    aria-label={label || undefined}
    style:left="{pos.left}px"
    style:top="{pos.top}px"
    style:width="{pos.w}px"
    style:--arr={tip ? `${pos.arr}px` : null}
  >
    {@render children?.()}
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  // a surface (its controls' role colours: _mixins.scss surface(); quiet text at 38%) on
  // --c-surface: a #262626 ring, a deep shadow
  .pov {
    @include surface(var(--c-surface), $quiet: 38%);
    display: flex;
    position: fixed;
    z-index: 2147483000;
    flex-direction: column;
    gap: var(--space-2);
    box-sizing: border-box;
    padding: var(--space-2);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow:
      0 0 0 1px var(--c-popover-ring),
      0 12px 32px var(--c-popover-shadow);
    color: var(--c-text);
  }

  // the tip (tip): a 6px square turned 45° on the top edge (the bottom one when above), on the
  // popover's surface with its ring on the two outer sides; ::after covers the body's ring
  // under it, so tip and body are one shape, no seam (the tip's sizes are the mock's, off the
  // 4px grid on purpose: an 8×4.5 tip)
  /* stylelint-disable local/grid-4px */
  .pov.has-tip::before {
    content: '';
    position: absolute;
    z-index: 1;
    top: -3px;
    left: var(--arr);
    width: 6px;
    height: 6px;
    border-radius: var(--radius-xs) 0 0;
    background: inherit;
    box-shadow: -1px -1px 0 0 var(--c-popover-ring);
    transform: rotate(45deg);
    pointer-events: none;
  }

  .pov.has-tip::after {
    content: '';
    position: absolute;
    z-index: 1;
    top: -1px;
    left: calc(var(--arr) - 2px);
    width: 10px;
    height: 3px;
    background: var(--surface);
    pointer-events: none;
  }

  .pov.has-tip.is-above::before {
    top: auto;
    bottom: -3px;
    box-shadow: 1px 1px 0 0 var(--c-popover-ring);
    border-radius: 0 0 var(--radius-xs);
  }

  .pov.has-tip.is-above::after {
    top: auto;
    bottom: -1px;
  }
  /* stylelint-enable local/grid-4px */

  // its heading (RATIO (WIDTH:HEIGHT), POSITION)
  .pov :global(.pov__head) {
    padding: var(--space-1) var(--space-1) 0;
    color: var(--c-text-soft);
    font-size: var(--fs-2xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }
</style>
