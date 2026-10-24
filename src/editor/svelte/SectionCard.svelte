<!--
  One page section's card in the Content tab's list (SectionsList.svelte), not collapsible:
    title row  the changed dot, its title (its name, else "Section N"; one line, cut with …);
               a click selects it, a double click opens its settings (onsection)
    its widgets always shown under the title (not collapsible): WidgetRow.svelte each, in their
               order (drag a row's grip to reorder, within the section; their grid areas stay); none: the title alone (no placeholder)
  12px inside on every side. Its tools (Add widget, pen, move, ⋯) are the tab's section toolbar
  (SectionToolbar.svelte), for the selected card. Delete asks over the card at its size (its
  border red).
    live, file, at (its index), peek (hovered in the preview)
    selected, onselect, onsection (its settings), onopen(widgetId)
    deleting  bindable: the id asking "Delete?" (the section's), '' for none
    changed    overrides the changed dot (the mock kit)
-->
<script>
  import { ui, selectWidgets, reveal } from './ui.svelte.js';
  import { range, selectedIds, toggle } from '../multi-select.js';
  import Button from './Button.svelte';
  import Section from './Section.svelte';
  import WidgetRow from './WidgetRow.svelte';
  import { listDrag, rowsOf } from './list-drag.svelte.js';
  import { duplicateWidget, moveWidget, removeWidget, removeSection } from '../layout-ops.js';

  let {
    live,
    file,
    at,
    peek = false,
    selected = false,
    changed = undefined,
    deleting = $bindable(''),
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

  const asking = $derived(deleting === s.id);

  // Reorder by drag (its grip; list-drag.svelte.js, as the cards had it before 6b47b06): only within this
  // section (its own list is the only one, so a drop elsewhere moves nothing). The order is the
  // widgets' array = DOM order (paint order at the same layer, z); their grid areas stay. A drag
  // is no click: the card's selection doesn't change. One undo step; the preview re-renders.
  let listEl = $state();
  const ld = listDrag({
    lists: () => (listEl ? [rowsOf(listEl, '[data-row]', 0)] : []),
    shape: () => widgets.map((b) => b.id).join(','),
    ondrop: (d) => {
      if (widgets[d.j]?.id !== d.id) return;
      moveWidget(live.store, file, at, d.j, d.over.to);
    },
    grabbing: true,
    edgeScroll: true,
    swallowClick: true,
  });
  const drag = $derived(ld.drag);

  function setWidgetOn(j, show) {
    live.store.set(
      file,
      `/sections/${at}/widgets/${j}/config`,
      { ...widgets[j].config, enabled: show ? undefined : false },
      { source: 'panel' },
    );
  }

  // ---- multi-select (multi-select.js): Ctrl/Cmd+click toggles a row, Shift+click selects from
  // the row clicked last; only within one section: while Ctrl/Cmd is held with a selection in
  // another section, these rows are not clickable (dimmed, the not-allowed cursor)
  const ids = $derived(widgets.map((b) => b.id));
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

  // the delete confirm: Cancel takes the focus (Enter does not delete by accident)
  const focusCancel = (el) => el.querySelector('.ask-btns > :last-child')?.focus();
</script>

<Section
  id={s.id}
  {title}
  off={!on}
  changed={changed ?? live.changed(file, `/sections/${at}`)}
  class={peek && !selected && !asking ? 'is-peek' : ''}
  danger={asking}
  foot={n ? list : undefined}
  {selected}
  {onselect}
  onenter={onsection}
>
  {#snippet over()}
    {#if asking}
      <!-- over the card at its size and corners: the question top left, Delete / Cancel bottom left -->
      <div
        class="ask"
        class:ask--row={!n}
        role="alertdialog"
        tabindex="-1"
        aria-label={name ? `Delete “${name}”?` : `Delete ${title}?`}
        {@attach focusCancel}
        onkeydown={(e) => e.key === 'Escape' && (e.stopPropagation(), (deleting = ''))}
      >
        <p class="ask__msg">{name ? `Delete “${name}”?` : `Delete ${title}?`}</p>
        <div class="ask-btns">
          <Button
            size="small"
            variant="danger"
            icon="trash"
            iconOnly
            label="Delete"
            onclick={() => {
              deleting = '';
              removeSection(live.store, file, at);
            }}
          />
          <Button size="small" onclick={() => (deleting = '')}>Cancel</Button>
        </div>
      </div>
    {/if}
  {/snippet}
</Section>

{#snippet list()}
  <ul class="widgets" aria-label="Widgets of {title}" bind:this={listEl}>
    {#each widgets as b, j (b.id)}
      <WidgetRow
        widget={b}
        onopen={() => onopen(b.id)}
        onselect={(e) => pick(e, b.id)}
        open={ui.widget === b.id || ui.multi.includes(b.id)}
        {blocked}
        hot={ui.hot?.from === 'preview' && ui.hot.id === b.id}
        onhover={(on) =>
          on
            ? (ui.hot = { id: b.id, from: 'panel' })
            : ui.hot?.from === 'panel' && ui.hot.id === b.id && (ui.hot = null)}
        onshow={(show) => setWidgetOn(j, show)}
        onduplicate={() => duplicateWidget(live.store, file, at, j)}
        ondelete={() => {
          if (ui.multi.includes(b.id)) selectWidgets(ui.multi.filter((x) => x !== b.id));
          removeWidget(live.store, file, at, j);
        }}
        ongrab={(e) => ld.grab(e, { id: b.id, j })}
        lifted={drag?.id === b.id && drag.moving}
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
    @include stack(var(--space-1));
    margin: 0;
    padding: 0;
    list-style: none;
  }

  // Delete?: over the card at its size (no shift): the card's colour at 80% hides what is
  // under it; the question at the top, Cancel / Delete at the bottom, 12px in
  // the card's confirm: over it at its size and corners (inside its red border), opaque, 8px in
  // on every side: 8 + 20 + 24 + 8 = 60px fits a card with a widget (100px+; never scrolls).
  // A card without widgets (the title alone, 44px): one row, the question left, the buttons right
  .ask {
    @include stack(var(--space-2));
    position: absolute;
    inset: 0;
    z-index: 2;
    align-content: space-between;
    padding: var(--space-2);
    overflow: hidden;
    border-radius: inherit;
    background: var(--c-card);
  }

  .ask--row {
    @include row(var(--space-2));
    justify-content: space-between;

    .ask__msg {
      flex: 1;
      min-width: 0;
    }

    .ask-btns {
      flex: none;
    }
  }

  .ask__msg {
    @include ellipsis;
    margin: 0;
    color: var(--c-text-strong);
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    line-height: 20px;
    text-transform: uppercase;
  }
</style>
