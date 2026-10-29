<!--
  Tabs: the editor's one tab look, every tab bar uses it (the modes, the page tabs, the widget
  card, the Motion panel, the Media filter): a row of uppercase labels (600, so no width change)
  over a 2px line its full width; the picked one white with a 2px white underline, the others
  dim. Only the color and the underline (inset shadows) change, so picking one moves nothing. The line runs to the container's edges: put it where it should
  span (WidgetInspector's card has no side padding around it). A tab's text starts 12px in.
    tabs    [[value, label]]
    value   the picked one
    onpick  (value) => ...
    label   the group's aria-label
    role    'tablist' (they switch a panel; role=tab, aria-selected), 'group' (a view filter;
            aria-pressed) or 'navigation' (the modes: a <nav>, aria-current="page")
    fill    true: the tabs share the row evenly (the modes); else each its label's width
    class   extra class on the row
    id      the tabs' ids are "<id>-<value>" (tablist: the panel's aria-labelledby)
    panel   the id of the panel they switch (tablist: aria-controls)
  A tablist is one Tab stop: ←/→ (Home/End) move to the next tab and pick it.
  Used by the modes (App.svelte: Content / Motion / Settings), the page tabs (ContentPanel), the
  widget card (Content / Motion), the Motion panel (Elements / Animations) and the Media
  window's filter (All / R2 / Local). Segmented value pickers (.seg) are not tabs.
-->
<script>
  let {
    tabs,
    value,
    onpick,
    label,
    role = 'tablist',
    class: cls = '',
    id: idProp = '',
    panel = undefined,
    fill = false,
  } = $props();
  const uid = $props.id();
  const id = $derived(idProp || uid);
  const isTab = $derived(role === 'tablist');
  const isNav = $derived(role === 'navigation');

  function onkeydown(e) {
    if (!isTab) return;
    const at = tabs.findIndex(([v]) => v === value);
    const n = tabs.length;
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const [v] = tabs[(to + n) % n];
    onpick(v);
    e.currentTarget.querySelector(`#${CSS.escape(`${id}-${v}`)}`)?.focus();
  }
</script>

<svelte:element
  this={isNav ? 'nav' : 'div'}
  class={['tabs', fill && 'tabs--fill', cls]}
  role={isNav ? undefined : role}
  aria-label={label}
  {onkeydown}
>
  {#each tabs as [v, text] (v)}
    <button
      type="button"
      id="{id}-{v}"
      role={isTab ? 'tab' : undefined}
      aria-selected={isTab ? value === v : undefined}
      aria-controls={isTab ? panel : undefined}
      tabindex={isTab && value !== v ? -1 : undefined}
      aria-pressed={isTab || isNav ? undefined : value === v}
      aria-current={isNav && value === v ? 'page' : undefined}
      class={['tabs__btn', value === v && 'is-active']}
      onclick={() => onpick(v)}>{text}</button
    >
  {/each}
</svelte:element>

<style lang="scss">
  @use '../styles/mixins' as *;

  .tabs {
    display: flex;
    box-shadow: inset 0 -2px 0 var(--c-tab-line);
  }

  .tabs--fill .tabs__btn {
    flex: 1;
    padding: 0;
  }

  .tabs__btn {
    height: 32px;
    padding: 0 var(--space-3);
    border: 0;
    background: none;
    cursor: pointer;
    @include muted;
    color: var(--text-quiet, var(--c-text-muted));
    font-weight: 600; // every tab: no width change when picked
    letter-spacing: 0.06em;
    line-height: 16px;
    text-transform: uppercase;
    white-space: nowrap;
    transition:
      color 0.2s,
      box-shadow 0.2s;

    &:hover {
      color: var(--text-strong, var(--c-text));
    }

    &:focus-visible {
      @include focus-ring;
      color: var(--text-strong, var(--c-text));
    }

    &.is-active {
      color: var(--c-text-strong);
      box-shadow: inset 0 -2px 0 var(--c-text-strong);
    }
  }
</style>
