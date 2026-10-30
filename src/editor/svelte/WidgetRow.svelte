<!--
  One widget in a section card's list (SectionCard.svelte), in its section's order (the DOM
  order: which paints over which at the same layer; widgets are placed in the preview by their
  grid areas, which a reorder leaves be), on the widgets' card colour (--c-widget-card): its type with its title under it in
  the widgets' accent (--c-widget-accent); its actions are on the panel's toolbar while it is
  selected (SectionToolbar.svelte). A click on the row selects it (its section, onselect); a double click or Enter opens its
  settings in the pop-up (onopen, WidgetPopup.svelte); while open, the row is highlighted (open: a
  full accent ring). Hidden (config.enabled false): its name and title faint.
  Hovered: a 1px inset ring (--c-widget-line-hover); keyboard focus: the cyan focus ring.
    widget      { id, type, title?, config? }
    onopen     () => open its settings (a double click, Enter)
    onselect   (e) => select it (a click; Ctrl/Cmd: toggle, Shift: a range)
    open        its settings are open in the pop-up, or it is one of several selected
                (multi-select.js): highlighted, all alike
    blocked     Ctrl/Cmd held with widgets of another section selected: not clickable
                (dimmed, the not-allowed cursor; multi-select.js)
    ongrab      (e) => its grip's pointerdown (the card's drag, list-drag.svelte.js)
    lifted, dy  it is being dragged: lifted, translated by dy px; drop: the drop line's class
-->
<script>
  import { nameOf } from './content-groups.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';

  let {
    widget,
    onopen,
    onselect,
    open = false,
    blocked = false,
    hot = false,
    onhover,
    ongrab,
    lifted = false,
    dy = 0,
    drop = '',
  } = $props();

  const label = $derived(WIDGET_TYPES[widget?.type]?.label || `Unknown type "${widget?.type}"`);
  const name = $derived(nameOf(widget));
  const on = $derived(widget?.config?.enabled !== false);
</script>

<li
  class={[
    'brow',
    !on && 'is-off',
    open && 'is-open',
    blocked && 'is-blocked',
    hot && 'is-hot',
    lifted && 'is-lifted',
    drop,
  ]}
  style:translate={lifted ? `0 ${dy}px` : null}
  data-row
  data-widget-row={widget?.id}
  onpointerenter={() => onhover?.(true)}
  onpointerleave={() => onhover?.(false)}
>
  <span class="brow__grip" title="Drag to reorder" aria-hidden="true" onpointerdown={ongrab}
    ><i class="fa-solid fa-grip-vertical"></i></span
  >
  <button
    type="button"
    class="brow__open"
    title="Double-click to open {label}"
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={(e) => !blocked && onselect?.(e)}
    ondblclick={(e) => {
      e.stopPropagation();
      if (blocked || e.ctrlKey || e.metaKey || e.shiftKey) return;
      onopen();
    }}
    onkeydown={(e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      onopen();
    }}
  >
    <span>{label}</span>
    {#if name}<span class="brow__name">{name}</span>{/if}
  </button>
</li>

<style lang="scss">
  @use '../styles/mixins' as *;

  // [ grip  Type / its title ]: 48px
  .brow {
    @include row(var(--space-1));
    position: relative;
    min-height: 48px;
    border-radius: var(--radius-md);
    @include surface(var(--c-widget-card), $quiet: 45%);
    background: var(--c-widget-card);

    // hovered: a 1px inset ring in the widgets' accent (nothing moves; focus keeps the cyan ring)
    // (.is-hot: the widget hovered in the preview)
    &:hover,
    &.is-hot {
      box-shadow: inset 0 0 0 1px var(--c-widget-line-hover);
    }

    // its settings open in the pop-up: a full accent ring (stays while the pop-up is open)
    &.is-open {
      box-shadow: inset 0 0 0 1px var(--c-widget-accent);
    }

    // Ctrl/Cmd held, another section's widgets selected: not clickable (nothing moves)
    &.is-blocked {
      opacity: 0.4;
      cursor: not-allowed;

      :global(*) {
        cursor: not-allowed;
      }
    }
  }

  // its text 12px in, two 20px lines, 4px above and below
  .brow__open {
    display: grid;
    flex: 1;
    align-self: stretch;
    min-width: 0;
    padding: var(--space-1) var(--space-2) var(--space-1) 0;
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    line-height: 20px;
    text-align: left;
    align-content: center;
    cursor: pointer;

    span {
      @include ellipsis;
    }

    &:focus-visible {
      @include focus-ring;
    }

    .is-off > & {
      color: var(--c-text-faint);
    }
  }

  // the drag handle: 24px at the row's start (its text right after it)
  .brow__grip {
    display: grid;
    flex: none;
    place-items: center;
    align-self: stretch;
    width: 24px;
    margin-left: var(--space-1);
    color: var(--c-text-faint);
    font-size: var(--fs-sm);
    cursor: grab;
    touch-action: none;

    &:hover {
      color: var(--c-text);
    }

    .is-lifted & {
      cursor: grabbing;
    }
  }

  // lifted while dragged: above the others, following the pointer (translate: nothing reflows)
  .brow.is-lifted {
    z-index: 2;
    box-shadow:
      inset 0 0 0 1px var(--c-widget-line-hover),
      0 12px 28px -12px var(--c-scrim);
  }

  // where it lands: a 2px line centred in the gap (--gap-rows) above or below this row
  .brow.is-drop-before::before,
  .brow.is-drop-after::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    border-top: 2px solid var(--c-accent);
  }

  .brow.is-drop-before::before {
    top: calc(var(--gap-rows) / -2);
  }

  .brow.is-drop-after::after {
    bottom: calc(var(--gap-rows) / -2);
  }

  // the widgets' accent (their card colour's pair: a card's colour says its type)
  .brow__name {
    color: var(--c-widget-accent);

    .is-off & {
      color: var(--c-text-faint);
    }
  }
</style>
