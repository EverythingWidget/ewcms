<!--
  Add widget: a modal of the widget types, a tile each (a sketch of the widget, its icon, name and
  one line, all from the registry). A search filters them; the pointer or the arrow keys pick
  one (a 2px accent ring: nothing moves), Enter or a click adds it, Esc or the backdrop closes.
  Mounted once in App.svelte; a section's dashed Add widget button (SectionsList.svelte, the
  template editor's) opens it with openWidgets({ at, types, onpick }) (modals.svelte.js), which
  appends the widget to that section and opens it.
    at      the section index the widget goes to
    types   [{ value, label, icon, line, sketch }] the widget types on offer (the registry's)
    onpick  (type, at) => …
-->
<script module>
  const COLS = 5;
  // a sketch with no drawing: two plain lines
  const PLAIN = ['w70 h8', 'w50 h4'];
</script>

<script>
  import { closeOnBackdrop } from '../lib/modal.js';
  import { tick } from 'svelte';
  import Button from './Button.svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import { argsOf, closeModal, modal } from './modals.svelte.js';
  import { widgetType } from '../../widgets/index.js';

  let dialog = $state();
  let query = $state('');
  let active = $state(0);
  const args = $derived(argsOf('widgets'));
  const at = $derived(args?.at ?? 0); // the section the widget goes to
  const types = $derived(args?.types || []);

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return types;
    return types.filter((t) => `${t.label} ${t.line || ''}`.toLowerCase().includes(q));
  });

  /** Shown (openWidgets): the search empty, on the first tile. */
  async function onopen() {
    query = '';
    active = 0;
    await tick();
    dialog.querySelector('.widgets-search')?.focus();
  }

  function pick(t) {
    const { onpick } = args;
    dialog.querySelector('.widgets-search')?.blur();
    closeModal('widgets');
    onpick(t.value, at);
  }

  async function focusTile() {
    await tick();
    dialog.querySelectorAll('.widgets-tile')[active]?.focus();
  }

  function onkeydown(e) {
    const n = shown.length;
    if (!n) return;
    const inSearch = e.target.classList?.contains('widgets-search');
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
    if (step) {
      if (inSearch && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; // the caret
      e.preventDefault();
      if (inSearch && e.key === 'ArrowUp') return;
      const next = inSearch ? active : active + step;
      if (next < 0 || next >= n) {
        if (e.key === 'ArrowUp') dialog.querySelector('.widgets-search')?.focus();
        return;
      }
      active = next;
      focusTile();
    } else if (e.key === 'Enter' && inSearch) {
      e.preventDefault();
      pick(shown[Math.min(active, n - 1)]);
    }
  }
</script>

<!-- a widget's sketch: grey shapes, 2:1; `name` is its definition's `sketch` (not its type), the
  drawing that type's (its definition's `drawing`, src/widgets/index.js), else two plain lines -->
{#snippet sketch(name)}
  <span class="widgets-sk widgets-sk--{name}" aria-hidden="true">
    {#each widgetType(name)?.drawing ?? PLAIN as shape, i (i)}
      {#if typeof shape === 'string'}<b class={shape}></b>
      {:else}<span class="g g{shape.grid}"
          >{#each Array(shape.grid) as _, k (k)}<b></b>{/each}</span
        >
      {/if}
    {/each}
  </span>
{/snippet}

<dialog
  class="modal__box widgets-modal"
  aria-label="Add widget to section {at + 1}"
  bind:this={dialog}
  {@attach closeOnBackdrop}
  {@attach modal('widgets', { onopen })}
  {onkeydown}
>
  <ExplorerHead
    title="Add widget to Section {at + 1}"
    icon="fa-plus"
    crumbs={[{ label: 'after its last widget' }]}
    onclose={() => closeModal('widgets')}
  />
  <div class="widgets-body">
    <input
      class="tf__input widgets-search"
      type="search"
      placeholder="Search widgets"
      aria-label="Search widgets"
      bind:value={query}
      oninput={() => (active = 0)}
    />
    {#if shown.length}
      <ul class="widgets-tiles" role="listbox" aria-label="Widget types">
        {#each shown as t, i (t.value)}
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              class={['widgets-tile', i === active && 'is-active']}
              tabindex={i === active ? 0 : -1}
              onpointerenter={() => (active = i)}
              onfocus={() => (active = i)}
              onclick={() => pick(t)}
            >
              {@render sketch(t.sketch)}
              <span class="widgets-tile__name"
                ><i class="fa-solid fa-{t.icon}" aria-hidden="true"></i>{t.label}</span
              >
              <span class="widgets-tile__line">{t.line || ''}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="hint">No widget matches “{query}”.</p>
    {/if}
  </div>
  <footer class="widgets-foot">
    <span class="hint small">Click or Enter adds it to Section {at + 1} · arrows pick</span>
    <Button size="small" onclick={() => closeModal('widgets')}>Cancel</Button>
  </footer>
</dialog>

<style lang="scss">
  @use '../styles/mixins' as *;

  dialog.widgets-modal {
    width: min(1000px, 92vw);
    height: min(760px, calc(100vh - 48px));
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: 0;
    overflow: hidden;

    &:not([open]) {
      display: none;
    }
  }

  .widgets-body {
    @include stack(var(--space-3));
    align-content: start;
    padding: var(--space-4);
    overflow: auto;
  }

  .widgets-search {
    height: 32px;
  }

  .widgets-foot {
    @include row(var(--space-3));
    justify-content: space-between;
    height: 56px;
    padding: 0 var(--space-4);
    border-top: 1px solid var(--c-line);

    .hint {
      margin: 0;
    }
  }

  .widgets-tiles {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  // the picked one: a ring (a shadow), so nothing moves or grows
  .widgets-tile {
    @include stack(var(--space-1));
    width: 100%;
    padding: var(--space-2) var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--c-control);
    box-shadow: inset 0 0 0 1px var(--c-line);
    color: var(--c-text);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &.is-active {
      box-shadow: 0 0 0 2px var(--c-accent);
    }

    &:focus-visible {
      outline: none;
    }
  }

  .widgets-tile__name {
    @include row(var(--space-2));
    margin-top: var(--space-1);
    font-weight: 500;

    i {
      width: 16px;
      color: var(--c-accent);
      text-align: center;
    }
  }

  .widgets-tile__line {
    min-height: 32px;
    @include muted;
    line-height: 16px;
  }

  .widgets-sk {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    aspect-ratio: 2 / 1;
    padding: 8px 12px;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--c-surface);

    b {
      display: block;
      border-radius: 1px;
      background: var(--c-fill-active);
    }

    .w40 {
      width: 40%;
    }
    .w50 {
      width: 50%;
    }
    .w60 {
      width: 60%;
    }
    .w70 {
      width: 70%;
    }
    .w90 {
      width: 90%;
    }
    .h4 {
      height: 4px;
    }
    .h8 {
      height: 8px;
    }
    .h12 {
      height: 12px;
    }
    .h16 {
      height: 16px;
    }

    .img {
      flex: 1;
      width: 100%;
    }

    .box {
      background: none;
      box-shadow: inset 0 0 0 1px var(--c-fill-active);
    }

    .pill {
      align-self: center;
      width: 40%;
      height: 16px;
      border-radius: 999px;
    }

    .g {
      @include stack(4px);
      height: 100%;

      b {
        height: 100%;
      }
    }

    .g3 {
      grid-template-columns: repeat(3, 1fr);
    }

    .sc {
      position: absolute;
      width: 16%;
      aspect-ratio: 3 / 4;
    }

    .s1 {
      top: 12%;
      left: 8%;
    }
    .s2 {
      top: 8%;
      right: 10%;
    }
    .s3 {
      bottom: 8%;
      left: 40%;
    }

    .mid {
      position: relative;
      align-self: center;
      background: var(--c-text-faint);
    }
  }

</style>
