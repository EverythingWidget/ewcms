<!--
  A widget's layout on its card (WidgetInspector.svelte), one row: its size (Auto | Rows |
  Aspect, Aspect showing its ratio and opening the ratios under the group; it stays open after a
  pick) and its layer (forward / backward) at the end. (A text widget's Fit: the toolbar,
  WidgetToolbar.svelte.)
-->
<script>
  import { NEW_ROWS, layerWidget, setWidget } from '../layout-ops.js';
  import { ASPECTS, baseOf, linkOf, ratioOf, sizeOf } from '../../site/layout/index.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import { nameOf } from './content-groups.js';
  import { ui } from './ui.svelte.js';
  import Popover from './Popover.svelte';
  import Position from './Position.svelte';
  import { fillOf, placeOfBox, placementOf, placesOf } from '../../site/layout/place.js';

  let { live, bridge, file, at, j, id, widget } = $props();

  const size = $derived(sizeOf(widget));
  const ratio = $derived(widget.aspect || '4:5');
  const set = (patch, key) => setWidget(live.store, file, at, j, patch, key);
  const layer = (dir) => layerWidget(live.store, file, at, j, dir);
  // what it follows (was the widget toolbar's Info; its size and place: the preview's tag)
  const link = $derived(linkOf(widget, ui.viewport === 'mobile'));
  const leader = $derived.by(() => {
    if (!link) return '';
    const widget = (live.get(file, `/sections/${at}`)?.widgets || []).find(
      (w) => w?.id === link.to,
    );
    return widget ? nameOf(widget) || WIDGET_TYPES[widget.type]?.label || widget.id : link.to;
  });

  const phoneView = $derived(ui.viewport === 'mobile');

  // the rows it shows now (the preview's), so a size it is given keeps its height
  function shownRows() {
    const el = bridge.doc?.querySelector(`[data-widget="${CSS.escape(id)}"]`);
    const n = parseInt(el?.style.getPropertyValue('--frs') ?? '', 10);
    // the phone's rows are half the desktop's (its grid's cells are twice as big): Size writes
    // the desktop rows
    if (Number.isInteger(n) && n > 0) return phoneView ? n * 2 : n;
    return baseOf(widget).rows || NEW_ROWS;
  }
  function setSize(next) {
    if (next === 'aspect') open = !open || size !== 'aspect';
    else open = false;
    if (next === size) return;
    set({
      size: next === 'auto' ? undefined : next,
      aspect: next === 'aspect' ? ratio : undefined,
      rows: next === 'auto' ? undefined : shownRows(),
    });
  }

  // the ratios: a Popover under Aspect, open until a click outside or Esc
  let open = $state(false);
  let aspectBtn = $state();
  // its content box (../../site/layout/place.js): Fit | Fill (types with the switch) and its
  // place; under Fill the place dims where it is (an image's still crops: it stays)
  const placement = $derived(placementOf(widget.type));
  const fill = $derived(fillOf(widget));
  const setBox = (box) => box !== (fill ? 'fill' : 'fit') && set({ box });

  let ratioText = $state('');
  const customRatio = $derived(!!widget.aspect && !ASPECTS.includes(widget.aspect));
  function typeRatio(v) {
    ratioText = v;
    if (ratioOf(v)) set({ aspect: v.trim() }, `layout:${file}#/sections/${at}/widgets/${j}/aspect`);
  }
</script>

