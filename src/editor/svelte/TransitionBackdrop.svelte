<!--
  The page's backdrop (src/site/backdrop.js): images behind its sections as it scrolls, in the
  page's Motion tab (the Transition card), plain fields under a "Backdrop" heading. Its images (ImageList.svelte: drag an image to move
  it, Media to change, ✕ to remove, Add image opens Media), then its transition: Scroll (a
  direction) or Fade (direct or through black, Parallax, Scrub). The options sit in one slot of
  a fixed height, so switching Scroll and Fade moves nothing under it. The heading's switch turns
  it off (enabled: false) without losing its images. Every change is one undo step; a value
  set back to its default is left out (BACKDROP_DEFAULTS), and so is an empty backdrop on
  save. The preview shows it at once (main.js syncBackdrop).
    live  reactive store; file  the page file
-->
<script>
  import { plural } from '../lib/format.js';
  import Field from './Field.svelte';
  import ImageList from './ImageList.svelte';
  import { openMedia } from './media.svelte.js';
  import {
    BACKDROP_DEFAULTS,
    DIRECTIONS,
    SHADE_MAX,
    THROUGH,
    TRANSITIONS,
  } from '../../site/backdrop.js';
  import { isObject } from '../../site/is.js';

  let { live, file } = $props();

  const b = $derived.by(() => {
    live.version;
    const v = live.get(file, '/backdrop');
    // a copy: the store changes its objects in place, and a derived of the same object stays put
    return isObject(v) ? { ...v } : {};
  });
  const images = $derived(Array.isArray(b.images) ? [...b.images] : []);
  const has = $derived(images.some(Boolean));
  // a stored value, or its default when it isn't one of the choices
  const valueOf = (key, list) => (list.includes(b[key]) ? b[key] : BACKDROP_DEFAULTS[key]);
  const LABELS = {
    scroll: 'Scroll',
    fade: 'Fade',
    none: 'Direct',
    black: 'Through black',
    vertical: 'Vertical',
    horizontal: 'Horizontal',
  };
  const options = (list) => list.map((v) => [v, LABELS[v]]);
  const transition = $derived(valueOf('transition', TRANSITIONS));
  const on = $derived(b.enabled !== false);
  const shade = $derived(
    Math.round((typeof b.shade === 'number' ? b.shade : BACKDROP_DEFAULTS.shade) * 100),
  );
  const items = $derived(
    images.map((_, i) => [
      {
        edit: `${file}#/backdrop/photos/${i}`,
        file,
        ptr: `/backdrop/photos/${i}`,
        type: 'image',
        label: `Image ${i + 1}`,
      },
    ]),
  );
  const changed = (key) => live.changed(file, `/backdrop/${key}`);

  /** A setting; its default is left out. */
  function set(key, value) {
    const ptr = `/backdrop/${key}`;
    if (value === BACKDROP_DEFAULTS[key]) live.store.remove(file, ptr, { source: 'panel' });
    else live.store.set(file, ptr, value, { source: 'panel', key: `backdrop:${file}${ptr}` });
  }
  const setImages = (list) => live.store.set(file, '/backdrop/images', list, { source: 'panel' });
  function move(from, to) {
    const list = [...images];
    list.splice(to, 0, ...list.splice(from, 1));
    setImages(list);
  }
  function removeAt(i) {
    const list = [...images];
    list.splice(i, 1);
    setImages(list);
  }
  /** Media opens to pick images (they land at the end of the list, in the order picked). */
  function add() {
    openMedia({ multi: { list: `${file}#/backdrop/images`, item: '', image: '' } });
  }

  const name = $derived(has ? `${plural(images.length, 'image')} · ${LABELS[transition]}` : '');
</script>

