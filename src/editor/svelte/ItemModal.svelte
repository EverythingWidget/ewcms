<!--
  The item modal of a source field (SourceField.svelte): a window to pick a source (mode
  source) or a source, then one of its items (mode item), with a search. Mounted once in
  App.svelte; the field opens it with openItemModal({ mode, value, none, sourceIds, itemsOf,
  nameOf, onpick, onsource, label }) (modals.svelte.js; the props as SourceField's), optionally
  with at (the source to open on) and id (the row to focus).
  Each row's edit button opens Sources (onsource: SourcesModal.svelte) on top of this
  window; closing it brings this window back as it was.
-->
<script>
  import { closeOnBackdrop } from '../lib/modal.js';
  import { tick } from 'svelte';
  import Button from './Button.svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import ExplorerRow from './ExplorerRow.svelte';
  import { argsOf, closeModal, modal } from './modals.svelte.js';

  const args = $derived(argsOf('itemModal') || {});
  const items_ = $derived((args.mode ?? 'item') === 'item');
  const value = $derived(args.value);
  const none = $derived(args.none === undefined ? 'None' : args.none);
  const itemsOf = (id) => args.itemsOf?.(id) || [];
  const nameOf = (id, it) => args.nameOf?.(id, it) || '';
  const onsource = $derived(args.onsource);
  const label = $derived(args.label || (items_ ? 'Source item' : 'Source list'));
  const current = $derived(items_ ? value?.source || '' : value || '');
  let dialog = $state();
  let source = $state(''); // the source open in the list ('' = the list of sources)
  let query = $state('');

  const q = $derived(query.trim().toLowerCase());
  const sources = $derived(
    (args.sourceIds || []).filter((id) => !q || id.toLowerCase().includes(q)),
  );
  const items = $derived(
    source
      ? itemsOf(source)
          .map((it, i) => ({ it, i, name: nameOf(source, it) }))
          .filter((r) => !q || r.name.toLowerCase().includes(q))
      : [],
  );

  async function focus(id = '') {
    await tick();
    const row = id && dialog.querySelector(`[data-pick="${CSS.escape(id)}"]`);
    (
      row ||
      dialog.querySelector('.xrow.is-selected') ||
      dialog.querySelector('.item-search')
    )?.focus();
  }
  /** Shown: on the current source's items (a widget's item), else on the sources. */
  function onopen() {
    const at = args.at ?? (items_ ? current : '');
    source = items_ ? at : '';
    query = '';
    focus(args.id || (!items_ ? at : ''));
  }
  function enter(id) {
    source = id;
    query = '';
    focus();
  }
  function pick(next) {
    const { onpick } = args;
    closeModal('itemModal');
    onpick(next);
  }
  // edit a source (index -1: its list) or one of its items in Sources, on top
  const edit = (id, index = -1) => onsource(`sources/${id}.json`, Math.max(0, index));
</script>

{#snippet row(props, editLabel, onedit)}
  <div class="item-row">
    <ExplorerRow {...props} />
    {#if onsource}
      <Button size="small" icon="pen-to-square" iconOnly label={editLabel} onclick={onedit} />
    {/if}
  </div>
{/snippet}

<dialog
  class="modal__box item-modal"
  aria-label={label}
  bind:this={dialog}
  {@attach closeOnBackdrop}
  {@attach modal('itemModal', { onopen })}
>
  <ExplorerHead
    title={label}
    icon="fa-database"
    crumbs={[
      { label: 'Sources', onclick: source ? () => enter('') : undefined },
      ...(source ? [{ label: `${source}.json` }] : []),
    ]}
    sep="/"
    back={source ? 'Back to sources' : ''}
    onback={() => enter('')}
    onclose={() => closeModal('itemModal')}
  />
  <div class="item-body">
    <input
      class="tf__input item-search"
      type="search"
      placeholder={source ? 'Search items' : 'Search sources'}
      aria-label="Search"
      bind:value={query}
    />
    <div class="item-list">
      {#if !source}
        {#if none !== null}
          <ExplorerRow
            icon="fa-ban"
            name={none}
            meta={items_ ? 'No item: the widget settings show their own text' : 'No source'}
            selected={!current}
            onclick={() => pick(undefined)}
          />
        {/if}
        {#each sources as id (id)}
          {@render row(
            {
              icon: 'fa-database',
              name: `${id}.json`,
              meta: `${itemsOf(id).length} items`,
              selected: current === id,
              enter: items_,
              'data-pick': id,
              onclick: () => (items_ ? enter(id) : pick(id)),
            },
            `Edit ${id}.json in Sources`,
            () => edit(id),
          )}
        {/each}
      {:else}
        {#each items as r (r.it?.id ?? r.i)}
          {@render row(
            {
              lead: String(r.i + 1).padStart(2, '0'),
              name: r.name,
              selected: current === source && value?.id === r.it?.id,
              'data-pick': r.it?.id,
              onclick: () => pick({ source, id: r.it.id }),
            },
            `Edit ${r.name} in Sources`,
            () => edit(source, r.i),
          )}
        {:else}
          <p class="hint small">Nothing found.</p>
        {/each}
      {/if}
    </div>
  </div>
</dialog>

<style lang="scss">
  @use '../styles/mixins' as *;

  dialog.item-modal {
    width: min(480px, 92vw);
    max-height: min(560px, calc(100vh - 64px));
    padding: 0;
    overflow: hidden;

    &[open] {
      display: flex;
      flex-direction: column;
    }
  }

  .item-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 0;
    padding: var(--space-4) var(--space-3);
  }

  .item-search {
    box-sizing: border-box;
    width: 100%;
    height: var(--size-control);
  }

  .item-list {
    @include stack(var(--space-1));
    overflow: auto;
  }

  // a row and its edit button
  .item-row {
    @include row(var(--space-1));

    > :global(.xrow) {
      flex: 1;
      min-width: 0;
    }
  }
</style>
