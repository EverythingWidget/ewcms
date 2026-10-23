<!--
  One page section's card in the Content tab's list (SectionsList.svelte), not collapsible:
    title row  the changed dot, its title (its name, else "Section N"; one line, cut with …);
               a click selects it, a double click opens its settings (onsection)
    its widgets always shown under the title (not collapsible): WidgetRow.svelte each, no order
               (widgets are placed in the preview); none: the title alone (no placeholder)
  12px inside on every side. Its tools (Add widget, pen, move, ⋯) are the tab's section toolbar
  (SectionToolbar.svelte), for the selected card. Delete asks over the card at its size (its
  border red).
    live, file, at (its index), peek (hovered in the preview)
    selected, onselect, onsection (its settings), onopen(widgetId)
    deleting  bindable: the id asking "Delete?" (the section's), '' for none
    changed    overrides the changed dot (the mock kit)
-->
<script>
  import Button from './Button.svelte';
  import Section from './Section.svelte';
  import WidgetRow from './WidgetRow.svelte';
  import { duplicateWidget, removeWidget, removeSection } from '../layout-ops.js';

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

  function setWidgetOn(j, show) {
    live.store.set(
      file,
      `/sections/${at}/widgets/${j}/config`,
      { ...widgets[j].config, enabled: show ? undefined : false },
      { source: 'panel' },
    );
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
  <ul class="widgets" aria-label="Widgets of {title}">
    {#each widgets as b, j (b.id)}
      <WidgetRow
        widget={b}
        onopen={() => onopen(b.id)}
        onshow={(show) => setWidgetOn(j, show)}
        onduplicate={() => duplicateWidget(live.store, file, at, j)}
        ondelete={() => removeWidget(live.store, file, at, j)}
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
