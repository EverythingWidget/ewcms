<!--
  The areas (ui.panel 'areas'): one card per record of ../areas.js, the only place each is
  opened from. A card: [ 20px icon in a 36px column | label / subtitle | › ]. A click opens what
  the record says (opens): its panel (actions.setPanel: its head's ← comes back here) or its
  window over the editor (the list stays). The areas that open a window are half-width cards
  under the list, two a row, without the ›. An area not built yet (status 'soon') is disabled and
  says "Coming soon" where the › is (SoonTag.svelte).
-->
<script>
  import SoonTag from './SoonTag.svelte';
  import { AREAS, opensIn } from '../areas.js';
  import { ui } from './ui.svelte.js';
  import { media, isR2 } from './media.svelte.js';
  import { sourceIdOf } from '../../render/files.js';
  import { pageIds } from '../lib/page-tree.js';

  // live: reactive store (live.svelte.js); actions: setPanel (main.js)
  let { live, actions } = $props();

  // what the site has, for the records' subtitles
  const counts = $derived.by(() => {
    const files = live.files;
    const sources = Object.keys(files).filter((f) => sourceIdOf(f));
    return {
      pages: pageIds(files).length,
      photos: Object.keys(media.photos).filter(isR2).length + Object.keys(media.manifest).length,
      sources: sources.length,
      items: sources.reduce(
        (n, f) => n + (Array.isArray(files[f]?.items) ? files[f].items.length : 0),
        0,
      ),
      templates: ui.pages.filter((p) => p.kind === 'item-template').length,
    };
  });

  // the areas in the side panel (and the ones not built yet) as rows, the windows as cards
  const rows = AREAS.filter((a) => opensIn(a) !== 'window');
  const windows = AREAS.filter((a) => opensIn(a) === 'window');

  // the record says what opens: its panel, or its window
  function open(area) {
    if (area.status !== 'ready') return;
    if (opensIn(area) === 'panel') actions.setPanel(area.id);
    else area.opens?.window?.();
  }
</script>

<section class="ed-body" aria-label="Areas">
  <ul class="areas">
    {#each rows as area (area.id)}<li>{@render card(area)}</li>{/each}
  </ul>
  <!-- the areas that open a window (Media, Sources, ...): two a row under the list -->
  {#if windows.length}
    <ul class="areas-win">
      {#each windows as area (area.id)}<li>{@render card(area)}</li>{/each}
    </ul>
  {/if}
</section>

{#snippet card(area)}
  {@const soon = area.status === 'soon'}
  {@const win = opensIn(area) === 'window'}
  <button
    type="button"
    class={['arow', soon && 'is-soon']}
    data-area={area.id}
    disabled={soon}
    aria-haspopup={win ? 'dialog' : undefined}
    onclick={() => open(area)}
  >
    <span class="arow__lead"><i class="fa-solid fa-{area.icon}" aria-hidden="true"></i></span>
    <span class="arow__text">
      <span class="arow__name">{area.label}</span>
      <span class="arow__sub">{area.subtitle(counts)}</span>
    </span>
    {#if soon}
      <SoonTag />
    {:else if !win}
      <span class="arow__go"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
    {/if}
  </button>
{/snippet}

<style lang="scss">
  @use '../styles/mixins' as *;

  // the same stack as the pages list's cards (4px)
  .areas {
    @include stack(var(--space-1));
    margin: 0;
    padding: 0;
    list-style: none;
  }

  // the windows' cards: two a row, 12px under the list, 8px apart, flush with the rows
  // (a row's look and height, half its width: (376 - 8) / 2 = 184px; no ›)
  .areas-win {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
    margin: var(--space-3) 0 0;
    padding: 0;
    list-style: none;
  }

  // a page card's look: [ 20px icon in a 36px column (8px each side) | name / sub | › ]
  .arow {
    @include row(0);
    width: 100%;
    min-height: 48px;
    padding-right: var(--space-1);
    border: 0;
    border-radius: var(--radius-lg);
    background: var(--c-page-card);
    box-shadow: inset 0 0 0 1px transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover:not(:disabled) {
      box-shadow: inset 0 0 0 1px var(--c-line-hover);
    }

    &:focus-visible {
      @include focus-ring;
    }

    &.is-soon {
      @include soon-row('.arow__lead, .arow__name');
    }
  }

  .arow__lead {
    display: grid;
    flex: none;
    place-items: center;
    align-self: stretch;
    width: 36px; // 8px + 20px icon + 8px
    color: var(--c-text-muted);
    font-size: var(--fs-2xl);
    line-height: 1;
  }

  .arow__text {
    display: grid;
    flex: 1;
    align-self: stretch;
    align-content: center;
    min-width: 0;
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-1);
    font-size: var(--fs-base);
    line-height: 20px;
  }

  .arow__name {
    @include ellipsis;
    color: var(--c-text-strong);
    font-weight: 500;
  }

  .arow__sub {
    @include ellipsis;
    @include muted;
  }

  .arow__go {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    color: var(--c-text-muted);
    font-size: var(--fs-2xs);
  }
</style>
