<!--
  One page section's card in the Sections tab's list (SectionsList.svelte), not collapsible:
    title row  its title (its name, else "Section N", in its own casing; one line, cut with …), the unsaved dot after it;
               a click selects it, a double click opens its settings (onsection)
    its widgets always shown under the title (not collapsible): WidgetRow.svelte each, in their
               order (drag a row's grip to reorder, within the section; their grid areas stay); none:
               a dashed + Add widget (onadd; F12), else the title alone
  12px inside on every side. Its tools (+ Add widget, gear, move, ⋯) are the tab's section toolbar
  (SectionToolbar.svelte), for the selected card (Delete: its trash, at once; undo brings it
  back). A Ctrl/Cmd or Shift click adds it to the selected sections (ui.selSections).
    live, file, at (its index), peek (hovered in the preview)
    selected, onselect, onsection (its settings), onopen(widgetId)
    unsaved    overrides the unsaved dot (the mock kit)
    section    optional: show this section ({ id, name, widgets }) instead of file.sections[at]
               (the template editor: its one section, its rows titled by their roles)
    onreorder  optional: (from, to) when a row is dragged; the default moves a page widget
    onadd      optional: Add widget, shown in an empty section
    motion     optional (a page): its widgets' motion, in the same tree. { tree (page-motion.js
               motionSections: the preview's widgets and their animated elements), bridge, cfg,
               items, gsap, onlibrary }. Each row then shows its animation (a quiet tag, "none")
               and Replay; the selected widget's card holds its motion (WidgetMotion.svelte: the
               row stays its header, the ring goes round the whole card); a widget with animated
               elements (data-anim) has a chevron listing them under its card (kept open or closed
               in ui.sections['motion:els:<id>']), each with its own motion editor
               (MotionElements.svelte)
