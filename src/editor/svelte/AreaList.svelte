<!--
  The areas (ui.panel 'areas'): one card per record of ../areas.js, the only place each is
  opened from. A card: [ 20px icon in a 36px column | label / subtitle | › ]. A click opens what
  the record says (opens): its panel (actions.setPanel: its head's ← comes back here) or its
  window over the editor (the list stays). The areas that open a window are half-width cards
  under the list, two a row, without the ›. An area not built yet (status 'soon') is disabled and
  says "Coming soon" where the › is (SoonTag.svelte). The card: AreaCard.svelte (the pages
  list's site parts are the same card).
-->
<script>
  import AreaCard from './AreaCard.svelte';
  import { AREAS, opensIn } from '../areas.js';
  import { ui } from './ui.svelte.js';
  import { media, isR2 } from './media.svelte.js';
  import { sourceIdOf } from '../../render/files.js';
  import { pageIds } from '../lib/page-tree.js';
  import { upd, highlighted } from './update.svelte.js';

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
      update: { ...upd.info, highlighted: highlighted() },
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
  {@const win = opensIn(area) === 'window'}
  <AreaCard
    icon={area.icon}
    name={area.label}
    sub={area.subtitle(counts)}
    go={!win}
    soon={area.status === 'soon'}
    update={!!area.highlight?.(counts)}
    data-area={area.id}
    aria-haspopup={win ? 'dialog' : undefined}
    onclick={() => open(area)}
  />
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
</style>
