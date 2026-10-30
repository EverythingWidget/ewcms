<!--
  A dropdown instead of the native <select>: a button (role combobox) and a listbox in the top
  layer (a popover, so no panel or dialog clips it). Focus stays on the button; the active option
  is aria-activedescendant. Keys: Up/Down, Home/End, Enter/Space pick, Esc/Tab close, typing jumps.
  Props:
    value        the picked option's value: bind:value, or a value the parent updates on onchange
    options      [{ value, label, hint?, note?, disabled? }], or groups [{ group, options: [...] }]
                 (note: a line under the option, e.g. why it is off)
    placeholder  shown when no option has the value
    id           for <label for>; aria-label when there is no label
    onchange     (value, option) on a pick; with it the parent owns the value
    option       snippet (option) for an option's content; default: label + hint
    selected     snippet (option) for the button's content; default: label
    compact      a 24px button as wide as its value (a label row's picker), the list at least
                 200px wide
    search       a search field's placeholder: on, the list opens with the groups marked
                 { pinned: true } at its top, then the field (it takes the focus: typing filters the
                 other groups by label and hint, the matched letters in the accent, a group with
                 none hidden; the first result active, Enter picks it, ↑/↓ move, Esc closes),
                 then the other groups scrolling under them, each option its hint on a row under it
-->
<script>
  import { untrack } from 'svelte';

  let {
    value = $bindable(),
    options = [],
    placeholder = '',
    id,
    'aria-label': ariaLabel,
    onchange,
    option: optionSnippet,
    selected: selectedSnippet,
    compact = false,
    search = '',
  } = $props();

  const uid = $props.id();
  const listId = `${uid}-list`;

  let open = $state(false);
  let active = $state(-1); // index into flat
  let up = $state(false);
  let button = $state();

  const all = $derived(options.some((o) => o.options) ? options : [{ group: '', options }]);
  // searched: the pinned groups always, the others' options whose label or hint has the query
  let query = $state('');
  const q = $derived(search ? query.trim().toLowerCase() : '');
  const hits = (o) =>
    String(o.label).toLowerCase().includes(q) ||
    String(o.hint ?? '')
      .toLowerCase()
      .includes(q);
  const groups = $derived(
    q
      ? all
          .map((g) => (g.pinned ? g : { ...g, options: g.options.filter(hits) }))
          .filter((g) => g.options.length)
      : all,
  );
  const top = $derived(search ? groups.filter((g) => g.pinned) : []);
  const rest = $derived(search ? groups.filter((g) => !g.pinned) : groups);
  const flat = $derived([...top, ...rest].flatMap((g) => g.options));
  // a text cut around the query's first match: [before, match, after] (no match: [text])
  const cut = (text) => {
    const s = String(text ?? '');
    const at = q ? s.toLowerCase().indexOf(q) : -1;
    return at < 0 ? [s] : [s.slice(0, at), s.slice(at, at + q.length), s.slice(at + q.length)];
  };
  let input = $state();
  const current = $derived(flat.find((o) => o.value === value));
  const optionId = (i) => `${uid}-${i}`;

  /** Runs once when the list opens; untrack so hovering (which changes `active`) doesn't rerun it. */
  function show(list) {
    untrack(() => {
      list.showPopover();
      const r = button.getBoundingClientRect();
      const below = innerHeight - r.bottom - 8;
      up = below < Math.min(list.scrollHeight, 240) && r.top - 8 > below;
      place(list);
      reveal(active);
      input?.focus();
    });
  }

  /** Under the button (over it when up), as wide, at most as tall as the room there. */
  function place(list = document.getElementById(listId)) {
    if (!list) return;
    const r = button.getBoundingClientRect();
    Object.assign(list.style, {
      left: `${compact ? Math.max(8, r.right - Math.max(r.width, 200)) : r.left}px`,
      width: `${compact ? Math.max(r.width, 200) : r.width}px`,
      top: up ? 'auto' : `${r.bottom}px`,
      bottom: up ? `${innerHeight - r.top}px` : 'auto',
      maxHeight: `${Math.min(360, up ? r.top - 8 : innerHeight - r.bottom - 8)}px`,
    });
  }

  function openList(at = flat.indexOf(current)) {
    active = at >= 0 ? at : next(-1, 1);
    open = true;
  }

  // closed (a pick, Esc): the focus back on the button when it was in the search field
  function close() {
    const back = search && document.activeElement === input;
    open = false;
    query = '';
    if (back) button?.focus();
  }

  // typed in the search field: the first result active (none typed: the picked one)
  function onsearch() {
    const first = top.reduce((n, g) => n + g.options.length, 0);
    const at = q ? (first < flat.length ? first : -1) : flat.indexOf(current);
    active = at >= 0 || q ? at : next(-1, 1); // nothing matches: nothing outlined, Enter does nothing
    const scroll = document.getElementById(listId)?.querySelector('.sel__scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  // the focus left the button or the field: closed, unless it went from one to the other
  function blur(e) {
    const to = e.relatedTarget;
    if (to && (to === button || to === input)) return;
    open = false;
    query = '';
  }

  function pick(i) {
    const o = flat[i];
    close();
    if (!o || o.disabled) return;
    if (o.value === value) return;
    if (onchange) onchange(o.value, o);
    else value = o.value;
  }

  /** The next enabled option from i in direction dir (wraps around). */
  function next(i, dir) {
    for (let n = 1; n <= flat.length; n++) {
      const j = (i + dir * n + flat.length * n) % flat.length;
      if (!flat[j].disabled) return j;
    }
    return -1;
  }

  function hover(li) {
    const i = Number(li?.dataset.i);
    if (li && !flat[i].disabled) active = i;
  }

  function moveTo(i) {
    active = i;
    reveal(i);
  }

  /** Scrolls the list (only the list: scrollIntoView would scroll the panel too) to option i. */
  function reveal(i) {
    const li = document.getElementById(optionId(i));
    // (searching: the scrolling part; a pinned option never scrolls)
    const list = li?.closest('.sel__scroll, .sel__list');
    if (!li || li.closest('.sel__top')) return;
    if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop - 8;
    else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight + 8;
  }

  let typed = '';
  let typedAt = 0;
  /** Type-ahead: the next option whose label starts with what was typed in the last 0.5s. */
  function typeAhead(key) {
    typed = (Date.now() - typedAt > 500 ? '' : typed) + key.toLowerCase();
    typedAt = Date.now();
    const from = typed.length === 1 ? active : active - 1;
    for (let n = 1; n <= flat.length; n++) {
      const j = (from + n) % flat.length;
      if (!flat[j].disabled && String(flat[j].label).toLowerCase().startsWith(typed)) return j;
    }
    return -1;
  }

  function onkeydown(e) {
    const { key } = e;
    // searching: a letter typed on the button opens the list with it in the field
    if (
      search &&
      !open &&
      key.length === 1 &&
      key !== ' ' &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault();
      query = key;
      openList();
      onsearch();
      return;
    }
    if (search && e.currentTarget === input) {
      // the field's own keys: letters, Space, Home/End type; ↑/↓ move, Enter picks, Esc closes
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        e.preventDefault();
        moveTo(next(active, key === 'ArrowDown' ? 1 : -1));
      } else if (key === 'Enter') {
        e.preventDefault();
        pick(active);
      } else if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (key === 'Tab') close();
      return;
    }
    if (key.length === 1 && key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const j = typeAhead(key);
      if (j < 0) return;
      e.preventDefault();
      if (open) moveTo(j);
      else openList(j);
      return;
    }
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        e.preventDefault();
        openList();
      } else if (key === 'Home' || key === 'End') {
        e.preventDefault();
        openList(key === 'Home' ? next(-1, 1) : next(flat.length, -1));
      }
      return;
    }
    const to = {
      ArrowDown: () => next(active, 1),
      ArrowUp: () => next(active, -1),
      Home: () => next(-1, 1),
      End: () => next(flat.length, -1),
    }[key];
    if (to) {
      e.preventDefault();
      moveTo(to());
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      pick(active);
    } else if (key === 'Escape') {
      // close the list only: not the dialog or the editor's selection
      e.preventDefault();
      e.stopPropagation();
      open = false;
    } else if (key === 'Tab') {
      open = false;
    }
  }
