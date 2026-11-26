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
    motion      optional (a page's Sections tab): { animation, elements, expanded, ontoggle,
                onreplay }. The row then shows, after its name, its animation as a quiet tag
                ("none" without one) and Replay, a 32px play button (its room always kept,
                disabled without an animation); before its name a chevron's 16px room, always
                kept, the chevron drawn when it has animated elements (data-anim: elements),
                expanded: open (ontoggle)
    body        optional snippet: the card's body under its 48px row (the widget's motion while
                it is selected, WidgetMotion.svelte); the ring goes round the whole card
    after       optional snippet: under the card (its animated elements, MotionElements.svelte)
                Both open and close as the cards do (lib/grow.js: their height, 0.25s power2.out;
                reduced motion: at once)
-->
<script>
  import Button from './Button.svelte';
  import { nameOf } from './content-groups.js';
  import { grow } from '../lib/grow.js';
  import { widgetType } from '../../widgets/index.js';

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
    motion = null,
    body = undefined,
    after = undefined,
  } = $props();

  const label = $derived(widgetType(widget?.type)?.label || `Unknown type "${widget?.type}"`);
  const name = $derived(nameOf(widget));
  const on = $derived(widget?.config?.enabled !== false);
</script>

<li
  class={['witem', lifted && 'is-lifted', drop]}
  style:translate={lifted ? `0 ${dy}px` : null}
  data-row
  onpointerenter={() => onhover?.(true)}
  onpointerleave={() => onhover?.(false)}
>
  <div
    class={[
      'brow',
      !on && 'is-off',
      open && 'is-open',
      blocked && 'is-blocked',
      hot && 'is-hot',
      lifted && 'is-lifted',
    ]}
    data-widget-row={widget?.id}
  >
    <div class="brow__head">
      <span class="brow__grip" title="Drag to reorder" aria-hidden="true" onpointerdown={ongrab}
        ><i class="fa-solid fa-grip-vertical"></i></span
      >
      {#if motion}
        <span class="brow__disclosure">
          {#if motion.elements}
            <button
              type="button"
              class="brow__toggle"
              aria-expanded={motion.expanded}
              aria-label="Animated elements of {label}"
              title={motion.expanded ? 'Hide its animated elements' : 'Show its animated elements'}
              onclick={motion.ontoggle}
              ><i
                class={['fa-solid fa-chevron-right brow__caret', motion.expanded && 'is-open']}
                aria-hidden="true"
              ></i></button
            >
          {/if}
        </span>
      {/if}
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
      {#if motion}
        <span class="brow__anim">{motion.animation || 'none'}</span>
        <span class="brow__play">
          <Button
            size="small"
            icon="play"
            iconOnly
            label="Replay"
            disabled={!motion.animation}
            onclick={motion.onreplay}
          />
        </span>
      {/if}
    </div>
    {#if body}
      <div class="brow__body" transition:grow>{@render body()}</div>
    {/if}
  </div>
  {#if after}
    <div class="brow__after" transition:grow>{@render after()}</div>
  {/if}
</li>

<style lang="scss">
  @use '../styles/mixins' as *;

  .witem {
    position: relative;
    min-width: 0;
  }

  // the widget's card: its 48px row, and its body under it (its motion, when selected)
  .brow {
    display: flex;
    flex-direction: column;
    min-width: 0;
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

  // the body and the elements: blocks of their own (a child's margin inside their height, which
  // grows and shrinks as they open and close)
  .brow__body,
  .brow__after {
    display: flow-root;
    min-width: 0;
  }

  // [ grip  (chevron)  Type / its title  (animation  Replay) ]: 48px
  .brow__head {
    @include row(var(--space-1));
    position: relative;
    flex: none;
    min-height: 48px;
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

    .is-off & {
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

  // the chevron's room: 16px, kept on every row (rows with and without elements stay aligned)
  .brow__disclosure {
    display: grid;
    flex: none;
    place-items: center;
    align-self: stretch;
    width: 16px;
  }

  // its animated elements shown / hidden (the whole 16px column)
  .brow__toggle {
    display: grid;
    place-items: center;
    width: 16px;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-faint);
    font-size: var(--fs-xs);
    cursor: pointer;

    &:hover {
      color: var(--c-text);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .brow__caret {
    transition: rotate 0.15s;

    &.is-open {
      rotate: 90deg;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  // its animation: a quiet tag ("none" without one)
  .brow__anim {
    flex: none;
    @include muted;
    letter-spacing: 0;
    text-transform: none;
  }

  // Replay: its 32px always kept (disabled without an animation)
  .brow__play {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    margin-right: var(--space-2);
  }

  // lifted while dragged: above the others, following the pointer (translate: nothing reflows)
  .witem.is-lifted {
    z-index: 2;
  }

  .brow.is-lifted {
    box-shadow:
      inset 0 0 0 1px var(--c-widget-line-hover),
      0 12px 28px -12px var(--c-scrim);
  }

  // where it lands: a 2px line centred in the gap (--gap-rows) above or below this row
  .witem.is-drop-before::before,
  .witem.is-drop-after::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    border-top: 2px solid var(--c-accent);
  }

  .witem.is-drop-before::before {
    top: calc(var(--gap-rows) / -2);
  }

  .witem.is-drop-after::after {
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