<!-- a value picker (not tabs): a group of buttons, the picked one filled -->
{#snippet choice(key, title, options, now)}
  <div class={['tf', changed(key) && 'is-changed']}>
    <span class="tf__label">{title}</span>
    <div class="seg" role="radiogroup" aria-label={title}>
      {#each options as [value, label] (value)}
        <button
          type="button"
          role="radio"
          aria-checked={now === value}
          class={['seg__btn', now === value && 'is-active']}
          onclick={() => set(key, value)}>{label}</button
        >
      {/each}
    </div>
  </div>
{/snippet}

<h3 class={['pane__head', live.changed(file, '/backdrop') && 'is-changed']} id="backdrop">
  Backdrop
  {#if name}<span class="pane__name">{name}</span>{/if}
  <input
    type="checkbox"
    class="switch"
    aria-label="Show the backdrop"
    title={!has ? 'Add an image first' : on ? 'Shown behind the sections' : 'Hidden'}
    disabled={!has}
    checked={has && on}
    onchange={(e) => set('enabled', e.currentTarget.checked)}
  />
</h3>
<div class={['fields', has && !on && 'bd--off']}>
  {#if !has}
    <p class="hint small transition-backdrop__hint">
      Images behind the sections, one after another: the first at the top, the last until the end.
      Section backgrounds sit on top.
    </p>
  {/if}
  <ImageList
    label="Images"
    {items}
    addLabel="Add image"
    onmove={move}
    onremove={removeAt}
    onadd={add}
  >
    {#snippet row(fields, i, ctl)}
      {@const f = fields[0]}
      <Field
        {...f}
        value={images[i]}
        changed={live.changed(file, f.ptr)}
        grab={ctl.grab}
        remove={ctl.remove}
        onvalue={(v) => (v ? live.store.set(file, f.ptr, v, { source: 'panel' }) : removeAt(i))}
      />
    {/snippet}
  </ImageList>
  {#if has}
    <hr class="transition-backdrop__line" />
    {@render choice('transition', 'Transition', options(TRANSITIONS), transition)}
    <!-- the dim over the images, for both transitions; the value has a fixed width -->
    <div class={['tf', changed('shade') && 'is-changed']}>
      <span class="tf__label">Shade</span>
      <div class="transition-backdrop__shade">
        <input
          type="range"
          class="f__range"
          min="0"
          max={Math.round(SHADE_MAX * 100)}
          step="5"
          aria-label="Shade"
          value={shade}
          oninput={(e) => set('shade', Math.round(+e.currentTarget.value) / 100)}
        />
        <span class="transition-backdrop__val">{shade}%</span>
      </div>
    </div>
    <!-- the transition's options: one slot of a fixed height (a choice, then a 40px row) -->
    <div class="transition-backdrop__slot">
      {#if transition === 'fade'}
        {@render choice('through', 'Fade', options(THROUGH), valueOf('through', THROUGH))}
        <div class="transition-backdrop__pair">
          <Field
            edit="{file}#/backdrop/parallax"
            label="Parallax"
            type="boolean"
            value={b.parallax === true}
            changed={changed('parallax')}
            onvalue={(v) => set('parallax', v)}
          />
          <Field
            edit="{file}#/backdrop/scrub"
            label="Scrub"
            type="boolean"
            value={b.scrub === true}
            changed={changed('scrub')}
            onvalue={(v) => set('scrub', v)}
          />
        </div>
      {:else}
        {@render choice(
          'direction',
          'Direction',
          options(DIRECTIONS),
          valueOf('direction', DIRECTIONS),
        )}
        <p class="hint small transition-backdrop__note">
          The images scroll by with the page; the last is fully in view at its end.
        </p>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // switched off: the labels and values go quiet (colour only: nothing moves)
  .bd--off :global(:is(.tf__label, .image__label, .transition-backdrop__val, .seg__btn)) {
    color: var(--c-text-faint);
  }

  .transition-backdrop__hint,
  .transition-backdrop__note {
    margin: 0;
  }

  .transition-backdrop__line {
    margin: var(--space-1) 0;
    border: 0;
    border-top: 1px solid var(--c-line);
  }

  // Scroll's and Fade's options in one slot: a 32px choice with its label, then a 40px row
  // (the switches, or the note), so switching never moves what is under it
  .transition-backdrop__slot {
    display: grid;
    grid-template-rows: auto 40px;
    gap: var(--space-3);
  }

  .transition-backdrop__note {
    align-self: center;
  }

  .transition-backdrop__shade {
    @include row(var(--space-3));
    height: 32px;

    .f__range {
      flex: 1;
    }
  }

  // a fixed width ("80%" fits), so dragging never moves the slider
  .transition-backdrop__val {
    width: 40px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--c-text);
  }

  .transition-backdrop__pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);

    :global(.tf__label) {
      justify-content: space-between;
      min-height: 32px;
      margin-bottom: 0;
    }
  }
</style>
