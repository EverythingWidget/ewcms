<!--
  The areas (ui.panel 'areas'): one card per part of the site, the only place each is opened
  from (../areas.js). A card: [ 20px icon in a 36px column | name / what it holds | › ]. Pages,
  Theme, Animations and Site settings open in the side panel (actions.setPanel; their head's
  ← comes back here), Media and Sources open their window over the editor and the list stays.
  An area not built yet is disabled and says "Coming soon" where the › is.
-->
<script>
  import { AREAS, areaSubs } from '../areas.js';
  import { ui } from './ui.svelte.js';
  import { media, isR2, openMedia } from './media.svelte.js';
  import { openSources } from './modals.svelte.js';
  import { sourceIdOf } from '../../render/files.js';
  import { pageIds } from '../lib/page-tree.js';

  // live: reactive store (live.svelte.js); actions: setPanel (main.js)
  let { live, actions } = $props();

  const subs = $derived.by(() => {
    const files = live.files;
    const sources = Object.keys(files).filter((f) => sourceIdOf(f));
    return areaSubs({
      pages: pageIds(files).length,
      photos: Object.keys(media.photos).filter(isR2).length + Object.keys(media.manifest).length,
      sources: sources.length,
      items: sources.reduce(
        (n, f) => n + (Array.isArray(files[f]?.items) ? files[f].items.length : 0),
        0,
      ),
      templates: ui.pages.filter((p) => p.kind === 'item-template').length,
    });
  });

  function open(area) {
    if (area.id === 'media') return openMedia({ key: ui.media.key });
    if (area.id === 'sources') return openSources();
    if (area.opens === 'panel') actions.setPanel(area.id);
  }
</script>

<section class="ed-body" aria-label="Areas">
  <ul class="areas">
    {#each AREAS as area (area.id)}
      {@const soon = area.opens === 'soon'}
      <li>
        <button
          type="button"
          class={['arow', soon && 'is-soon']}
          data-area={area.id}
          disabled={soon}
          aria-haspopup={area.opens === 'modal' ? 'dialog' : undefined}
          onclick={() => open(area)}
        >
          <span class="arow__lead"><i class="fa-solid fa-{area.icon}" aria-hidden="true"></i></span>
          <span class="arow__text">
            <span class="arow__name">{area.label}</span>
            <span class="arow__sub">{subs[area.id]}</span>
          </span>
          {#if soon}
            <span class="arow__soon">Coming soon</span>
          {:else}
            <span class="arow__go"
              ><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span
            >
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</section>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the same stack as the pages list's cards (4px)
  .areas {
    @include stack(var(--space-1));
    margin: 0;
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

    // not built yet: quieter, no hover, no pointer
    &.is-soon {
      cursor: default;

      .arow__lead,
      .arow__name {
        color: var(--c-text-faint);
      }
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

  // where the › is: the same right edge (the row's 4px), on one line
  .arow__soon {
    flex: none;
    padding-right: var(--space-2);
    @include muted;
    white-space: nowrap;
  }
</style>
