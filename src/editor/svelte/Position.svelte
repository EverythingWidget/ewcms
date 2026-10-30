<!--
  A position picker: a button showing the picked spot (a small 3 x 3 icon, the spot filled, and
  its name) that opens a Popover with the grid; a pick closes it.
  options: [value, label] row by row (9 for axes 'both'; 3 for 'v', top to bottom, or 'h', left
  to right); value / unset (shown when unset); onchange(value); disabled: dimmed in place.
-->
<script>
  import Popover from './Popover.svelte';

  let {
    options,
    value,
    unset,
    axes = 'both',
    label = 'Position',
    id,
    onchange,
    onfocus,
    disabled = false,
  } = $props();

  let open = $state(false);
  let btn = $state();
  const cols = $derived(axes === 'v' ? 1 : 3);
  const rows = $derived(axes === 'h' ? 1 : 3);
  const current = $derived(value || unset);
  const at = $derived(
    Math.max(
      0,
      options.findIndex(([v]) => v === current),
    ),
  );
  const name = $derived(options[at]?.[1] ?? '');

  function pick(v) {
    open = false;
    btn?.focus();
    if (v === current) return;
    onfocus?.();
    onchange?.(v);
  }
</script>

<!-- one axis: an alignment icon, a frame with two bars at its top / middle / bottom ('v') or
     left / centre / right ('h'), i the place's index (0, 1, 2) -->
{#snippet bars(i, size)}
  {@const at = [3, 5, 7][i] ?? 5}
  <svg class="pos__bars" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="none" stroke="currentColor" />
    {#if axes === 'h'}
      <rect x={at} y="4" width="2" height="8" rx="1" fill="currentColor" />
      <rect x={at + 4} y="4" width="2" height="8" rx="1" fill="currentColor" />
    {:else}
      <rect x="4" y={at} width="8" height="2" rx="1" fill="currentColor" />
      <rect x="4" y={at + 4} width="8" height="2" rx="1" fill="currentColor" />
    {/if}
  </svg>
{/snippet}

<button
  bind:this={btn}
  {id}
  type="button"
  class={['pos', open && 'is-open']}
  aria-haspopup="dialog"
  aria-expanded={open}
  {disabled}
  aria-label="{label}: {name}"
  onclick={() => (open = !open)}
>
  {#if axes === 'both'}
    <span class="pos__icon" style:--cols={cols} aria-hidden="true">
      {#each options as [v], i (v)}<i class={['pos__px', i === at && 'is-on']}></i>{/each}
    </span>
  {:else}
    {@render bars(at, 12)}
  {/if}
  <span class="pos__name">{name}</span>
  <i class="fa-solid fa-chevron-down pos__caret" aria-hidden="true"></i>
</button>

<Popover {open} anchor={btn} {label} onclose={() => (open = false)}>
  <span class="pov__head">{label}</span>
  <div
    class="pos__grid"
    style:--cols={cols}
    style:--rows={rows}
    role="radiogroup"
    aria-label={label}
  >
    {#each options as [v, text] (v)}
      {@const on = current === v}
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={text}
        title={text}
        class={['pos__cell', on && 'is-active']}
        onclick={() => pick(v)}
        >{#if axes === 'both'}<i class="pos__dot"></i>{:else}{@render bars(
            options.findIndex(([o]) => o === v),
            16,
          )}{/if}</button
      >
    {/each}
  </div>
</Popover>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the trigger: a control like a Select's button
  .pos {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    width: 100%;
    height: var(--size-control);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--field-bg);
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--field-hover);
    }

    // dimmed where it is (a Fill content box has no place)
    &:disabled {
      opacity: var(--o-disabled);
      cursor: default;
    }

    &:focus-visible {
      @include focus-ring;
    }

    &.is-open .pos__caret {
      rotate: 180deg;
    }
  }

  .pos__icon {
    display: grid;
    flex: none;
    grid-template-columns: repeat(var(--cols), 4px);
    gap: 1px;
  }

  .pos__px {
    width: 4px;
    height: 4px;
    border-radius: 1px;
    background: color-mix(in srgb, var(--white) 38%, var(--field-bg));

    &.is-on {
      background: var(--c-text);
    }
  }

  .pos__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pos__caret {
    font-size: var(--fs-2xs);
    transition: rotate 0.2s;
  }

  // the grid: joined 32px cells, centred in the popover; a dot in each, the picked cell light
  // with a black dot
  .pos__grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 32px);
    grid-auto-rows: 32px;
    place-self: center;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--field-bg);
  }

  .pos__cell {
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-quiet);
    cursor: pointer;

    &:hover:not(.is-active) {
      background: var(--field-tile);
      color: var(--text-strong);
    }

    &.is-active {
      background: var(--selected-bg);
      color: var(--selected-fg);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .pos__bars {
    display: block;
    flex: none;
  }

  .pos__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentcolor;
  }
</style>
