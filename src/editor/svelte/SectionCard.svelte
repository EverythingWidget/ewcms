<!--
  One page section's card in the Content tab's list (SectionsList.svelte), not collapsible:
    title row  the changed dot, its title (its name, else "Section N"; one line, cut with …);
               a click selects it, a double click opens its settings (onsection)
    count row  "Widgets ⌄" (text only; "No widgets" faint, inactive)
    its widgets the count opens them inside the card (ui.sections["widgets:<id>"]; the card
               grows, animated as a section opens; not on load, not with reduced motion): WidgetRow.svelte each, no order (widgets are placed in the preview)
  12px inside on every side. Its tools (Add widget, pen, move, ⋯) are the tab's section toolbar
  (SectionToolbar.svelte), for the selected card. Delete asks over the card at its size (its
  border red).
    live, file, at (its index), peek (hovered in the preview)
    selected, onselect, onsection (its settings), onopen(widgetId)
    deleting  bindable: the id asking "Delete?" (the section's), '' for none
    changed, expanded  override the changed dot and the widgets open / closed (the mock kit)
-->
<script>
  import Button from './Button.svelte';
  import Section from './Section.svelte';
  import WidgetRow from './WidgetRow.svelte';
  import { untrack } from 'svelte';
  import { gsap } from 'gsap';
  import { ui } from './ui.svelte.js';
  import { duplicateWidget, removeWidget, removeSection } from '../layout-ops.js';

  let {
    live,
    file,
    at,
    peek = false,
    selected = false,
    changed = undefined,
    expanded = undefined,
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
  const key = $derived(`widgets:${s.id}`);
  const open = $derived(!!n && (expanded ?? !!ui.sections[key]));
  const listId = $props.id();

  // The widgets open and close as Section's body: a one-row grid (1fr open, 0fr closed, by its
  // inert), its list clipped to that row and kept rendered; a toggle tweens
  // grid-template-rows, then hands back to CSS. The first render (and reduced motion) doesn't.
  let drawer = $state();
  let first = true;
  $effect(() => {
    const opening = open;
    untrack(() => {
      if (first || !drawer) return void (first = false);
      gsap.killTweensOf(drawer);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.fromTo(
        drawer,
        { gridTemplateRows: opening ? '0fr' : '1fr' },
        {
          gridTemplateRows: opening ? '1fr' : '0fr',
          duration: 0.25,
          ease: 'power2.out',
          onComplete: () => gsap.set(drawer, { clearProps: 'gridTemplateRows' }),
        },
      );
    });
  });
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
  {selected}
  {onselect}
  onenter={onsection}
>
  {#snippet over()}
    {#if asking}
      <!-- over the card at its size and corners: the question top left, Delete / Cancel bottom left -->
      <div
        class="ask"
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

  {#snippet foot()}
    <!-- [ Widgets ⌄ ] -->
    <div class="line">
      <button
        type="button"
        class="line__count"
        aria-expanded={open}
        aria-controls={n ? listId : undefined}
        disabled={!n}
        title={n ? (open ? 'Hide its widgets' : 'Show its widgets') : undefined}
        onclick={() => (ui.sections[key] = !open)}
      >
        {n ? 'Widgets' : 'No widgets'}
        {#if n}<i class="fa-solid fa-chevron-down line__caret" aria-hidden="true"></i>{/if}
      </button>
    </div>
    {#if n}
      <div class="drawer" bind:this={drawer} inert={!open}>
        <ul class="widgets" id={listId} aria-label="Widgets of {title}">
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
      </div>
    {/if}
  {/snippet}
</Section>

<style lang="scss">
  @use '../styles/mixins' as *;

  // ---- the card (Section.svelte, data-card): 12px inside on the sides (its bar and foot), the
  // count row 8px under the title row, the widgets 8px under it; the title on one line
  :global(.sec[data-card] > .sec__bar) {
    padding-inline: var(--space-3);
  }

  :global(.sec[data-card] .sec__foot) {
    gap: 0; // the widgets' 8px is inside their drawer, so it closes with them
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

  // [ Widgets ⌄ ]: 24px; the count without a fill or side padding, its text on the title's edge
  .line {
    @include row(var(--space-4));
    height: 24px;
  }

  .line__count {
    @include row(var(--space-2));
    @include muted;
    flex: none;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    font-size: var(--fs-sm);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: var(--c-text-strong);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  // open: its text brighter, the chevron up; empty: faint, inactive
  .line__count {
    &[aria-expanded='true'] {
      color: var(--c-text);
    }

    &:disabled {
      color: var(--c-text-faint);
      cursor: default;
    }
  }

  .line__caret {
    font-size: var(--fs-2xs);
    transition: rotate 0.15s;

    [aria-expanded='true'] > & {
      rotate: 180deg;
    }
  }

  // its widgets: 48px rows 4px apart, on the card's content edges (WidgetRow.svelte)
  .drawer {
    display: grid;
    grid-template-rows: 1fr;

    &[inert] {
      grid-template-rows: 0fr;
    }
  }

  .widgets {
    @include stack(var(--space-1));
    min-height: 0;
    overflow: hidden;
    margin: 0;
    padding: var(--space-2) 0 0;
    list-style: none;
  }

  // Delete?: over the card at its size (no shift): the card's colour at 80% hides what is
  // under it; the question at the top, Cancel / Delete at the bottom, 12px in
  // the card's confirm: over it at its size and corners (inside its red border), opaque, 8px in
  // on every side: 8 + 20 + 24 + 8 = 60px fits the 78px card (one line: never scrolls)
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
