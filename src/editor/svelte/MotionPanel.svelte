<!--
  A page's Element motion tab (ContentPanel.svelte, ui.pageTab 'element-motion'), always the
  whole page: its widgets, a card per
  section (its title only, no second line for now), each with its animation and its elements that have their own (data-anim inside it:
  the hero's photos, a heading's title, ...), then the animated elements outside the widgets
  (fixed elements). The page's own cards (Scroll backdrop, Page entrance) are the Page motion
  tab's (PageMotionPanel.svelte). The widget or element picked (ui.anim, from the preview or the list; a second click
  on its row drops it) opens in place, under its row: a widget's motion (WidgetMotion), an
  element's animation (AnimEditor).
  The animations themselves (the library) and the default timing are in Animations
  (MotionSettings.svelte). The widget picked is the Sections tab's widget too.
-->
<script>
  import AnimEditor from './AnimEditor.svelte';
  import WidgetMotion from './WidgetMotion.svelte';
  import Collapsible from './Collapsible.svelte';
  import { ui, pickElement, selectAnim, hoverElement } from './ui.svelte.js';
  import { motionSections } from './page-motion.js';
  import { ANIMATIONS } from '../../render/files.js';
  import { animationOf, elementOf, keepFor, layerPtr } from './motion.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../preview-runtime.js); actions: main.js;
  // file: the page file
  let { live, bridge, actions, file } = $props();

  /** Open animation `name` in the library (Animations > Motion). */
  function openLibrary(name = '') {
    ui.library = { name };
    actions.setPanel('animations');
  }

  const cfg = $derived(live.current(ANIMATIONS));
  // The preview's GSAP and animated elements: re-read when it shows another page.
  const gsap = $derived.by(() => {
    ui.previewVersion;
    return bridge.api?.gsap;
  });
  const items = $derived.by(() => {
    ui.previewVersion;
    return live.read(() => (bridge.api ? bridge.animElements() : []));
  });

  // The page's sections and widgets (its file), each widget with its element and the animated elements inside it.
  const sections = $derived.by(() => {
    ui.previewVersion;
    return live.read(() =>
      motionSections(file ? live.get(file, '/sections') : null, bridge.doc, items),
    );
  });
  const outside = $derived(items.filter((it) => !it.el.closest('[data-widget]')));

  /** Drop an element's own values in its widget (`base`: the widget's pointer): one undo step. */
  function resetElement(id, base) {
    live.store.remove(file, layerPtr(null, { id }, 'element', base), {
      keep: keepFor('element'),
      source: 'motion-structure',
    });
  }

  /** Select an element or widget (the same as a click in the preview picking it). */
  function pick(el) {
    if (!el) return;
    if (ui.anim?.el === el) return pickElement(null);
    bridge.reveal(el);
    selectAnim(el);
  }
</script>

<!-- an animated element; base: its widget's pointer (its own values there: the reset arrow,
     in a slot at the row's end that is always kept) -->
{#snippet element({ el, id }, base = '')}
  <li>
    <div class="mlist__row">
      <button
        type="button"
        class={[
          'mlist__item',
          'mlist__element',
          base && 'has-reset',
          base && live.changed(file, layerPtr(null, { id }, 'element', base)) && 'is-unsaved',
        ]}
        onclick={() => pick(el)}
        onpointerenter={() => hoverElement(el)}
        onpointerleave={() => hoverElement(null)}
      >
        <span class="mlist__id">
          {id}
        </span>
        <span class="muted">{animationOf(cfg, { id, el }) || '?'}</span>
      </button>
      {#if base && elementOf(el, id)}
        <button
          type="button"
          class="mlist__reset"
          title="Has its own values in this widget: use the animation of all &quot;{id}&quot;"
          aria-label="{id}: drop its own values in this widget"
          onclick={() => resetElement(id, base)}
          ><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button
        >
      {/if}
    </div>
    {#if ui.anim && !ui.anim.widget && ui.anim.el === el}
      {#key ui.anim}
        <AnimEditor
          {live}
          {bridge}
          {cfg}
          {items}
          {gsap}
          {file}
          {sections}
          onlibrary={openLibrary}
        />
      {/key}
    {/if}
  </li>
{/snippet}

{#if !gsap}
  <p class="hint">Waiting for the preview…</p>
{:else}
  <div class="mview">
    <p class="hint">
      Click a widget or an animated element of it in the preview, or pick one below. Hold Alt to
      click through to links.
    </p>
    {#each sections as s (s.id)}
      <Collapsible key="motion:{s.id}" title="Section {s.at + 1}">
        <ol class="list">
          {#each s.widgets as widget (widget.id)}
            <li>
              <button
                type="button"
                class="mlist__item"
                data-widget-item={widget.id}
                disabled={!widget.el}
                onclick={() => pick(widget.el)}
                onpointerenter={() => hoverElement(widget.el)}
                onpointerleave={() => hoverElement(null)}
              >
                <span class="mlist__id">{widget.label}{widget.name ? ` · ${widget.name}` : ''}</span
                >
                <span class="muted">{widget.animation || 'none'}</span>
              </button>
              {#if ui.anim?.widget === widget.id}
                {#key ui.anim}
                  <WidgetMotion
                    {live}
                    {bridge}
                    {gsap}
                    {cfg}
                    {file}
                    at={s.at}
                    j={widget.j}
                    el={widget.el}
                    onlibrary={openLibrary}
                    onelement={pick}
                  />
                {/key}
              {/if}
              {#if widget.elements.length}
                <ol class="list mlist__elements">
                  {#each widget.elements as p (p.el)}{@render element(
                      p,
                      `/sections/${s.at}/widgets/${widget.j}`,
                    )}{/each}
                </ol>
              {/if}
            </li>
          {/each}
        </ol>
      </Collapsible>
    {/each}
    {#if outside.length}
      <Collapsible key="motion:elements" title="Outside the widgets" name="Fixed elements">
        {#snippet bar()}<span class="mlist__count">{outside.length}</span>{/snippet}
        <ol class="list">
          {#each outside as it (it.el)}{@render element(it)}{/each}
        </ol>
      </Collapsible>
    {/if}
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  // the hint and the cards: spaced by the panel body (.ed-body's gap), as before
  .mview {
    display: contents;
  }

  // a widget's elements, under it
  .mlist__elements {
    margin: var(--space-1) 0 0 var(--space-4);
  }

  .mlist__row {
    position: relative;
  }

  .mlist__element {
    font-size: var(--fs-sm);

    // the reset arrow's slot at the row's end, kept while empty (nothing moves when it shows)
    &.has-reset {
      padding-right: calc(var(--space-3) + 16px + var(--space-2));
    }

    // unsaved changes to its own values in this widget: the yellow dot after its id, as a
    // field's after its label, in its own room that is always kept (hidden while saved)
    .mlist__id::after {
      @include unsaved-dot;
      content: '';
      display: inline-block;
      margin: 0 0 1px var(--space-2);
      vertical-align: middle;
      visibility: hidden;
    }

    &.is-unsaved .mlist__id::after {
      visibility: visible;
    }
  }

  // an element's own values in its widget: a quiet reset over the row's end (as a field's)
  .mlist__reset {
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

  .mlist__count {
    @include muted;
  }

  // motion panel
  .mlist__item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    line-height: 16px; // 32px tall
    border: 0;
    border-radius: var(--radius-lg);
    cursor: pointer;
    text-align: left;
    background: var(--c-fill-hover);
    box-shadow: inset 0 0 0 1px var(--c-line);

    &:hover {
      background: var(--c-fill-active);
    }
  }
</style>
