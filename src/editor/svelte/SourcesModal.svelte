<!--
  Sources: the lists in content/en/sources/ (people, places, projects, ...). It starts on
  the files with their item counts; click one to enter it: its items on the left, the
  selected item's properties on the right, Back returns to the files. Mounted once in
  App.svelte; openSources() (modals.svelte.js) opens it: Sources in the areas list (the
  files), a Source edit button, the item modal's edit buttons (on top of that modal, which is
  there again when it closes) or a click on a list item in the preview (straight into that
  file, item or field). Where it is lives in ui.sources, so persist.js can bring it back after
  a refresh.
  The items' order is the source's: the order every List of it shows (All, From URL). A row's
  grip drags it to another place (list-drag.svelte.js, as ListField and the Pages list), or
  Alt+↑/↓ on the grip; one undo step, written to sources/<id>.json on Save. The selection
  follows its item.
  What an item has comes from its source's schema (sources/<id>.schema.json, else inferred:
  src/render/schemas.js): the properties, their labels, types, widths and help, its name and slug.
-->
<script>
  import { plural } from '../lib/format.js';
  import { closeOnBackdrop } from '../lib/modal.js';
  import { showValue } from '../lib/show-value.js';
  import Button from './Button.svelte';
  import { tick } from 'svelte';
  import Field from './Field.svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import ExplorerRow from './ExplorerRow.svelte';
  import { ui } from './ui.svelte.js';
  import InfoHelp from './InfoHelp.svelte';
  import { listDrag, rowsOf } from './list-drag.svelte.js';
  import { moveAt, movedIndex } from '../lib/reorder.js';
  import { closeModal, modal } from './modals.svelte.js';
  import { isSource } from './content-groups.js';
  import { baseName } from '../../render/files.js';
  import {
    itemName,
    itemMeta,
    pad,
    pairedHalves,
    schemaFor,
    slugify,
    itemFields,
    newItem,
    valueAt,
  } from './source-items.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../preview-runtime.js)
  let { live, bridge } = $props();

  let dialog = $state();
  const file = $derived(ui.sources.file); // '' = the list of files
  let confirming = $state(false); // "Delete X?" is showing
  let slugBad = $state(false);

  const files = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).filter(isSource).sort();
  });
  const list = $derived(live.current(file)?.items);
  const base = $derived(live.base(file)?.items || []);
  const isList = $derived(Array.isArray(list));
  const index = $derived(isList ? Math.max(0, Math.min(ui.sources.index, list.length - 1)) : 0);
  const item = $derived(isList ? list[index] : undefined);
  const schema = $derived.by(() => {
    live.version;
    return file ? schemaFor(live.store, file) : { properties: [] };
  });
  const slugField = $derived(schema.properties.find((f) => f.key === schema.slug));
  const fields = $derived(item ? itemFields(file, item, index, schema) : []);
  const halves = $derived(pairedHalves(fields));

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // An item is changed when it differs from the saved item with the same slug.
  const slugOf = (it) => it?.[schema.slug || 'slug'];
  const isChanged = (it) =>
    !same(
      it,
      base.find((b) => slugOf(b) === slugOf(it)),
    );
  const fieldChanged = (f) => !same(valueAt(item, f.path), valueAt(base[index], f.path));
  const fileChanged = (f) => !same(live.current(f), live.base(f));

  /** Show the stored value in an input, except while the user is typing in it. */
  const show = (value) => showValue(String(value ?? ''));

  function select(i) {
    if (i !== ui.sources.index) ui.sources.property = '';
    ui.sources.index = i;
    confirming = false;
    slugBad = false;
  }

  async function add() {
    const now = live.store.current[file].items;
    select(now.length);
    live.store.set(file, '/items', [...now, newItem(now, schema)], { source: 'panel' });
    await tick();
    dialog.querySelector('.tf__input:not([disabled])')?.focus();
  }

  function remove() {
    const now = live.store.current[file].items;
    const at = index;
    select(Math.max(0, Math.min(at, now.length - 2)));
    const rest = now.filter((_, i) => i !== at);
    live.store.set(file, '/items', rest, { source: 'panel' });
  }

  // ---- the order: a row's grip drags it (list-drag.svelte.js), Alt+↑/↓ on the grip moves it
  let itemsEl = $state();
  const ld = listDrag({
    lists: () => [rowsOf(itemsEl, '[data-srow]')],
    shape: () => `${file}|${list?.length}`,
    ondrop: (d) => move(d.j, d.over.to),
    scroller: () => itemsEl,
    grabbing: true,
    edgeScroll: true,
    swallowClick: true,
  });
  const drag = $derived(ld.drag);

  /** Item `from` to place `to`: one undo step; the selected item stays selected. */
  function move(from, to) {
    const now = live.store.current[file].items;
    const next = moveAt(now, from, to);
    if (next.every((it, k) => it === now[k])) return;
    const sel = movedIndex(index, from, Math.max(0, Math.min(to, now.length - 1)));
    live.store.set(file, '/items', next, { source: 'panel' });
    ui.sources.index = sel;
  }

  async function nudge(e, i) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    e.stopPropagation();
    const to = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= list.length) return;
    move(i, to);
    await tick();
    itemsEl.querySelector(`:scope > [data-srow="${to}"] .srow__grip`)?.focus();
  }

  async function askDelete() {
    confirming = true;
    await tick();
    dialog.querySelector('.confirm button')?.focus();
  }

  function onSlug(e) {
    const slug = slugify(e.currentTarget.value);
    const at = index;
    slugBad =
      !slug || live.store.current[file].items.some((it, k) => k !== at && slugOf(it) === slug);
    if (!slugBad)
      live.store.set(file, `/items/${at}/${schema.slug}`, slug, {
        key: `slug:${file}#${at}`,
        source: 'panel',
      });
  }

  /** Enter a file ('' = back to the list of files), keeping the keyboard focus in the modal. */
  async function goTo(next) {
    const from = file;
    ui.sources.file = next;
    select(0);
    await tick();
    const back = from && dialog.querySelector(`[data-file="${CSS.escape(from)}"]`);
    (back || dialog.querySelector('.xrow'))?.focus();
  }

  /**
   * Shown (openSources): on the list of files, or straight into a file at its item, optionally
   * on one field (ui.sources.edit, its data-edit): focused, scrolled to and highlighted
   * (ui.sources.property, its key).
   */
  async function onopen() {
    const { edit } = ui.sources;
    if (!files.includes(ui.sources.file)) ui.sources.file = '';
    select(ui.sources.index);
    await tick(); // rendered, so the field below exists
    if (edit) ui.sources.property = fields.find((f) => f.edit === edit)?.key || '';
    ui.sources.edit = null;
    await tick();
    const at = fields.find((f) => f.key === ui.sources.property);
    const field = at && dialog.querySelector(`[data-edit="${CSS.escape(at.edit)}"]`);
    if (!field) return void (file || dialog.querySelector('.xrow')?.focus());
    field.querySelector('.tf__input, button')?.focus({ preventScroll: true });
    field.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  // it waits for the content (a refresh opens it before it is loaded), not for a source file:
  // a site without one would keep it, and every modal above it, on the stack unshown (G1)
  const ready = () => {
    live.version;
    return Object.keys(live.store.current).length > 0;
  };
</script>

<dialog
  class="modal__box sources-modal"
  aria-label="Sources"
  bind:this={dialog}
  {@attach closeOnBackdrop}
  {@attach modal('sources', { onopen, ready })}
>
  <ExplorerHead
    title="Sources"
    icon="fa-database"
    sep="/"
    crumbs={file
      ? [
          { label: 'sources', onclick: () => goTo('') },
          { label: baseName(file) },
          ...(item ? [{ label: itemName(item, schema) }] : []),
        ]
      : [{ label: 'sources' }]}
    back={file ? 'Back to files' : ''}
    onback={() => goTo('')}
    onclose={() => closeModal('sources')}
  />

  {#if !file}
    <div class="sources-files-wrap">
      <p class="hint small sources-files__about">
        Your lists, one file each<InfoHelp label="About source files"
          >Each is <code>content/en/sources/&lt;name&gt;.json</code>:
          <code>{'{ "version": 1, "items": [ … ] }'}</code>, not a bare array. Every item has an
          <b>id</b> like <code>p-k3x9</code> (<code>p-</code> and 4–12 lowercase letters or digits),
          given once and never changed; <b>Add</b> makes one. What an item has:
          <code>&lt;name&gt;.schema.json</code> next to it.</InfoHelp
        >
      </p>
      <ul class="list sources-files" aria-label="Source files">
        {#each files as f (f)}
          {@const items = live.current(f)?.items}
          <li>
            <ExplorerRow
              icon="fa-file-lines"
              name={baseName(f)}
              meta={Array.isArray(items) ? `${items.length} items` : 'not a list'}
              changed={fileChanged(f)}
              data-file={f}
              onclick={() => goTo(f)}
            />
          </li>
        {:else}
          <li class="hint small sources-files__none">
            No source files yet: add one as <code>content/en/sources/&lt;name&gt;.json</code>.
          </li>
        {/each}
      </ul>
    </div>
  {:else}
    <nav class="sources-list" aria-label="Items">
      {#if isList}
        <header class="row sources-list__head">
          <span
            >{plural(list.length, 'item')}<InfoHelp label="About the order"
              ><b>Order</b>: every List of this source shows its items in this order. Drag a row's
              grip (or Alt+↑/↓ on it) to move it; Save writes the new order.</InfoHelp
            ></span
          >
          <Button size="small" icon="plus" onclick={add}>Add</Button>
        </header>
        <ul class="list sources-list__items" bind:this={itemsEl}>
          {#each list as it, i (i)}
            {@const lifted = drag?.moving && drag.j === i}
            <li
              class={['srow', lifted && 'is-lifted', ld.dropAt(i)]}
              style:translate={lifted ? `0 ${drag.dy}px` : null}
              data-srow={i}
            >
              <button
                type="button"
                class="srow__grip"
                aria-label="Move: {itemName(it, schema)} (drag, or Alt+↑/↓)"
                title="Drag to reorder (or Alt+↑/↓)"
                onpointerdown={(e) => ld.grab(e, { j: i })}
                onkeydown={(e) => nudge(e, i)}
                ><i class="fa-solid fa-grip-vertical" aria-hidden="true"></i></button
              >
              <ExplorerRow
                lead={pad(i)}
                name={itemName(it, schema)}
                meta={itemMeta(it, schema)}
                selected={i === index}
                changed={isChanged(it)}
                aria-current={i === index}
                onclick={() => select(i)}
              />
            </li>
          {/each}
        </ul>
        {#if list.length !== base.length}
          <p class="hint small sources-list__note">
            Added and deleted items show in the preview after Save.
          </p>
        {/if}
      {/if}
    </nav>

    <section class="sources-detail">
      {#if !isList}
        <p class="hint">{baseName(file)} is not a list.</p>
      {:else if !item}
        <p class="hint">No items yet. Add one on the left.</p>
      {:else}
        <header class="sources-detail__head">
          <h4 class="sources-item__title">{itemName(item, schema)}</h4>
          {#if confirming}
            <span class="confirm">
              Delete {itemName(item, schema)}?
              <Button size="small" onclick={() => (confirming = false)}>Cancel</Button>
              <Button variant="danger" size="small" icon="trash" onclick={remove}>Delete</Button>
            </span>
          {:else}
            <Button variant="danger" size="small" icon="trash" onclick={askDelete}>Delete</Button>
          {/if}
        </header>

        <div class="fields">
          {#if slugField}
            <!-- the slug is the page URL: once saved, a new one redirects the old (on Save) -->
            <label class="tf">
              <span class="tf__label">{slugField.label}</span>
              <input
                class={['tf__input', slugBad && 'is-invalid']}
                spellcheck="false"
                {@attach show(slugOf(item))}
                oninput={onSlug}
                onblur={(e) => {
                  e.currentTarget.value = slugOf(item) ?? '';
                  slugBad = false;
                }}
              />
              {#if slugField.help}<span class="tf__help">{slugField.help}</span>{/if}
            </label>
          {/if}

          {#each fields as f (f.edit)}
            <Field
              {...f}
              half={halves.has(f.edit)}
              value={valueAt(item, f.path)}
              changed={fieldChanged(f)}
              selected={ui.sources.property === f.key}
              onfocus={() => {
                ui.sources.property = f.key;
                bridge.focusEdit(f.edit);
              }}
              onvalue={(value) =>
                live.store.set(file, f.ptr, value, { key: `text:${f.edit}`, source: 'panel' })}
            />
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</dialog>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the Sources modal is a <dialog>: header on top, item list left, item fields right
  dialog.sources-modal {
    width: min(1100px, 92vw);
    height: calc(100vh - 64px);
    max-height: 900px;
    display: grid;
    grid-template-columns: minmax(240px, 320px) 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    padding: 0;
    overflow: hidden;

    &:not([open]) {
      display: none;
    }
  }

  // the list of files, across the whole modal, under a line about them (F32)
  .sources-files-wrap {
    grid-column: 1 / -1;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
  }

  .sources-files__about {
    margin: 0;
    padding: var(--space-4) var(--space-3) 0;
  }

  .sources-files {
    grid-column: 1 / -1;
    align-content: start;
    gap: var(--space-1);
    overflow: auto;
    padding: var(--space-4) var(--space-3) 20px;
  }

  // left: the file's items
  .sources-list {
    overflow: auto;
    padding: var(--space-4) var(--space-3) 20px;
    border-right: 1px solid var(--c-line);
  }

  .sources-list__head {
    justify-content: space-between;
    padding: 0 var(--space-2) var(--space-3);
    @include muted;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .sources-list__items {
    gap: var(--space-1);
  }

  // a row: [grip | the item]; lifted while dragged (no size change), a line where it lands
  .srow {
    position: relative;
    display: flex;
    align-items: stretch;
    border-radius: var(--radius-lg);

    > :global(.xrow) {
      flex: 1;
      min-width: 0;
    }

    &.is-lifted {
      z-index: 2;
      background: var(--c-card);
      box-shadow:
        0 0 0 1px var(--c-accent),
        0 12px 28px -12px var(--c-scrim);
    }

    &.is-drop-before::before,
    &.is-drop-after::after {
      content: '';
      position: absolute;
      inset-inline: 0;
      border-top: 2px solid var(--c-accent);
    }

    &.is-drop-before::before {
      top: calc(var(--space-1) / -2);
    }

    &.is-drop-after::after {
      bottom: calc(var(--space-1) / -2);
    }
  }

  // the grip: ListField's, a quiet 24px column at the row's left
  .srow__grip {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-faint);
    cursor: grab;
    touch-action: none;

    &:hover,
    &:focus-visible {
      color: var(--c-text);
      outline: none;
    }

    &:focus-visible {
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }
  }

  .sources-list__note {
    margin: var(--space-3) var(--space-2) 0;
  }

  // right: the selected item
  .sources-detail {
    container-type: inline-size;
    overflow: auto;
    padding: var(--space-4) var(--space-5) var(--space-5);
    @include stack(var(--space-3));
    align-content: start;
  }

  .sources-detail__head {
    @include row(var(--space-3));
    min-height: var(--size-control);
    margin-bottom: var(--space-1);

    .sources-item__title {
      flex: 1;
      min-width: 0;
    }
  }

  .sources-detail :global(.tf__input:disabled) {
    color: var(--c-text-muted);
    cursor: not-allowed;
  }

  .sources-item__title {
    margin: 0;
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--c-text);
  }
</style>
