<!--
  A widget's layout on its card (WidgetInspector.svelte), one row: its size (Auto | Rows |
  Aspect, Aspect showing its ratio and opening the ratios under the group; it stays open after a
  pick) and its layer (forward / backward) at the end. (A text widget's Fit: the toolbar,
  WidgetToolbar.svelte.)
-->
<script>
  import Field from './Field.svelte';
  import InfoHelp from './InfoHelp.svelte';
  import { NEW_ROWS, layerWidget, setColumns, setGap, setWidget } from '../layout-ops.js';
  import {
    ASPECTS,
    COLS,
    MCOLS,
    baseOf,
    linkOf,
    phoneAreaOf,
    placeOf,
    ratioOf,
    sizeOf,
  } from '../../site/layout/index.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import { nameOf } from './content-groups.js';
  import { ui } from './ui.svelte.js';

  let { live, bridge, file, at, j, id, widget } = $props();

  const size = $derived(sizeOf(widget));
  const ratio = $derived(widget.aspect || '4:5');
  const set = (patch, key) => setWidget(live.store, file, at, j, patch, key);
  const layer = (dir) => layerWidget(live.store, file, at, j, dir);
  // what it follows (was the widget toolbar's Info; its size and place: the preview's tag)
  const link = $derived(linkOf(widget, ui.viewport === 'mobile'));
  const leader = $derived.by(() => {
    if (!link) return '';
    const b = (live.get(file, `/sections/${at}`)?.widgets || []).find((w) => w?.id === link.to);
    return b ? nameOf(b) || WIDGET_TYPES[b.type]?.label || b.id : link.to;
  });

  // its left column and width (columns), typed: the same grid fields its handles write
  const phoneView = $derived(ui.viewport === 'mobile');
  const area = $derived(phoneView ? phoneAreaOf(widget) : placeOf(baseOf(widget)));
  const cols = $derived(phoneView ? MCOLS : COLS);
  const setCols = (patch, k) =>
    setColumns(live.store, file, at, j, patch, {
      phone: phoneView,
      key: `layout:${file}#/sections/${at}/widgets/${j}/${phoneView ? 'phone/' : ''}${k}`,
    });

  // its top row (free) or its gap below its leader (following), and a Rows widget's rows
  const setGapTo = (v) =>
    setGap(live.store, file, at, j, v, {
      phone: phoneView,
      leaderRows: rowsShownOf(link?.to),
      key: `layout:${file}#/sections/${at}/widgets/${j}/${phoneView ? 'phone/' : ''}gap`,
    });
  // the rows widget `wid` shows in the preview now (0: not shown)
  function rowsShownOf(wid) {
    const el = wid && bridge.doc?.querySelector(`[data-widget="${CSS.escape(wid)}"]`);
    const n = parseInt(el?.style.getPropertyValue('--frs') ?? '', 10);
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

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

  // the ratios: open until a click outside or Esc
  let open = $state(false);
  let group = $state();
  $effect(() => {
    if (!open) return;
    const away = (e) => {
      if (!group?.contains(e.target)) open = false;
    };
    const esc = (e) => {
      if (e.key === 'Escape') open = false;
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
    };
  });
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
    <div class="wl__size" bind:this={group}>
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
          class={['seg__btn wl__aspect', size === 'aspect' && 'is-active']}
          onclick={() => setSize('aspect')}
        >
          <i class="fa-solid fa-crop-simple wl__ic" aria-hidden="true"></i>
          {size === 'aspect' ? `Aspect ${ratio}` : 'Aspect none'}
        </button>
      </div>
      {#if open && size === 'aspect'}
        <div class="wl__pop">
          <span class="wl__grp">Ratio (width:height)</span>
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
        </div>
      {/if}
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
    <span class="wl__help"
      ><InfoHelp label="About Layer"
        ><b>Layer</b>: which widget is on top where two overlap. Bring forward or send backward
        (keys <b>]</b> and <b>[</b>).</InfoHelp
      ></span
    >
  </div>
  <Field
    edit="{file}#/sections/{at}/widgets/{j}/layout/{phoneView ? 'phone' : 'base'}/span"
    label="Width (columns)"
    type="number"
    half
    value={area.span}
    help={`1–${cols - area.col + 1} (the grid: ${cols})`}
    onvalue={(v) => setCols({ span: v }, 'span')}
  />
  <Field
    edit="{file}#/sections/{at}/widgets/{j}/layout/{phoneView ? 'phone' : 'base'}/col"
    label="Left (column)"
    type="number"
    half
    value={area.col}
    help={`1–${cols}`}
    onvalue={(v) => setCols({ col: v }, 'col')}
  />
  {#if link}
    <Field
      edit="{file}#/sections/{at}/widgets/{j}/layout/{phoneView ? 'phone' : 'base'}/link/gap"
      label="Gap (rows)"
      type="number"
      half
      value={link.gap}
      help={`Below ${leader}; negative overlaps it`}
      onvalue={setGapTo}
    />
  {:else}
    <Field
      edit="{file}#/sections/{at}/widgets/{j}/layout/{phoneView ? 'phone' : 'base'}/row"
      label="Top (row)"
      type="number"
      half
      value={area.row}
      help="1 is the section's top"
      onvalue={(v) => setCols({ row: v }, 'row')}
    />
  {/if}
  {#if size === 'rows'}
    <Field
      edit="{file}#/sections/{at}/widgets/{j}/layout/{phoneView ? 'phone' : 'base'}/rows"
      label="Rows"
      type="number"
      half
      value={area.rows}
      help="Its height, in rows"
      onvalue={(v) => setCols({ rows: v }, 'rows')}
    />
  {/if}
  <p class="hint small wl__link">
    {#if link}Follows {leader}, gap {link.gap}{:else}Free (not linked){/if}
  </p>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .wl {
    margin-bottom: var(--space-4);
  }

  // the Layer (i): beside its buttons, centred on them
  .wl__help {
    display: inline-flex;
    align-items: center;
    margin-left: 0;
  }

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

  // the toolbar's menu (WidgetToolbar.svelte's .btb__pop): 280px, under the group
  .wl__pop {
    @include stack(var(--space-2));
    position: absolute;
    z-index: 5;
    top: calc(100% + var(--space-1));
    left: 0;
    width: 280px;
    padding: var(--space-2);
    border-radius: var(--radius-md);
    background: var(--c-card);
    box-shadow:
      inset 0 0 0 1px var(--c-line),
      0 8px 24px var(--black-a40);
  }

  .wl__grp {
    padding: var(--space-1) var(--space-1) 0;
    color: var(--c-text-soft);
    font-size: var(--fs-2xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .wl__ratios {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
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
    background: var(--c-shadow); // filled, as .seg (borderless: no ring)
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
    color: var(--c-text-muted);
    cursor: pointer;
    transition:
      color 0.2s,
      background 0.2s;

    svg {
      display: block;
    }

    &:hover:not(:disabled) {
      color: var(--c-text);
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
