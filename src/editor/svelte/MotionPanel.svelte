<!--
  A page's Motion tab (ContentPanel.svelte), always the whole page: its widgets, a card per
  section, each with its animation and its elements that have their own (data-anim inside it:
  the hero's photos, a heading's title, ...), then the animated elements outside the widgets
  (fixed elements), then the Transition card (TransitionCard.svelte: the backdrop and the
  curtain). The widget or element picked (ui.anim, from the preview or the list; a second click
  on its row drops it) opens in place, under its row: a widget's motion (WidgetMotion), an
  element's animation (AnimEditor).
  The animations themselves (the library) and the default timing are in Settings
  (MotionSettings.svelte). The widget picked is the Sections tab's widget too.
-->
<script>
  import AnimEditor from './AnimEditor.svelte';
  import WidgetMotion from './WidgetMotion.svelte';
  import TransitionCard from './TransitionCard.svelte';
  import Section from './Section.svelte';
  import { ui, pickElement, hoverElement } from './ui.svelte.js';
  import { motionSections } from './page-motion.js';
  import { ANIMATIONS } from '../../site/files.js';
  import { animationOf, elementOf } from './motion.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js); actions: main.js;
  // file: the page file
  let { live, bridge, actions, file } = $props();

  /** Open animation `name` in the library (Settings > Motion). */
  function openLibrary(name = '') {
    ui.library = { name };
    actions.setPanel('settings');
  }

  const cfg = $derived(live.current(ANIMATIONS));
  // The preview's GSAP and animated elements: re-read when it shows another page.
  const gsap = $derived.by(() => {
    ui.previewVersion;
    return bridge.api?.gsap;
  });
  const items = $derived.by(() => {
    ui.previewVersion;
    live.version;
    return bridge.api ? bridge.animElements() : [];
  });

  // The page's sections and widgets (its file), each widget with its element and the animated elements inside it.
  const sections = $derived.by(() => {
    ui.previewVersion;
    live.version;
    return motionSections(file ? live.get(file, '/sections') : null, bridge.doc, items);
  });
  const outside = $derived(items.filter((it) => !it.el.closest('[data-widget]')));

  /** Pick an element or widget (as a click in the preview does). */
  function pick(el) {
    if (!el) return;
    if (ui.anim?.el === el) return pickElement(null);
    bridge.reveal(el);
    pickElement(el, 'anim');
  }
</script>

{#snippet element({ el, id })}
  <li>
    <button
      type="button"
      class={['mlist__item', 'mlist__element', elementOf(el, id) && 'is-changed']}
      title={elementOf(el, id) ? 'Has its own values in this widget' : undefined}
      onclick={() => pick(el)}
      onpointerenter={() => hoverElement(el)}
      onpointerleave={() => hoverElement(null)}
    >
      <span class="mlist__id">
        {id}
      </span>
      <span class="muted">{animationOf(cfg, { id, el }) || '?'}</span>
    </button>
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
      <Section key="motion:{s.id}" title="Section {s.at + 1}" name={s.name}>
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
                  {#each widget.elements as p (p.el)}{@render element(p)}{/each}
                </ol>
              {/if}
            </li>
          {/each}
        </ol>
      </Section>
    {/each}
    {#if outside.length}
      <Section key="motion:elements" title="Outside the widgets" name="Fixed elements">
        {#snippet bar()}<span class="mlist__count">{outside.length}</span>{/snippet}
        <ol class="list">
          {#each outside as it (it.el)}{@render element(it)}{/each}
        </ol>
      </Section>
    {/if}
    <TransitionCard {live} {file} onsettings={() => actions.setPanel('settings')} />
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

  .mlist__element {
    font-size: var(--fs-sm);
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
