<!--
  The page's sections in the Content tab (src/site/layout/): a card each (SectionCard.svelte:
  its title and its widgets count, which opens its widgets inside the card; the selected one's
  tools are SectionToolbar.svelte's, over the body), then the dashed Add section card, which adds an empty
  section after the last one. A click on a card selects it (ui.selSection: its section shown in
  the preview, overlay.js); a double click (or the toolbar's pen) opens its settings (onsection); both
  scroll the preview to the section (locate.js, as Locate does; only from here, never for a
  selection made in the preview); a widget's
  row opens its settings (onopen), as a click on the widget in the preview does. Widgets have no
  order here: they are placed in the preview. Every change is one undo step (layout-ops.js).
-->
<script>
  import { tick } from 'svelte';
  import SectionCard from './SectionCard.svelte';
  import { ui } from './ui.svelte.js';
  import { addSection } from '../layout-ops.js';
  import { locate } from '../locate.js';

  // deleting: the id of the section asking "Delete?" (bindable: the toolbar's ⋯ asks)
  let { live, bridge, file, onopen, onsection, deleting = $bindable('') } = $props();

  const sections = $derived.by(() => {
    const list = live.current(file)?.sections;
    return Array.isArray(list) ? list : [];
  });

  // Add section: an empty section after the last one, scrolled into view
  async function add() {
    deleting = '';
    addSection(live.store, file);
    await tick();
    const s = sections.at(-1);
    if (!s) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .querySelector(`[data-section="${CSS.escape(s.id)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }

  // hover sync: a section card the pointer is over shows its section in the preview
  // (overlay.js), as does a widget's section card (ContentPanel's [data-peek-section]); one
  // hovered in the preview shows its card here (.is-peek)
  $effect(() => {
    const over = (e) => {
      const n = e.target.closest?.('[data-section^="s-"], [data-peek-section]');
      const id = n?.dataset.section || n?.dataset.peekSection || '';
      if (id) {
        if (ui.peek?.id !== id || ui.peek.from !== 'panel') ui.peek = { id, from: 'panel' };
      } else if (ui.peek?.from === 'panel') ui.peek = null;
    };
    const out = () => ui.peek?.from === 'panel' && (ui.peek = null);
    document.addEventListener('pointerover', over);
    document.documentElement.addEventListener('pointerleave', out);
    return () => {
      document.removeEventListener('pointerover', over);
      document.documentElement.removeEventListener('pointerleave', out);
      out();
    };
  });
</script>

{#each sections as s, at (s.id)}
  <SectionCard
    {live}
    {file}
    {at}
    peek={ui.peek?.from === 'preview' && ui.peek.id === s.id}
    selected={ui.selSection === s.id}
    bind:deleting
    onselect={() => {
      ui.selSection = s.id;
      locate(bridge, s.id);
    }}
    onsection={() => {
      locate(bridge, s.id);
      onsection(s.id);
    }}
    {onopen}
  />
{/each}

<button type="button" class="add" onclick={add}>
  <i class="fa-solid fa-plus" aria-hidden="true"></i>Add section
</button>

<style lang="scss">
  @use '../styles/mixins' as *;

  // Add section: a dashed card the section cards' width, + and its name centred
  .add {
    @include row(var(--space-2));
    flex: none;
    justify-content: center;
    width: 100%;
    height: 40px;
    border: 1px dashed var(--c-line);
    border-radius: var(--radius-lg);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      border-color: var(--c-accent);
      color: var(--c-text-strong);
      outline: none;
    }
  }
</style>
