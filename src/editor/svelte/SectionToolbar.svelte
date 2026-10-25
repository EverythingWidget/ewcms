<!--
  The Sections & Widgets tab's toolbar for the selected section card (ui.selSection), a row
  right under the tab line, outside the scrolling body (it never scrolls away and, with no
  fill of its own, never covers the panel's inset border), its line under it as the tab line's:
    [ + Add widget                    pen  ↑  ↓  ⋯ ]
    [ + Add widget                    pen  ↑  ↓  trash  ⋯ ]
  pen: the section's settings (onsection, as a double click on its card); ↑ / ↓ move it (off
  on the first / last); trash deletes it at once (one undo step brings it back); ⋯ a menu in the
  top layer: Hide / Show section, Duplicate. Add widget (onadd(at)) is off while the section is
  hidden, and only there while a section is selected.
  Two or more sections selected (ui.selSections: Ctrl/Cmd or Shift click on their cards):
    [ 3 sections                                       trash ]
  Delete removes them all, one undo step.
  No section selected: "Select a section…" (muted) instead, the row's height the same.
  Two or more widgets selected (ui.multi, multi-select.js): widget mode, what they share:
    [ 3 widgets                 eye  copy  layer↓  layer↑  trash ]
  each one undo step for all of them (Delete too: undo brings them back); the same 40px row.
  One widget selected (ui.widget): its actions, as its row had them, and its settings:
    [ Button                gear  locate  eye  copy  trash ]
  gear: its pop-up (as a double click on it, ui.popup). Its layer: in the pop-up, keys [ ].
    live, file, bridge, onsection(id), onadd(at)
-->
<script>
  import Button from './Button.svelte';
  import { ui, selectWidgets, selectSection } from './ui.svelte.js';
  import { locate } from '../locate.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import {
    duplicateSection,
    duplicateWidgets,
    layerWidgets,
    moveSection,
    removeSections,
    removeWidgets,
    showWidgets,
    toggleSection,
  } from '../layout-ops.js';

  let { live, file, bridge, onsection, onadd } = $props();

  const sections = $derived.by(() => {
    live.version;
    const list = live.current(file)?.sections;
    return Array.isArray(list) ? list : [];
  });
  const at = $derived(ui.selSection ? sections.findIndex((s) => s?.id === ui.selSection) : -1);
  const s = $derived(at < 0 ? null : sections[at]);
  const title = $derived((s && typeof s.name === 'string' && s.name.trim()) || `Section ${at + 1}`);
  const on = $derived(s?.enabled !== false);

  // ---- the ⋯ menu (a popover): under ⋯, its right edge on it
  const uid = $props.id();
  const menuId = `${uid}-more`;
  let menu = $state();
  let menuOpen = $state(false);
  function placeMenu(e) {
    menuOpen = e.newState === 'open';
    if (!menuOpen) return;
    const r = document.getElementById(`${menuId}-btn`)?.getBoundingClientRect();
    if (!r) return;
    menu.style.top = `${Math.round(r.bottom + 4)}px`;
    menu.style.left = `${Math.round(r.right - 200)}px`;
  }
  function pick(act) {
    menu?.hidePopover();
    act();
  }
  const move = (to) => moveSection(live.store, file, at, to);
  // several sections selected: the ones still on the page
  const many = $derived(ui.selSections.filter((id) => sections.some((x) => x?.id === id)));
  function removeSelected(ids) {
    if (removeSections(live.store, file, ids)) selectSection(null);
  }

  // ---- widget mode: one widget selected, or several (all in one section)
  const group = $derived.by(() => {
    const ids = ui.multi.length > 1 ? ui.multi : ui.widget ? [ui.widget] : [];
    if (!ids.length) return null;
    for (const [k, sec] of sections.entries()) {
      const widgets = (sec?.widgets || []).filter((b) => ids.includes(b?.id));
      if (widgets.length) return { at: k, ids: widgets.map((b) => b.id), widgets };
    }
    return null;
  });
  const allOff = $derived(!!group?.widgets.every((b) => b?.config?.enabled === false));
  const run = (fn, ...rest) => group && fn(live.store, file, group.at, group.ids, ...rest);
  function removeGroup() {
    run(removeWidgets);
    selectWidgets([]);
  }
  const one = $derived(group?.ids.length === 1);
  const oneLabel = $derived(
    one ? WIDGET_TYPES[group.widgets[0]?.type]?.label || group.widgets[0]?.type || 'Widget' : '',
  );
  const them = $derived(one ? 'it' : 'them');
  function duplicateGroup() {
    const copies = run(duplicateWidgets);
    if (copies?.length) selectWidgets(copies);
  }
</script>

<div
  class="stb"
  role="toolbar"
  aria-label={group ? 'Selected widgets' : many.length > 1 ? 'Selected sections' : 'Section'}
