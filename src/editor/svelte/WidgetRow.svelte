<!--
  One widget in a section card's list (SectionCard.svelte), in its section's order (the DOM
  order: which paints over which at the same layer; widgets are placed in the preview by their
  grid areas, which a reorder leaves be), on the widgets' card colour (--c-widget-card): its type with its title under it in
  the widgets' accent (--c-widget-accent), then its eye, Duplicate and
  Delete. A click on the row selects it (its section, onselect); a double click or Enter opens its
  settings in the pop-up (onopen, WidgetPopup.svelte); while open, the row is highlighted (open: a
  full accent ring and its buttons shown). Hidden (config.enabled false): its
  name and title faint, its eye-slash. Delete asks over the row at its size (nothing moves).
  Hovered: a 1px inset ring (--c-widget-line-hover); keyboard focus: the cyan focus ring.
  Its buttons rest at 30% and show fully while the row is hovered or has the focus; an
  eye-slash always (SectionCard.svelte's rule for the card's own buttons).
    widget      { id, type, title?, config? }
    onopen     () => open its settings (a double click, Enter)
    onselect   () => select it (a click)
    open        its settings are open in the pop-up: highlighted
    onshow     (on) => show (true) or hide it
    onduplicate, ondelete
    ongrab      (e) => its grip's pointerdown (the card's drag, list-drag.svelte.js)
    lifted, dy  it is being dragged: lifted, translated by dy px; drop: the drop line's class
-->
<script>
  import Button from './Button.svelte';
  import { nameOf } from './content-groups.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';

  let {
    widget,
    onopen,
    onselect,
    open = false,
    onshow,
    onduplicate,
    ondelete,
    ongrab,
    lifted = false,
    dy = 0,
    drop = '',
  } = $props();
  let asking = $state(false);

  const label = $derived(WIDGET_TYPES[widget?.type]?.label || `Unknown type "${widget?.type}"`);
  const name = $derived(nameOf(widget));
  const on = $derived(widget?.config?.enabled !== false);
  // the confirm's Cancel takes the focus (Enter does not delete by accident)
  const focusCancel = (el) => el.querySelector('.ask-btns > :last-child')?.focus();
</script>

<li
  class={['brow', !on && 'is-off', open && 'is-open', lifted && 'is-lifted', drop]}
  style:translate={lifted ? `0 ${dy}px` : null}
  data-row
  data-widget-row={widget?.id}
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
    onclick={() => onselect?.()}
    ondblclick={(e) => {
      e.stopPropagation();
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
  <Button
    size="small"
    icon={on ? 'eye' : 'eye-slash'}
    iconOnly
    label="Show {label}"
    title={on
      ? `Visible: click to hide ${label}`
      : `Hidden on the public page: click to show ${label}`}
    aria-pressed={on}
    data-eye
    onclick={() => onshow(!on)}
  />
  <Button size="small" icon="copy" iconOnly label="Duplicate {label}" onclick={onduplicate} />
  <Button
    size="small"
    icon="trash"
    iconOnly
    label="Delete {label}"
    onclick={() => (asking = true)}
  />
  {#if asking}
    <div
      class="brow__ask"
      role="alertdialog"
      tabindex="-1"
      aria-label="Delete {label}?"
      {@attach focusCancel}
      onkeydown={(e) => e.key === 'Escape' && (e.stopPropagation(), (asking = false))}
    >
      <span>Delete {label}?</span>
      <span class="ask-btns">
        <Button
          size="small"
          variant="danger"
          icon="trash"
          iconOnly
          label="Delete"
          onclick={() => {
            asking = false;
            ondelete();
          }}
        />
        <Button size="small" onclick={() => (asking = false)}>Cancel</Button>
      </span>
    </div>
  {/if}
</li>

<style lang="scss">
  @use '../styles/mixins' as *;

  // [ Type / its title        eye copy trash ]: 48px; the icons end on its right edge (the
  // card's content edge, as the title row's)
  .brow {
    @include row(var(--space-1));
    position: relative;
    min-height: 48px;
    border-radius: var(--radius-md);
    background: var(--c-widget-card);

    > :global(.btn) {
      flex: none;
      opacity: 0.3;
      transition: opacity 0.15s;
    }

    // hovered: a 1px inset ring in the widgets' accent (nothing moves; focus keeps the cyan ring)
    &:hover {
      box-shadow: inset 0 0 0 1px var(--c-widget-line-hover);
    }

    // its settings open in the pop-up: a full accent ring (stays while the pop-up is open)
    &.is-open {
      box-shadow: inset 0 0 0 1px var(--c-widget-accent);
    }

    &:is(:hover, :focus-within, .is-open) > :global(.btn),
    > :global(.btn:focus-visible),
    > :global(.btn[data-eye][aria-pressed='false']) {
      opacity: 1;
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

  // where it lands: a line in the 4px gap above or below this row
  .brow.is-drop-before::before,
  .brow.is-drop-after::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    border-top: 2px solid var(--c-accent);
  }

  .brow.is-drop-before::before {
    top: -4px;
  }

  .brow.is-drop-after::after {
    bottom: -4px;
  }

  // the widgets' accent (their card colour's pair: a card's colour says its type)
  .brow__name {
    color: var(--c-widget-accent);

    .is-off & {
      color: var(--c-text-faint);
    }
  }

  // Delete?: over the row at its size and corners, one line, 12px in on every side (24px
  // buttons in the 48px row), a red line
  .brow__ask {
    @include row(var(--space-3));
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 0 var(--space-3);
    border-radius: inherit;
    background: var(--c-widget-card);
    box-shadow: inset 0 0 0 1px var(--c-danger);
    font-size: var(--fs-base);

    > span:first-child {
      @include ellipsis;
      flex: 1;
    }
  }
</style>