<!-- layer icons: two stacked squares, the one moved (front / back) filled -->
{#snippet layerIcon(front)}
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    {#if front}
      <rect
        x="1.5"
        y="1.5"
        width="9"
        height="9"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-dasharray="2 1.5"
      />
      <rect x="5.5" y="5.5" width="9" height="9" rx="1.5" fill="currentColor" />
    {:else}
      <rect x="5.5" y="5.5" width="9" height="9" rx="1.5" fill="currentColor" />
      <rect
        x="1.5"
        y="1.5"
        width="9"
        height="9"
        rx="1.5"
        fill="var(--c-card)"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-dasharray="2 1.5"
      />
    {/if}
  </svg>
{/snippet}

<div class="fields wl">
  <div class="wl__row">
    <div class="wl__size">
      <div class="seg" role="radiogroup" aria-label="Size">
        <button
          type="button"
          role="radio"
          aria-checked={size === 'auto'}
          title="Size: as tall as its content"
          class={['seg__btn', size === 'auto' && 'is-active']}
          onclick={() => setSize('auto')}
        >
          <i class="fa-solid fa-up-down wl__ic" aria-hidden="true"></i>
          Auto
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={size === 'rows'}
          title="Size: a fixed number of rows"
          class={['seg__btn', size === 'rows' && 'is-active']}
          onclick={() => setSize('rows')}
        >
          <i class="fa-solid fa-grip-lines wl__ic" aria-hidden="true"></i>
          Rows
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={size === 'aspect'}
          title="Size: its width × a ratio"
          bind:this={aspectBtn}
          class={['seg__btn wl__aspect', size === 'aspect' && 'is-active']}
          onclick={() => setSize('aspect')}
        >
          <i class="fa-solid fa-crop-simple wl__ic" aria-hidden="true"></i>
          {size === 'aspect' ? `Aspect ${ratio}` : 'Aspect none'}
        </button>
      </div>
      <Popover
        open={open && size === 'aspect'}
        anchor={aspectBtn}
        label="Aspect ratio"
        class="wl__pop"
        onclose={() => (open = false)}
      >
        <span class="pov__head">Ratio (width:height)</span>
        <div class="seg wl__ratios" role="radiogroup" aria-label="Aspect ratio">
          {#each ASPECTS as r (r)}
            <button
              type="button"
              role="radio"
              aria-checked={ratio === r}
              class={['seg__btn', ratio === r && 'is-active']}
              onclick={() => set({ aspect: r })}>{r}</button
            >
          {/each}
        </div>
        <label class="wl__line">
          <span class="wl__hint">Custom</span>
          <input
            class="tf__input wl__input"
            placeholder="5:7"
            value={customRatio ? widget.aspect : ratioText}
            aria-label="Custom ratio (width:height)"
            aria-invalid={ratioText !== '' && !ratioOf(ratioText)}
            oninput={(e) => typeRatio(e.currentTarget.value)}
          />
        </label>
      </Popover>
    </div>
    <div class="hset" role="group" aria-label="Layer" title="Layer">
      <button
        type="button"
        class="hset__btn"
        title="Bring forward (])"
        aria-label="Bring forward"
        onclick={() => layer(1)}>{@render layerIcon(true)}</button
      >
      <button
        type="button"
        class="hset__btn"
        title="Send backward ([)"
        aria-label="Send backward"
        onclick={() => layer(-1)}>{@render layerIcon(false)}</button
      >
    </div>
  </div>
  <p class="hint small wl__link">
    {#if link}Follows {leader}, gap {link.gap}{:else}Free (not linked){/if}
  </p>
  {#if placement}
    {#if placement.box}
      <div class="tf is-half">
        <span class="tf__label">Size</span>
        <div class="seg" role="radiogroup" aria-label="Size of its content">
          {#each [['fit', 'Fit'], ['fill', 'Fill']] as [v, text] (v)}
            {@const on = (fill ? 'fill' : 'fit') === v}
            <button
              type="button"
              role="radio"
              aria-checked={on}
              title={v === 'fit' ? 'Fit: as big as its content' : 'Fill: over the whole widget'}
              class={['seg__btn', on && 'is-active']}
              onclick={() => setBox(v)}>{text}</button
            >
          {/each}
        </div>
      </div>
    {/if}
    <div class={['tf', placement.box && 'is-half']}>
      <span class="tf__label">Placement</span>
      <Position
        label="Placement"
        options={placesOf(placement)}
        value={placeOfBox(widget)}
        axes={placement.axes}
        disabled={fill && !placement.media}
        onchange={(place) => set({ place })}
      />
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .wl {
    margin-bottom: var(--space-4);
  }

  // the Layer (i): beside its buttons, centred on them
  .wl__row {
    display: flex;
    grid-column: 1 / -1;
    align-items: center;
    gap: var(--space-3);
  }

  .wl__size {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  // its options: small text, an icon before each; fixed shares, so a pick never moves them
  .wl__size :global(.seg__btn) {
    display: flex;
    flex: 1 1 auto;
    gap: var(--space-1);
    align-items: center;
    justify-content: center;
    padding-inline: var(--space-1);
    font-size: var(--fs-xs);
    white-space: nowrap;
  }

  .wl__size :global(.wl__aspect) {
    width: 40%;
  }

  .wl__ic {
    font-size: var(--fs-xs);
    opacity: 0.8;
  }

  // in the popover (Popover.svelte): three a row
  :global(.wl__pop) .wl__ratios {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }

  .wl__line {
    @include row(var(--space-2));
  }

  .wl__hint {
    flex: none;
    color: var(--c-text-soft);
    font-size: var(--fs-xs);
  }

  .wl__input {
    flex: 1;
    min-width: 0;
    height: 32px;
  }

  // SectionSettings.svelte's .hset
  .hset {
    display: flex;
    flex: none;
    gap: var(--space-1);
    height: var(--size-control);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    background: var(--field-bg); // filled, as .seg (borderless: no ring)
    justify-self: start;
  }

  .hset__btn {
    display: grid;
    flex: 1;
    place-items: center;
    width: 36px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-quiet);
    cursor: pointer;
    transition:
      color 0.2s,
      background 0.2s;

    svg {
      display: block;
    }

    &:hover:not(:disabled) {
      background: var(--field-hover);
      color: var(--text-strong);
    }

    &:disabled {
      opacity: var(--o-disabled);
      cursor: default;
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
</style>