>
  {#if many.length > 1 && !group}
    <p class="stb__count">{many.length} sections</p>
    <span class="stb__gap"></span>
    <Button
      size="small"
      icon="trash"
      iconOnly
      label="Delete {many.length} sections"
      onclick={() => removeSelected(many)}
    />
  {:else if group}
    <p class="stb__count">{one ? oneLabel : `${group.ids.length} widgets`}</p>
    <span class="stb__gap"></span>
    {#if one}
      <Button
        size="small"
        icon="gear"
        iconOnly
        label="Settings of {oneLabel}"
        title="Settings (or double-click it)"
        onclick={() => {
          ui.popup = true;
          ui.widgetTab = 'content';
        }}
      />
      <Button
        size="small"
        icon="location-crosshairs"
        iconOnly
        label="Show it in the preview"
        onclick={() => locate(bridge, group.ids[0])}
      />
    {/if}
    <Button
      size="small"
      icon={allOff ? 'eye-slash' : 'eye'}
      iconOnly
      label={allOff ? `Show ${them}` : `Hide ${them}`}
      title={allOff ? `Hidden: click to show ${them}` : `Visible: click to hide ${them}`}
      onclick={() => run(showWidgets, allOff)}
    />
    <Button size="small" icon="copy" iconOnly label="Duplicate {them}" onclick={duplicateGroup} />
    <!-- layers: several only (one widget's are in its pop-up, and keys [ ]) -->
    {#if !one}
      <Button
        size="small"
        icon="angles-down"
        iconOnly
        label="One layer down"
        onclick={() => run(layerWidgets, -1)}
      />
      <Button
        size="small"
        icon="angles-up"
        iconOnly
        label="One layer up"
        onclick={() => run(layerWidgets, 1)}
      />
    {/if}
    <Button size="small" icon="trash" iconOnly label="Delete {them}" onclick={removeGroup} />
  {:else if s}
    <button
      type="button"
      class="stb__add"
      aria-haspopup="dialog"
      aria-label="Add widget to {title}"
      disabled={!on}
      onclick={() => onadd(at)}
    >
      <i class="fa-solid fa-plus" aria-hidden="true"></i>Add widget
    </button>
    <span class="stb__gap"></span>
    <Button
      size="small"
      icon="pen-to-square"
      iconOnly
      label="Edit {title}"
      onclick={() => onsection(s.id)}
    />
    <Button
      size="small"
      icon="arrow-up"
      iconOnly
      label="Move {title} up"
      disabled={at === 0}
      onclick={() => move(at - 1)}
    />
    <Button
      size="small"
      icon="arrow-down"
      iconOnly
      label="Move {title} down"
      disabled={at === sections.length - 1}
      onclick={() => move(at + 1)}
    />
    <Button
      size="small"
      icon="trash"
      iconOnly
      label="Delete {title}"
      onclick={() => removeSelected([s.id])}
    />
    <Button
      size="small"
      icon="ellipsis"
      iconOnly
      label="More for {title}"
      id="{menuId}-btn"
      popovertarget={menuId}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      data-open={menuOpen || undefined}
    />
  {:else}
    <p class="stb__hint">Select a section…</p>
  {/if}
</div>

<!-- in the top layer (not cut by the panel); a click outside or Esc closes it -->
<div
  class={['more', menuOpen && 'is-open']}
  id={menuId}
  popover="auto"
  role="menu"
  aria-label={title}
  bind:this={menu}
  onbeforetoggle={placeMenu}
  ontoggle={(e) => (menuOpen = e.newState === 'open')}
>
  {#if s}
    <button
      type="button"
      role="menuitem"
      class="more__opt"
      onclick={() => pick(() => toggleSection(live.store, file, at))}
      ><i class="fa-solid fa-{on ? 'eye-slash' : 'eye'}" aria-hidden="true"></i><span
        >{on ? 'Hide section' : 'Show section'}</span
      ></button
    >
    <button
      type="button"
      role="menuitem"
      class="more__opt"
      onclick={() => pick(() => duplicateSection(live.store, file, at))}
      ><i class="fa-solid fa-copy" aria-hidden="true"></i><span>Duplicate</span></button
    >
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // 40px (8 + 24 + 8) in both states; 12px edges as the body's; borderless: its own shade
  // (--c-panel-bar), no line under it
  .stb {
    @include row(var(--space-1));
    flex: none;
    height: 40px;
    padding: 0 var(--space-3);
    background: var(--c-panel-bar); // borderless: a shade, no line under it
  }

  // the selected widgets' count, in the widgets' accent, as the hint's type
  .stb__count {
    margin: 0;
    color: var(--c-widget-accent);
    font-size: var(--fs-sm);
    letter-spacing: 0.1em;
    line-height: 24px;
    text-transform: uppercase;
  }

  .stb__gap {
    flex: 1;
  }

  .stb__hint {
    @include muted;
    margin: 0;
    font-size: var(--fs-sm);
    letter-spacing: 0.1em;
    line-height: 24px;
    text-transform: uppercase;
  }

  // the cards' former + Add widget (text only, no side padding: on the 12px edge)
  .stb__add {
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

    &:disabled {
      opacity: var(--o-disabled);
      cursor: default;
    }
  }

  // ---- the ⋯ menu: the toolbar's list menu (WidgetToolbar.svelte's .btb__pop.is-list), 200px
  .more {
    @include stack(0);
    position: fixed;
    inset: auto;
    width: 200px;
    margin: 0;
    padding: var(--space-1);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--c-card);
    color: var(--c-text);
    box-shadow:
      inset 0 0 0 1px var(--c-line),
      0 8px 24px var(--black-a40);
  }

  .more:not(.is-open) {
    display: none;
  }

  .more__opt {
    @include row(var(--space-2));
    width: 100%;
    min-height: 32px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    text-align: left;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      background: var(--c-control-hover);
    }

    &:focus-visible {
      @include focus-ring;
    }

    > span {
      flex: 1;
    }
  }
</style>
