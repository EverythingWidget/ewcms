<!--
  A page's Style tab (ContentPanel.svelte, ui.pageTab 'style'): the page's own palette, its page
  file's "palette" (src/render/colors.js pagePaletteOf: 5 slots, each its own colour or null, the
  site's; left out: all the site's). Five full-width rows, each the hex field with its swatch (the
  native picker), as Theme › Color's Palette (ColorPart.svelte). A slot that follows the site shows
  the site's colour dimmed (bright on hover or focus); one of its own is bright, with the reset
  arrow (back to the site's). The preview takes it at once (../theme-vars.js applyPagePalette, no
  reload); a typed hex is one undo step, a picker drag too (its key).
    live  reactive store; file  the page file
-->
<script>
  import Field from './Field.svelte';
  import { PALETTE_SIZE } from '../../render/colors.js';
  import { THEME } from '../../render/files.js';
  import {
    isHexColor,
    pagePaletteEdit,
    pagePaletteShown,
    paletteShown,
  } from '../lib/color-themes.js';

  let { live, file } = $props();

  const page = () => live.get(file, '') || {};
  const slots = $derived(pagePaletteShown(live.get(THEME, '') || {}, page()));
  const site = $derived(paletteShown(live.get(THEME, '') || {}));
  const SLOTS = Array.from({ length: PALETTE_SIZE }, (_, i) => i + 1);

  // unsaved: the slot differs from the saved one (null and left out are both the site's)
  const ptr = (i) => `/palette/${i}`;
  const unsaved = (i) =>
    (live.get(file, ptr(i)) ?? null) !== (live.store.getBase(file, ptr(i)) ?? null);

  function setSlot(i, hex) {
    const v = pagePaletteEdit(page(), i, hex);
    if (v !== null)
      live.store.set(file, '/palette', v, { key: `color:${file}#/palette/${i}`, source: 'panel' });
  }
</script>

<div class="part">
  <p class="hint">
    This page's 5 colors. They follow the site palette until you set them. A reset arrow marks a
    slot with its own color.
  </p>
  <div class="fields">
    {#each SLOTS as slot, i (slot)}
      <div
        class={['hexf', !slots[i].own && 'is-following']}
        style:--swatch={slots[i].hex}
        onfocusout={(e) => {
          if (e.target.classList?.contains('tf__input')) e.target.value = slots[i].hex;
        }}
      >
        <Field
          edit="{file}#/palette/{i}"
          label="Slot {slot}{slot === 1 ? ' · background end' : ''}"
          value={slots[i].hex}
          unsaved={unsaved(i)}
          reset={{
            on: slots[i].own,
            label: `Slot ${slot}: follow the site palette`,
            title: `Follow the site palette (${site[i]})`,
            run: () => setSlot(i, undefined),
          }}
          onvalue={(v) => isHexColor(v) && setSlot(i, v)}
        />
        <label class="hexf__swatch" title="Pick a color">
          <input
            type="color"
            value={slots[i].hex}
            aria-label="Slot {slot}: pick"
            oninput={(e) => setSlot(i, e.currentTarget.value)}
          />
        </label>
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .part {
    @include stack(var(--space-3));
  }

  .part > .hint {
    margin-bottom: 0;
  }

  // a colour field: the swatch sits in the hex field, at its start (the native picker under it),
  // as Theme › Color's Palette (ColorPart.svelte)
  .hexf {
    position: relative;
    min-width: 0;

    :global(.tf__input) {
      padding-left: calc(var(--space-2) + 20px + var(--space-2));
      font-variant-numeric: tabular-nums;
    }
  }

  // follows the site: greyed, as Theme › Color's following rows, bright on hover or focus; a slot
  // of its own stays bright
  .hexf.is-following :global(.tf__input),
  .hexf.is-following .hexf__swatch {
    opacity: var(--o-disabled);
    transition: opacity 0.2s;
  }

  .hexf.is-following:hover :global(.tf__input),
  .hexf.is-following:hover .hexf__swatch,
  .hexf.is-following:focus-within :global(.tf__input),
  .hexf.is-following:focus-within .hexf__swatch {
    opacity: 1;
  }

  .hexf__swatch {
    position: absolute;
    top: calc(24px + var(--space-2) + (var(--size-control) - 20px) / 2);
    left: calc((var(--size-control) - 20px) / 2);
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
    background: var(--swatch);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--white) 24%, transparent);
    cursor: pointer;
    overflow: hidden;

    input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
  }
</style>