-->
<script>
  import { ui, selectWidgets, reveal, setAnchor, hotWidget } from './ui.svelte.js';
  import { range, selectedIds, toggle } from '../multi-select.js';
  import Collapsible from './Collapsible.svelte';
  import WidgetRow from './WidgetRow.svelte';
  import WidgetMotion from './WidgetMotion.svelte';
  import MotionElements from './MotionElements.svelte';
  import { listDrag, rowsOf } from './list-drag.svelte.js';
  import { moveWidget } from '../layout-ops.js';

  let {
    live,
    file,
    at,
    peek = false,
    selected = false,
    unsaved = undefined,
    onselect,
    onsection,
    onopen,
    section: sectionProp,
    onreorder,
    onadd = undefined,
    motion = null,
  } = $props();

  // this section in the preview (its widgets' elements), when it shows the page
  const shown = $derived(motion?.tree?.[at]);
  const elsKey = (id) => `motion:els:${id}`;

  /** A row's motion (WidgetRow's motion prop): its animation, Replay, its elements' chevron. */
  function motionOf(widget, j) {
    const w = shown?.widgets[j]?.id === widget.id ? shown.widgets[j] : null;
    return {
      w,
      animation: widget.motion?.animation || '',
      elements: !!w?.elements.length,
      expanded: !!ui.sections[elsKey(widget.id)],
      ontoggle: () => (ui.sections[elsKey(widget.id)] = !ui.sections[elsKey(widget.id)]),
      onreplay: () => w?.el && motion.bridge.replayOne(w.el),
    };
  }

  const s = $derived.by(() => {
    return sectionProp ?? (live.current(file)?.sections?.[at] || {});
  });
  const name = $derived((typeof s.name === 'string' && s.name.trim()) || '');
  const title = $derived(name || `Section ${at + 1}`);
  const widgets = $derived(Array.isArray(s.widgets) ? s.widgets : []);
  const n = $derived(widgets.length);
  const on = $derived(s.enabled !== false);

  // Reorder by drag (its grip; list-drag.svelte.js, as the cards had it before 6b47b06): only within this
  // section (its own list is the only one, so a drop elsewhere moves nothing). The order is the
  // widgets' array = DOM order (paint order at the same layer); their grid areas stay. A drag
  // is no click: the card's selection doesn't change. One undo step; the preview re-renders.
  let listEl = $state();
  const ld = listDrag({
    lists: () => (listEl ? [rowsOf(listEl, '[data-row]', 0)] : []),
    shape: () => widgets.map((widget) => widget.id).join(','),
    ondrop: (d) => {
      if (widgets[d.j]?.id !== d.id) return;
      if (onreorder) onreorder(d.j, d.over.to);
      else moveWidget(live.store, file, at, d.j, d.over.to);
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
      setAnchor(id);
      return selectWidgets(next);
    }
    if (e.shiftKey && ui.anchor && ids.includes(ui.anchor))
      return selectWidgets(range(ids, ui.anchor, id));
    setAnchor(id);
    // a click selects it (in the preview too, scrolled to when out of view); the pop-up swaps
    // to it when open (a double click opens it)
    selectWidgets([id]);
    reveal(id);
  }
</script>

<Collapsible
  id={s.id}
  {title}
  off={!on}
  unsaved={unsaved ??
    (s?.id ? live.changedItem(file, '/sections', s.id) : live.changed(file, `/sections/${at}`))}
  class={peek && !selected ? 'is-peek' : ''}
  foot={n ? list : onadd ? empty : undefined}
  {selected}
  {onselect}
  onenter={onsection}
></Collapsible>

{#snippet empty()}
  <button
    type="button"
    class="empty-add"
    onclick={(e) => {
      e.stopPropagation();
      onadd();
    }}><i class="fa-solid fa-plus" aria-hidden="true"></i>Add widget</button
  >
{/snippet}

{#snippet list()}
  <ul class="widgets" aria-label="Widgets of {title}" bind:this={listEl}>
    {#each widgets as widget, j (widget.id)}
      {@const mo = motion ? motionOf(widget, j) : null}
      <WidgetRow
        {widget}
        onopen={() => onopen(widget.id)}
        onselect={(e) => pick(e, widget.id)}
        open={ui.widget === widget.id || ui.multi.includes(widget.id)}
        {blocked}
        hot={ui.hot?.from === 'preview' && ui.hot.id === widget.id}
        onhover={(on) =>
          on ? hotWidget(widget.id, 'panel') : ui.hot?.id === widget.id && hotWidget(null, 'panel')}
        ongrab={(e) => ld.grab(e, { id: widget.id, j })}
        lifted={drag?.id === widget.id && drag.moving}
        dy={drag?.dy ?? 0}
        drop={ld.dropAt(j)}
        motion={mo}
        body={mo && ui.widget === widget.id && !ui.multi.length ? motionBody : undefined}
        after={mo?.expanded && mo.elements ? elements : undefined}
      />
      {#snippet motionBody()}
        {#key widget.id}
          <WidgetMotion
            {live}
            bridge={motion.bridge}
            gsap={motion.gsap}
            cfg={motion.cfg}
            {file}
            {at}
            {j}
            el={mo.w?.el}
            onlibrary={motion.onlibrary}
          />
        {/key}
      {/snippet}
      {#snippet elements()}
        <MotionElements
          {live}
          bridge={motion.bridge}
          cfg={motion.cfg}
          items={motion.items}
          gsap={motion.gsap}
          {file}
          sections={motion.tree}
          elements={mo.w.elements}
          base="/sections/{at}/widgets/{j}"
          nested
          onlibrary={motion.onlibrary}
        />
      {/snippet}
    {/each}
  </ul>
{/snippet}

<style lang="scss">
  @use '../styles/mixins' as *;

  // an empty section: how to fill it, the widget types (a small filled button)
  .empty-add {
    @include row(var(--space-2));
    justify-content: center;
    width: 100%;
    height: 32px;
    margin-bottom: var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--c-fill-hover);
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-sm);
    cursor: pointer;

    &:hover,
    &:focus-visible {
      background: var(--c-fill-active);
      color: var(--c-text-strong);
    }
  }

  // ---- the card (Collapsible.svelte, data-card): 12px inside on the sides (its bar and foot), the
  // widgets 8px under the title row; the title on one line
  :global(.collapsible[data-card] > .collapsible__bar) {
    padding-inline: var(--space-3);
  }

  :global(.collapsible[data-card] .collapsible__foot) {
    gap: 0;
    margin-top: 0;
    padding: var(--space-2) var(--space-3) 0;
  }

  :global(.collapsible[data-card] .collapsible__toggle--card > span) {
    @include ellipsis;
  }

  // a section card's title in its own casing ("Section 2", "Intro"), not uppercased; its size,
  // colour and tracking stay the bar's
  :global(.collapsible[data-section^='s-'] > .collapsible__bar) {
    text-transform: none;
  }

  // hidden: the title muted (Section's), its widgets dimmed; the buttons follow their own rule
  :global(.collapsible[data-card].is-off) .widgets {
    opacity: var(--o-dim);
  }

  // a lifted row is drawn over the card's edge (its clip would cut it otherwise)
  :global(.collapsible__clip:has(.is-lifted)) {
    overflow: visible;
  }

  .widgets {
    @include stack(var(--gap-rows));
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