</script>

<svelte:window
  onresize={() => (open = false)}
  onscrollcapture={(e) => open && !e.target.closest?.('[role="listbox"]') && place()}
/>

<button
  type="button"
  class={['sel', compact && 'is-compact', open && (up ? 'is-up' : 'is-down')]}
  {id}
  role="combobox"
  aria-label={ariaLabel}
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-controls={listId}
  aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
  bind:this={button}
  onclick={() => (open ? (open = false) : openList())}
  {onkeydown}
  onblur={search ? blur : () => (open = false)}
>
  <span class={['sel__value', !current && 'is-placeholder']}>
    {#if current && selectedSnippet}{@render selectedSnippet(current)}{:else}{current?.label ??
        placeholder}{/if}
  </span>
  <i class="fa-solid fa-chevron-down sel__caret" aria-hidden="true"></i>
</button>

{#snippet marked(text)}
  {#each cut(text) as part, k (k)}{#if k === 1}<mark class="sel__mark">{part}</mark
      >{:else}{part}{/if}{/each}
{/snippet}

{#snippet opts(list)}
  {#each list as g, gi (gi)}
    {#if g.group}<li class="sel__group" role="presentation">{g.group}</li>{/if}
    {#each g.options as o (o.value)}
      {@const i = flat.indexOf(o)}
      <li
        id={optionId(i)}
        role="option"
        class={['sel__opt', i === active && 'is-active', search && o.hint && 'is-two']}
        aria-selected={o.value === value}
        aria-disabled={o.disabled || undefined}
        data-i={i}
      >
        {#if optionSnippet}{@render optionSnippet(o)}{:else if search}
          <span class="sel__title">{@render marked(o.label)}</span>{#if o.hint}<span
              class="sel__path">{@render marked(o.hint)}</span
            >{/if}
        {:else}
          {o.label}{#if o.hint}<span class="sel__hint">{o.hint}</span>{/if}
        {/if}
        {#if o.note}<span class="sel__note">{o.note}</span>{/if}
      </li>
    {/each}
  {/each}
{/snippet}

{#if open && search}
  <!-- searching: the pinned options and the field stay at the top, the rest scrolls under
       them; the field has the focus and the keys (the button's aria-activedescendant moves to it) -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="sel__list sel__list--search"
    id={listId}
    role="listbox"
    tabindex="-1"
    popover="manual"
    {@attach show}
    onpointerdown={(e) => e.target !== input && e.preventDefault()}
    onpointermove={(e) => hover(e.target.closest('[role="option"]'))}
    onclick={(e) => {
      const li = e.target.closest('[role="option"]');
      if (li) pick(Number(li.dataset.i));
    }}
  >
    <div class="sel__top">
      {#if top.length}<ul class="sel__pinned" role="presentation">{@render opts(top)}</ul>{/if}
      <label class="sel__search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input
          type="text"
          class="sel__input"
          placeholder={search}
          aria-label={search}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          autocomplete="off"
          spellcheck="false"
          bind:this={input}
          bind:value={query}
          oninput={onsearch}
          {onkeydown}
          onblur={blur}
        />
      </label>
    </div>
    <ul class="sel__scroll" role="presentation">
      {@render opts(rest)}
      {#if q && !rest.length}<li class="sel__none" role="presentation">Nothing matches</li>{/if}
    </ul>
  </div>
{:else if open}
  <!-- The button keeps the focus (a press on the list doesn't take it) and handles the keys. -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <ul
    class="sel__list"
    id={listId}
    role="listbox"
    popover="manual"
    {@attach show}
    onpointerdown={(e) => e.preventDefault()}
    onpointermove={(e) => hover(e.target.closest('[role="option"]'))}
    onclick={(e) => {
      const li = e.target.closest('[role="option"]');
      if (li) pick(Number(li.dataset.i));
    }}
  >
    {@render opts(groups)}
  </ul>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .sel {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    @include row(var(--space-2));
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    line-height: 16px;
    text-align: left;
    cursor: pointer;
    background: var(--field-bg);
    box-shadow: inset 0 0 0 1px var(--c-line);
    outline: none;
    transition: box-shadow 0.2s;

    &:focus-visible {
      box-shadow: var(--focus-ring);
    }

    &.is-down {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    &.is-up {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }

    // in a label row: 24px, its value's width (at most 70% of the row), the list under it
    // right-aligned (place())
    &.is-compact {
      flex: 0 1 auto;
      gap: var(--space-1);
      width: auto;
      max-width: 100%;
      height: 24px;
      padding: 0 var(--space-2);
      border-radius: var(--radius-md);
      color: inherit;
      font-size: var(--fs-sm);

      .sel__value {
        flex: 0 1 auto;
      }

      .sel__caret {
        font-size: var(--fs-2xs);
      }
    }
  }

  .sel__value {
    flex: 1;
    min-width: 0;
    @include ellipsis;

    &.is-placeholder {
      color: var(--c-text-muted);
    }
  }

  .sel__caret {
    flex: none;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }

  // the list: in the top layer, placed under (or over) the button by show()
  .sel__list {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: var(--space-2);
    border: 0;
    list-style: none;
    overflow: auto;
    overscroll-behavior: contain;
    color: var(--c-text);
    background: var(--c-surface);
    box-shadow: var(--focus-ring);
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    font-family: var(--f-mono);
    font-size: var(--fs-base);
    font-weight: 400;
    line-height: 16px;
  }

  // searching: a column, the top (pinned options, the field) fixed, the rest scrolling
  .sel__list--search {
    display: flex;
    flex-direction: column;
    overflow: hidden;

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
  }

  .sel__top {
    flex: none;
  }

  .sel__scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }

  // the search field: a filled 32px row, its icon and placeholder muted
  .sel__search {
    @include row(var(--space-2));
    height: var(--size-control);
    margin: var(--space-2) 0;
    padding: 0 var(--space-3);
    border-radius: var(--radius-md);
    background: var(--c-fill-active);
    color: var(--c-text-muted);
    cursor: text;
  }

  .sel__input {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    outline: 0;
    background: none;
    color: var(--c-text);
    font: inherit;

    &::placeholder {
      color: var(--c-text-muted);
    }
  }

  // an option with its hint: the title (12px) and its path or file under it (10px, muted),
  // every such row as tall
  .sel__opt.is-two {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }

  .sel__title,
  .sel__path {
    @include ellipsis;
  }

  .sel__path {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 16px;
  }

  // the query's letters
  .sel__mark {
    background: none;
    color: var(--c-accent);
  }

  .sel__none {
    padding: var(--space-2) var(--space-3);
    color: var(--c-text-muted);
  }

  .is-up + .sel__list {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  .sel__group {
    padding: var(--space-2) var(--space-3) var(--space-1);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--c-text-faint);
  }

  .sel__opt {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    cursor: pointer;

    &[aria-selected='true'] {
      background: color-mix(in srgb, var(--c-accent) 12%, var(--c-surface));
    }

    &.is-active {
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }

    &[aria-disabled='true'] {
      opacity: var(--o-disabled);
      cursor: default;
    }
  }

  .sel__hint {
    margin-left: auto;
    color: var(--c-text-muted);
  }

  // why an option is off: a muted paragraph under it, the option's width
  .sel__opt:has(.sel__note) {
    flex-wrap: wrap;
  }

  .sel__note {
    flex-basis: 100%;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    white-space: normal;
  }
</style>
