<!--
  A widget's settings in one floating pop-up over the editor (widget-popup.js): only one ever,
  opening another widget swaps its content. Opened by a widget row's double click or Enter
  (WidgetRow.svelte), or a widget clicked in the preview; the panel keeps the list of sections.
  It sits 12px left of the panel level with the widget's row, 360px wide, scrolling when tall;
  dragged by its header, that place is kept for the session. × or Esc closes it (Esc closes an
  open menu inside first) and the focus goes back to the row.
  Header: the type's icon, the widget's name once (--c-widget-accent), Locate, ×. Then the
  widget's tabs and fields (WidgetInspector.svelte, bare: no Back, no card, no title line).
    g, live, bridge, sourceIds, onsource, onmotion, onlibrary   as WidgetInspector's
    popup     createPopup() (its place)
    onclose   () => close it (ui.widget = null)
-->
<script>
  import { tick } from 'svelte';
  import WidgetInspector from './WidgetInspector.svelte';
  import { locate } from '../locate.js';
  import { clampPos } from '../widget-popup.js';

  let { g, live, bridge, sourceIds, onsource, onmotion, onlibrary, popup, onclose } = $props();

  let el = $state();
  let pos = $state({ left: -9999, top: 0 });
  let dragging = $state(false);

  const rowOf = (id) =>
    document.querySelector(`.brow[data-widget-row="${CSS.escape(id)}"] .brow__open`);
  const win = () => ({ vw: innerWidth, vh: innerHeight, h: el?.offsetHeight || 0 });

  // placed on open and on a swap (the row's place, or the dragged one)
  $effect(() => {
    const id = g.id;
    tick().then(() => {
      if (id !== g.id) return;
      const panel = document.querySelector('.ed-panel')?.getBoundingClientRect();
      const row = rowOf(id)?.closest('.brow')?.getBoundingClientRect();
      pos = popup.place({ panel, row, ...win() });
    });
  });
  $effect(() => {
    const fit = () => (pos = clampPos(pos, win()));
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  });

  // dragged by its header (not its buttons)
  let from = null;
  function grab(e) {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    from = { x: e.clientX - pos.left, y: e.clientY - pos.top };
    dragging = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!from) return;
    pos = clampPos({ left: e.clientX - from.x, top: e.clientY - from.y }, win());
  }
  function drop() {
    if (!from) return;
    from = null;
    dragging = false;
    popup.drag(pos);
  }

  export function close() {
    const row = rowOf(g.id);
    onclose();
    row?.focus();
  }
  // Esc: an open menu inside closes first (its own listener; the editor's Esc skips the
  // pop-up, App.svelte), then the pop-up
  function onkeydown(e) {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (el.querySelector('.wl__pop, [aria-expanded="true"]')) return;
    e.stopPropagation();
    close();
  }
  // (moved to the body: fixed over the preview whatever the panel's transforms)
  const portal = (node) => {
    document.body.append(node);
    return () => node.remove();
  };
</script>

<div
  class={['wpop', dragging && 'is-dragging']}
  role="dialog"
  aria-label="{g.title} settings"
  tabindex="-1"
  style:left="{pos.left}px"
  style:top="{pos.top}px"
  bind:this={el}
  {onkeydown}
  {@attach portal}
>
  <header
    class="wpop__head"
    role="presentation"
    onpointerdown={grab}
    onpointermove={move}
    onpointerup={drop}
    onpointercancel={drop}
  >
    <i class="fa-solid fa-{g.icon} wpop__icon" title={g.title} aria-hidden="true"></i>
    <span class="wpop__name">{g.name || g.title}</span>
    <button
      type="button"
      class="wpop__btn"
      aria-label="Show it in the preview"
      title="Show in preview"
      onclick={() => locate(bridge, g.id)}><i class="fa-solid fa-location-crosshairs"></i></button
    >
    <button type="button" class="wpop__btn" aria-label="Close" title="Close (Esc)" onclick={close}
      ><i class="fa-solid fa-xmark"></i></button
    >
  </header>
  <div class="wpop__body">
    <WidgetInspector
      bare
      {g}
      {live}
      {bridge}
      {sourceIds}
      {onsource}
      onback={close}
      {onmotion}
      {onlibrary}
    />
  </div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // borderless: a surface (the widgets' card colour, its header a touch of the accent; its
  // controls' role colours: _mixins.scss surface()), a layered shadow; over the preview
  .wpop {
    @include surface(
      var(--c-widget-card),
      color-mix(in srgb, var(--c-widget-accent) 9%, var(--c-widget-card))
    );
    position: fixed;
    z-index: 40;
    display: flex;
    flex-direction: column;
    width: 380px;
    max-height: min(600px, calc(100vh - 24px));
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    overflow: hidden;

    &:focus {
      outline: 0;
    }
  }

  // [ icon  name …  locate  × ]: 48px, 12px edges, dragged
  .wpop__head {
    @include row(var(--space-2));
    flex: none;
    height: 48px;
    padding: 0 var(--space-2) 0 var(--space-3);
    background: var(--surface-head);
    cursor: move;
    touch-action: none;
    user-select: none;
  }

  .is-dragging .wpop__head {
    cursor: grabbing;
  }

  .wpop__icon {
    flex: none;
    width: 16px;
    color: var(--text-quiet);
    text-align: center;
  }

  .wpop__name {
    @include ellipsis;
    flex: 1;
    min-width: 0;
    color: var(--c-widget-accent);
  }

  .wpop__btn {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--text-quiet);
    cursor: pointer;
    transition:
      color 0.2s,
      background 0.2s;

    &:hover {
      background: var(--field-hover);
      color: var(--text-strong);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .wpop__body {
    flex: 1;
    min-height: 0;
    padding-bottom: var(--space-3);
    overflow: auto;
    overscroll-behavior: contain;
  }

  // inside it: the controls read the role colours (surface() above); left here, what is the
  // pop-up's own shape: the tabs stay put (48px) while the body scrolls, the layer buttons one
  // joined group (40px each), and the icon buttons on a card (Button.svelte's look) quiet
  .wpop .wpop__body {
    :global(.card__tabs) {
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--surface);
    }

    :global(.tabs__btn) {
      height: 48px;
    }

    :global(.hset) {
      gap: 0;
      padding: 0;
      overflow: hidden;
    }

    :global(.hset__btn) {
      width: 40px;
      height: 100%;
      border-radius: 0;
    }

    // the pen and an image's icons: quiet icon buttons; Change: a tile with white text, no pill
    :global(.sc .btn--icon),
    :global(.image .btn--icon) {
      background: none;
      box-shadow: none;
      color: var(--text-quiet);
    }

    :global(.sc .btn:not(.btn--icon)) {
      background: var(--field-tile);
      box-shadow: none;
      color: var(--text-strong);
    }

    :global(.image .btn--icon:hover:not(:disabled)),
    :global(.sc .btn:hover) {
      background: var(--field-hover);
      color: var(--text-strong);
    }
  }
</style>
