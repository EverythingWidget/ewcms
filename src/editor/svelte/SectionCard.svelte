<!--
  One page section's card in the Sections tab's list (SectionsList.svelte), not collapsible:
    title row  the changed dot, its title (its name, else "Section N"; one line, cut with …);
               a click selects it, a double click opens its settings (onsection)
    its widgets always shown under the title (not collapsible): WidgetRow.svelte each, in their
               order (drag a row's grip to reorder, within the section; their grid areas stay); none: the title alone (no placeholder)
  12px inside on every side. Its tools (Add widget, pen, move, ⋯) are the tab's section toolbar
  (SectionToolbar.svelte), for the selected card (Delete: its trash, at once; undo brings it
  back). A Ctrl/Cmd or Shift click adds it to the selected sections (ui.selSections).
    live, file, at (its index), peek (hovered in the preview)
    selected, onselect, onsection (its settings), onopen(widgetId)
    changed    overrides the changed dot (the mock kit)
-->
<script>
  import { ui, selectWidgets, reveal } from './ui.svelte.js';
  import { range, selectedIds, toggle } from '../multi-select.js';
  import Section from './Section.svelte';
  import WidgetRow from './WidgetRow.svelte';
  import { listDrag, rowsOf } from './list-drag.svelte.js';
  import { moveWidget } from '../layout-ops.js';

  let {
    live,
    file,
    at,
    peek = false,
    selected = false,
    changed = undefined,
    onselect,
    onsection,
    onopen,
  } = $props();

  const s = $derived.by(() => {
    live.version;
    return live.current(file)?.sections?.[at] || {};
  });
  const name = $derived((typeof s.name === 'string' && s.name.trim()) || '');
  const title = $derived(name || `Section ${at + 1}`);
  const widgets = $derived(Array.isArray(s.widgets) ? s.widgets : []);
  const n = $derived(widgets.length);
  const on = $derived(s.enabled !== false);

  // Reorder by drag (its grip; list-drag.svelte.js, as the cards had it before 6b47b06): only within this
  // section (its own list is the only one, so a drop elsewhere moves nothing). The order is the
  // widgets' array = DOM order (paint order at the same layer, z); their grid areas stay. A drag
  // is no click: the card's selection doesn't change. One undo step; the preview re-renders.
  let listEl = $state();
  const ld = listDrag({
    lists: () => (listEl ? [rowsOf(listEl, '[data-row]', 0)] : []),
    shape: () => widgets.map((widget) => widget.id).join(','),
    ondrop: (d) => {
      if (widgets[d.j]?.id !== d.id) return;
      moveWidget(live.store, file, at, d.j, d.over.to);
    },
    grabbing: true,
    edgeScroll: true,
    swallowClick: true,
  });
  const drag = $derived(ld.drag);

  // ---- multi-select (multi-select.js): Ctrl/Cmd+click toggles a row, Shift+click selects from
  // the row clicked last; only within one section: while Ctrl/Cmd is held with a selection in
  // another section, these rows are not clickable (dimmed, the not-allowed cursor)
  const ids = $derived(widgets.map((widget) => widget.id));
  const sel = $derived(selectedIds(ui));
  const elsewhere = $derived(sel.length > 0 && !sel.some((id) => ids.includes(id)));
  const blocked = $derived(ui.mod && elsewhere);
  function pick(e, id) {
    if (e.ctrlKey || e.metaKey) {
      if (elsewhere) return;
      const next = toggle(sel, id, (x) => (ids.includes(x) ? s.id : null));
      if (!next) return;
      ui.anchor = id;
      return selectWidgets(next);
    }
    if (e.shiftKey && ui.anchor && ids.includes(ui.anchor))
      return selectWidgets(range(ids, ui.anchor, id));
    ui.anchor = id;
    // a click selects it (in the preview too, scrolled to when out of view); the pop-up swaps
    // to it when open (a double click opens it)
    selectWidgets([id]);
    reveal(id);
  }
</script>

<Section
  id={s.id}
  {title}
  off={!on}
  changed={changed ?? live.changed(file, `/sections/${at}`)}
  class={peek && !selected ? 'is-peek' : ''}
  foot={n ? list : undefined}
  {selected}
  {onselect}
  onenter={onsection}
></Section>

{#snippet list()}
  <ul class="widgets" aria-label="Widgets of {title}" bind:this={listEl}>
    {#each widgets as widget, j (widget.id)}
      <WidgetRow
        {widget}
        onopen={() => onopen(widget.id)}
        onselect={(e) => pick(e, widget.id)}
        open={ui.widget === widget.id || ui.multi.includes(widget.id)}
        {blocked}
        hot={ui.hot?.from === 'preview' && ui.hot.id === widget.id}
        onhover={(on) =>
          on
            ? (ui.hot = { id: widget.id, from: 'panel' })
            : ui.hot?.from === 'panel' && ui.hot.id === widget.id && (ui.hot = null)}
        ongrab={(e) => ld.grab(e, { id: widget.id, j })}
        lifted={drag?.id === widget.id && drag.moving}
        dy={drag?.dy ?? 0}
        drop={ld.dropAt(j)}
      />
    {/each}
  </ul>
{/snippet}

<style lang="scss">
  @use '../styles/mixins' as *;

  // ---- the card (Section.svelte, data-card): 12px inside on the sides (its bar and foot), the
  // widgets 8px under the title row; the title on one line
  :global(.sec[data-card] > .sec__bar) {
    padding-inline: var(--space-3);
  }

  :global(.sec[data-card] .sec__foot) {
    gap: 0;
    margin-top: 0;
    padding: var(--space-2) var(--space-3) 0;
  }

  :global(.sec[data-card] .sec__toggle--card > span) {
    @include ellipsis;
  }

  // hidden: the title muted (Section's), its widgets dimmed; the buttons follow their own rule
  :global(.sec[data-card].is-off) .widgets {
    opacity: var(--o-dim);
  }

  // a lifted row is drawn over the card's edge (its clip would cut it otherwise)
  :global(.sec__clip:has(.is-lifted)) {
    overflow: visible;
  }

  .widgets {
    @include stack(var(--gap-rows));
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
