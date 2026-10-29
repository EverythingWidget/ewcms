<!--
  A section's settings in a floating pop-up over the editor, a copy of the widget's
  (WidgetPopup.svelte): one settings pop-up at a time (opening a widget's closes this one and
  the other way round: ui.section / ui.widget). Opened by a section card's double click
  (SectionsList.svelte) or the toolbar's gear (SectionToolbar.svelte). It sits 12px left of the
  panel level with the section's card, 380px wide, dragged by its header (that place kept for
  the session, shared with the widget's: widget-popup.js). × or Esc closes it; it goes when
  the section does.
  Header: the rows icon, the section's name ("Section N" without one), Locate, ×. Then its
  fields (SectionSettings.svelte: Name, Height, Width), no tabs. Grey: --c-card, its head
  #343433, fields #313131, quiet text #6f6f6f.
    live, bridge, file, id (the section's), popup (createPopup()), onclose
-->
<script>
  import { tick } from 'svelte';
  import SectionSettings from './SectionSettings.svelte';
  import { locate } from '../locate.js';
  import { clampPos } from '../widget-popup.js';

  let { live, bridge, file, id, popup, onclose } = $props();

  // a fresh copy after every edit (SectionSettings reads the values from it), found by its id
  const sections = $derived.by(() => {
    live.version;
    const list = live.current(file)?.sections;
    return Array.isArray(list) ? list : [];
  });
  const at = $derived(sections.findIndex((s) => s?.id === id));
  const title = $derived.by(() => {
    const n = sections[at]?.name;
    return (typeof n === 'string' && n.trim()) || `Section ${at + 1}`;
  });

  let el = $state();
  let pos = $state({ left: -9999, top: 0 });
  let dragging = $state(false);

  const cardOf = (id) => document.querySelector(`.sec[data-section="${CSS.escape(id)}"]`);
  const win = () => ({ vw: innerWidth, vh: innerHeight, h: el?.offsetHeight || 0 });

  // placed on open and on a swap (the card's place, or the dragged one)
  $effect(() => {
    const now = id;
    tick().then(() => {
      if (now !== id) return;
      const panel = document.querySelector('.ed-panel')?.getBoundingClientRect();
      const row = cardOf(now)?.getBoundingClientRect();
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
    const card = cardOf(id);
    onclose();
    card?.focus?.();
  }
  // Esc: its own (the editor's Esc skips the pop-up, App.svelte)
  function onkeydown(e) {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.stopPropagation();
    close();
  }
  // (moved to the body: fixed over the preview whatever the panel's transforms)
  const portal = (node) => {
    document.body.append(node);
    return () => node.remove();
  };
</script>

{#if at >= 0}
  <div
    class={['wpop', 'spop', dragging && 'is-dragging']}
    role="dialog"
    aria-label="{title} settings"
    tabindex="-1"
    style:left="{pos.left}px"
    style:top="{pos.top}px"
    bind:this={el}
    {onkeydown}
    {@attach portal}
  >
    <header
      class="spop__head"
      role="presentation"
      onpointerdown={grab}
      onpointermove={move}
      onpointerup={drop}
      onpointercancel={drop}
    >
      <i class="fa-solid fa-grip-lines spop__icon" title="Section" aria-hidden="true"></i>
      <span class="spop__name">{title}</span>
      <button
        type="button"
        class="spop__btn"
        aria-label="Show it in the preview"
        title="Show in preview"
        onclick={() => locate(bridge, id)}><i class="fa-solid fa-location-crosshairs"></i></button
      >
      <button type="button" class="spop__btn" aria-label="Close" title="Close (Esc)" onclick={close}
        ><i class="fa-solid fa-xmark"></i></button
      >
    </header>
    <div class="spop__body">
      <SectionSettings {live} {bridge} {file} {at} {sections} />
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  // grey: a surface (the section cards' --c-card, its header a touch lighter; its controls'
  // role colours: _mixins.scss surface())
  .spop {
    @include surface(var(--c-card), color-mix(in srgb, var(--white) 9%, var(--c-card)));
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
  .spop__head {
    @include row(var(--space-2));
    flex: none;
    height: 48px;
    padding: 0 var(--space-2) 0 var(--space-3);
    background: var(--surface-head);
    cursor: move;
    touch-action: none;
    user-select: none;
  }

  .is-dragging .spop__head {
    cursor: grabbing;
  }

  .spop__icon {
    flex: none;
    width: 16px;
    color: var(--text-quiet);
    text-align: center;
  }

  .spop__name {
    @include ellipsis;
    flex: 1;
    min-width: 0;
    color: var(--c-text);
  }

  .spop__btn {
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

  .spop__body {
    flex: 1;
    min-height: 0;
    padding: var(--space-3);
    overflow: auto;
    overscroll-behavior: contain;
  }
</style>
