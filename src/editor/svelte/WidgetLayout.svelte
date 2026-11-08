<!--
  A widget's Layout tab (WidgetInspector.svelte): what its type's definition supports
  (layoutParts, ../widget-layout.js), in order: its widget settings marked `tab: 'layout'` (a
  List's Arrangement, Columns, Gap: choices, as the Content tab's); one row of its size (Auto | Rows | Aspect,
  Aspect showing its ratio and opening the ratios under the group; it stays open after a pick)
  and its layer (forward / backward) at the end; what it follows; its content box (a photo's
  Contain | Cover, else Fit | Fill); its placement; Scale to fit (type.js "scale": its whole
  text scales down to fit). Auto height and Scale to fit have a toolbar shortcut too
  (WidgetToolbar.svelte): both write through ../widget-layout.js. A line's Fit width: the
  toolbar.
-->
<script>
  import { NEW_ROWS, layerWidget, setWidget } from '../layout-ops.js';
  import { ASPECTS, linkOf, ratioOf, sizeOf } from '../../site/layout/index.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import { nameOf } from './content-groups.js';
  import { ui } from './ui.svelte.js';
  import Popover from './Popover.svelte';
  import Position from './Position.svelte';
  import { fillOf, placeOfBox, placementOf, placesOf } from '../../site/layout/place.js';
  import { scaledToFit } from '../../site/layout/type.js';
  import Field from './Field.svelte';
  import { CAROUSEL, withArrangement } from '../../site/widgets/list/carousel.js';
  import {
    boxLabels,
    layoutOptions,
    layoutParts,
    scaleHint,
    scalePatch,
    shownRows as rowsShown,
    sizePatch,
  } from '../widget-layout.js';

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
  const shownRows = () => rowsShown(bridge.doc, id, widget, phoneView, NEW_ROWS);
  function setSize(next) {
    if (next === 'aspect') open = !open || size !== 'aspect';
    else open = false;
    if (next === size) return;
    set(sizePatch(next, { rows: shownRows(), ratio }));
  }

  // the ratios: a Popover under Aspect, open until a click outside or Esc
  let open = $state(false);
  let aspectBtn = $state();
  // its content box (../../site/layout/place.js): Fit | Fill (types with the switch) and its
  // place; under Fill the place dims where it is (a photo's still crops: it stays)
  const placement = $derived(placementOf(widget.type));
  const fill = $derived(fillOf(widget));
  const setBox = (box) => box !== (fill ? 'fill' : 'fit') && set({ box });

  // what its type supports (its definition), in the tab's order
  const parts = $derived(layoutParts(widget.type));
  // its widget settings in this tab (a List's arrangement, columns, gap): choices, as in Content
  const options = $derived(layoutOptions(widget.type));
  const optionPtr = (c) => `/sections/${at}/widgets/${j}/config/${c.key}`;
  // a setting's default when the widget leaves it out (a List's carousel ones: carousel.js)
  const listDefault = (c) => (widget.type === 'list' ? CAROUSEL[c.key]?.[0] : undefined);
  const setOption = (c, v) =>
    widget.type === 'list' && c.key === 'arrangement'
      ? live.store.set(
          file,
          optionPtr(c).replace(/\/arrangement$/, ''),
          withArrangement(widget.config, v),
          {
            source: 'panel',
            structure: true,
          },
        )
      : live.store.set(file, optionPtr(c), v, { source: 'panel', structure: true });
  // Scale to fit (off by default): its hint has two lines' room, so nothing moves when it changes
  const isScaled = $derived(scaledToFit(widget));

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

{#snippet layerSet()}
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
{/snippet}

<div class="fields wl">
  {#each parts as part (part)}
    {#if part === 'options'}
      {#each options as c (c.key)}
        <Field
          edit="{file}#{optionPtr(c)}"
          label={c.label}
          type={c.type === 'boolean' ? 'boolean' : 'select'}
          half={c.width === 'half'}
          value={c.type === 'boolean'
            ? (widget.config?.[c.key] ?? listDefault(c)) === true
            : (widget.config?.[c.key] ?? listDefault(c) ?? '')}
          options={c.options ?? []}
          disabled={!!c.disabledWhen?.(widget.config)}
          changed={live.changed(file, optionPtr(c))}
          onvalue={(v) => setOption(c, v)}
        />
      {/each}
    {:else if part === 'size'}
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
        <!-- its layer at the row's end -->
        {#if parts.includes('layer')}{@render layerSet()}{/if}
      </div>
    {:else if part === 'layer'}
      {#if !parts.includes('size')}<div class="wl__row">{@render layerSet()}</div>{/if}
    {:else if part === 'link'}
      <p class="hint small wl__link">
        {#if link}Follows {leader}, gap {link.gap}{:else}Free (not linked){/if}
      </p>
    {:else if part === 'box'}
      <div class="tf is-half">
        <span class="tf__label">Content box</span>
        <div class="seg" role="radiogroup" aria-label="Content box">
          {#each boxLabels(placement) as [v, text, title] (v)}
            {@const on = (fill ? 'fill' : 'fit') === v}
            <button
              type="button"
              role="radio"
              aria-checked={on}
              {title}
              class={['seg__btn', on && 'is-active']}
              onclick={() => setBox(v)}>{text}</button
            >
          {/each}
        </div>
      </div>
    {:else if part === 'placement'}
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
    {:else if part === 'scale'}
      <label class="tf wl__scale">
        <span class="tf__label">
          <span class="wl__scale-label">Scale to fit</span>
          <input
            type="checkbox"
            class="switch"
            role="switch"
            title="Scale the whole text down to fit the widget"
            checked={isScaled}
            onchange={(e) => set(scalePatch(e.currentTarget.checked))}
          />
        </span>
        <span class="hint small wl__scale-hint">{scaleHint(isScaled)}</span>
      </label>
    {/if}
  {/each}
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

  // Scale to fit: the whole row, its name as a field's value (as Main widget), the switch at the end
  .wl__scale {
    grid-column: 1 / -1;
  }

  .wl__scale-label {
    flex: 1;
    color: var(--c-text);
  }

  // two lines' room (the longer hint), so the switch never moves what is under it
  .wl__scale-hint {
    display: block;
    min-height: 32px;
    margin: 0;
    line-height: 16px;
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
