<!--
  Animated elements (data-anim: the hero's photos, a heading's title, ...) in the Sections tab: a
  widget's, under its card when its chevron is open (SectionCard.svelte), or the ones outside the
  widgets (the curtain, the header: SectionsList.svelte's Outside the widgets card). Each row: its
  data-anim name and the animation it uses; a click opens its motion editor under it
  (AnimEditor.svelte, ui.anim; again: closed). In a widget (base: the widget's pointer) an element
  with its own values there has the reset arrow (drops them: one undo step) and the yellow dot
  while they are unsaved, both in rooms that are always kept (nothing moves).
    elements  [{ el, id }] (page-motion.js motionSections, bridge.animElements())
    base      its widget's pointer, /sections/<i>/widgets/<j>; '' outside the widgets
    cfg, items, gsap, file, sections  for AnimEditor (animations.json as edited, the page's
              animated elements, the preview's GSAP, the page file and its motion sections)
    nested    under a widget's card (indented to its text), else a card's own list
-->
<script>
  import AnimEditor from './AnimEditor.svelte';
  import { ui, openElement, hoverElement } from './ui.svelte.js';
  import { animationOf, elementOf, keepFor, layerPtr } from './motion.js';

  let {
    live,
    bridge,
    cfg,
    items,
    gsap,
    file,
    sections,
    elements,
    base = '',
    nested = false,
    onlibrary,
  } = $props();

  /** Drop an element's own values in its widget: one undo step. */
  function resetElement(id) {
    live.store.remove(file, layerPtr(null, { id }, 'element', base), {
      keep: keepFor('element'),
      source: 'motion-structure',
    });
  }

  /** Open its motion editor (closed when it is open), the element shown in the preview. */
  function open(el) {
    if (ui.anim?.el !== el) bridge.reveal(el);
    openElement(el);
  }
</script>

<ol class={['elist', nested && 'elist--nested']}>
  {#each elements as { el, id } (el)}
    <li>
      <div class="elist__row">
        <button
          type="button"
          class={[
            'elist__item',
            base && 'has-reset',
            base && live.changed(file, layerPtr(null, { id }, 'element', base)) && 'is-unsaved',
          ]}
          aria-expanded={ui.anim?.el === el}
          onclick={() => open(el)}
          onpointerenter={() => hoverElement(el)}
          onpointerleave={() => hoverElement(null)}
        >
          <span class="elist__id">{id}</span>
          <span class="elist__anim">{animationOf(cfg, { id, el }) || '?'}</span>
        </button>
        {#if base && elementOf(el, id)}
          <button
            type="button"
            class="elist__reset"
            title="Has its own values in this widget: use the animation of all &quot;{id}&quot;"
            aria-label="{id}: drop its own values in this widget"
            onclick={() => resetElement(id)}
            ><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button
          >
        {/if}
      </div>
      {#if ui.anim && ui.anim.el === el}
        {#key ui.anim}
          <div class="elist__editor">
            <AnimEditor {live} {bridge} {cfg} {items} {gsap} {file} {sections} {onlibrary} />
          </div>
        {/key}
      {/if}
    </li>
  {/each}
</ol>

<style lang="scss">
  @use '../styles/mixins' as *;

  .elist {
    @include stack(var(--space-1));
    grid-template-columns: minmax(0, 1fr); // a wide editor never widens the list
    margin: 0;
    padding: 0;
    list-style: none;

    > li {
      min-width: 0;
    }
  }

  // under a widget's card: 4px below it, in line with its text (grip and chevron: 40px)
  .elist--nested {
    margin: var(--space-1) 0 0 40px;
  }

  .elist__row {
    position: relative;
  }

  // [ its data-anim name | its animation ]: 32px
  .elist__item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-lg);
    background: var(--c-fill-hover);
    box-shadow: inset 0 0 0 1px var(--c-line);
    color: inherit;
    font: inherit;
    font-size: var(--fs-sm);
    line-height: 16px;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--c-fill-active);
    }

    &:focus-visible {
      @include focus-ring;
    }

    // the reset arrow's slot at the row's end, kept while empty (nothing moves when it shows)
    &.has-reset {
      padding-right: calc(var(--space-3) + 16px + var(--space-2));
    }

    // unsaved changes to its own values in this widget: the yellow dot after its name, in its
    // own room that is always kept (hidden while saved)
    .elist__id::after {
      @include unsaved-dot;
      content: '';
      display: inline-block;
      margin: 0 0 1px var(--space-2);
      vertical-align: middle;
      visibility: hidden;
    }

    &.is-unsaved .elist__id::after {
      visibility: visible;
    }
  }

  .elist__id {
    min-width: 0;
    @include ellipsis;
  }

  // its animation: the quiet tag (as a widget row's)
  .elist__anim {
    flex: none;
    @include muted;
  }

  // its own values in its widget: a quiet reset over the row's end (as a field's)
  .elist__reset {
    position: absolute;
    top: calc(50% - 8px);
    right: var(--space-3);
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    cursor: pointer;

    &:hover {
      color: var(--c-text);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  // its motion editor, under its row (under a widget: the card's width, out of the indent)
  .elist__editor {
    min-width: 0;
    padding: var(--space-3) 0 var(--space-2);

    .elist--nested & {
      margin-left: -40px;
    }
  }
</style>
