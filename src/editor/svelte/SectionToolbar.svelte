<!--
  The Sections & Widgets tab's toolbar for the selected section card (ui.selSection), a row
  right under the tab line, outside the scrolling body (it never scrolls away and, with no
  fill of its own, never covers the panel's inset border), its line under it as the tab line's:
    [ + Add widget                    pen  ↑  ↓  ⋯ ]
  pen: the section's settings (onsection, as a double click on its card); ↑ / ↓ move it (off
  on the first / last); ⋯ a menu in the top layer: Hide / Show section, Duplicate, Delete (red;
  asks over its card: `deleting`). Add widget (onadd(at)) is off while the section is hidden.
  No section selected: "Select a section…" (muted) instead, the row's height the same.
    live, file, onsection(id), onadd(at), deleting (bindable)
-->
<script>
  import Button from './Button.svelte';
  import { ui } from './ui.svelte.js';
  import { duplicateSection, moveSection, toggleSection } from '../layout-ops.js';

  // (deleting is only set here, read by the card asking: SectionCard.svelte)
  // eslint-disable-next-line no-useless-assignment
  let { live, file, onsection, onadd, deleting = $bindable('') } = $props();

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
</script>

<div class="stb" role="toolbar" aria-label="Section">
  {#if s}
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
    <hr class="more__sep" />
    <button
      type="button"
      role="menuitem"
      class="more__opt more__del"
      onclick={() => pick(() => (deleting = s.id))}
      ><i class="fa-solid fa-trash" aria-hidden="true"></i><span>Delete</span></button
    >
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // 40px (8 + 24 + 8) in both states; 12px edges as the body's; no fill (the panel's shows,
  // its border too); the line under it as the tab line's
  .stb {
    @include row(var(--space-1));
    flex: none;
    height: 40px;
    padding: 0 var(--space-3);
    box-shadow: inset 0 -1px 0 var(--c-line);
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

  .more__sep {
    width: 100%;
    height: 1px;
    margin: var(--space-1) 0;
    border: 0;
    background: var(--c-line);
  }

  .more__del {
    color: var(--c-error);
  }
</style>
