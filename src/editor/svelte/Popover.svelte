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
    children,
  } = $props();

  const GAP = 4;
  const EDGE = 8;
  let el = $state();
  let pos = $state({ left: 0, top: 0, w: 0 });

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
    let top = a.bottom + GAP;
    const h = el.offsetHeight;
    if (top + h > box.bottom - EDGE) {
      if (a.top - GAP - h >= box.top + EDGE) top = a.top - GAP - h;
      else top = Math.max(box.top + EDGE, box.bottom - EDGE - h);
    }
    pos = { left: Math.round(left), top: Math.round(top), w };
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
    class={['pov', cls]}
    role="dialog"
    aria-label={label || undefined}
    style:left="{pos.left}px"
    style:top="{pos.top}px"
    style:width="{pos.w}px"
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
