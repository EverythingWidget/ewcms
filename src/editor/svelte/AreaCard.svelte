<!--
  A card on the pages' card colour: [ 20px icon in a 36px column | name / subtitle | › ], 48px.
  The areas' list (AreaList.svelte: its rows and its half-width window cards) and the pages
  list's site parts (PagesList.svelte: Header, Footer) draw the same one.
    icon      a Font Awesome solid name          name, sub   the two lines
    go        the › (opens a panel)              soon        not built yet: disabled, "Coming soon"
    update    highlighted (teal: an update)      active, selected   the page rows' fill and ring
  Anything else (onclick, ondblclick, title, data-*, aria-*) goes on its <button>.
-->
<script>
  import SoonTag from './SoonTag.svelte';

  let {
    icon,
    name,
    sub = '',
    go = false,
    soon = false,
    update = false,
    active = false,
    selected = false,
    ...rest
  } = $props();
</script>

<button
  type="button"
  class={[
    'arow',
    soon && 'is-soon',
    update && 'is-update',
    active && 'is-active',
    selected && 'is-sel',
  ]}
  disabled={soon}
  {...rest}
>
  <span class="arow__lead"><i class="fa-solid fa-{icon}" aria-hidden="true"></i></span>
  <span class="arow__text">
    <span class="arow__name">{name}</span>
    <span class="arow__sub">{sub}</span>
  </span>
  {#if soon}
    <SoonTag />
  {:else if go}
    <span class="arow__go"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
  {/if}
</button>

<style lang="scss">
  @use '../styles/mixins' as *;

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

    // the pages list's (PagesList.svelte .prow): active, the page the preview shows, a sand
    // fill; selected, the ring. Both can be on; neither changes the card's size
    &.is-active {
      background: color-mix(
        in srgb,
        var(--c-page-accent) 9%,
        color-mix(in srgb, var(--c-text) 14%, var(--c-page-card))
      );
    }

    &.is-sel {
      box-shadow: inset 0 0 0 1px var(--c-line-peek);
    }

    // highlighted (its record's highlight: About, an update): the old update pill's teal, a 1px
    // ring at 50% (a hovered widget row's), full on hover; the icon and the subtitle teal
    &.is-update {
      box-shadow: inset 0 0 0 1px var(--c-widget-line-hover);

      &:hover {
        box-shadow: inset 0 0 0 1px var(--c-widget-accent);
      }

      .arow__lead,
      .arow__sub {
        color: var(--c-widget-accent);
      }
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
