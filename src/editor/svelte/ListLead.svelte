<!--
  A List widget's Content lead (WidgetInspector.svelte): From a source | Hand-made, then either
  the source picker (WidgetSource.svelte) or the hand-made items (ListField on config.items).
  Both panes stay in one grid cell (visibility:hidden / inert) so switching does not shift layout.
  Switching modes only flips config.hand; source and config.items are kept for switching back.
-->
<script>
  import WidgetSource from './WidgetSource.svelte';
  import ListField from './ListField.svelte';
  import Field from './Field.svelte';
  import LinkField from './LinkField.svelte';
  import ItemPicker from './ItemPicker.svelte';
  import { pairedHalves } from './source-items.js';
  import { sourceFile } from '../../site/files.js';
  import { HAND_ITEM } from '../../site/widgets/list/hand.js';
    import { TEXT_TYPES } from '../../site/property-types.js';
  import { pointer } from '../../site/helpers.js';

  let { g, live, base, list = false, shown, sourceIds, onsource, bindings = null } = $props();

  const handPtr = $derived(`${base}/config/hand`);
  const itemsPtr = $derived(`${base}/config/items`);
  const hand = $derived.by(() => {
    live.version;
    return live.get(g.file, handPtr) === true;
  });

  const setHand = (on) =>
    live.store.set(g.file, handPtr, on ? true : undefined, {
      key: `config:${g.file}${handPtr}`,
      source: 'panel',
      structure: true,
    });

  // ---- hand-made items as a ListField descriptor (config.items)
  const itemsOf = (id) => {
    live.version;
    const list = live.get(sourceFile(id), '/items');
    return Array.isArray(list) ? list : [];
  };
  const listDef = $derived(
    (g.config || []).find((c) => c.key === 'items') || {
      list: {
        source: { type: 'source', label: 'Source' },
        title: { type: 'text', label: 'Title', width: 'half' },
        unit: { type: 'text', label: 'Unit (after the count)', width: 'half' },
        photo: { type: 'photo', label: 'Photo' },
        link: { type: 'link', label: 'Link' },
      },
      item: { ...HAND_ITEM },
      label: 'Items',
    },
  );
  const field = (path, type, label, sub = false) => {
    const def = type && typeof type === 'object' ? type : { type };
    const ptr = pointer([...path]);
    return {
      edit: `${g.file}#${ptr}`,
      file: g.file,
      ptr,
      type: def.type || 'text',
      label: def.label || label,
      half: def.width === 'half',
      bindType: sub && TEXT_TYPES.includes(def.type || 'text') ? def.type || 'text' : null,
      textual: TEXT_TYPES.includes(def.type || 'text'),
    };
  };
  const itemsField = $derived.by(() => {
    live.version;
    const items = Array.isArray(live.get(g.file, itemsPtr)) ? live.get(g.file, itemsPtr) : [];
    const subs = Object.entries(listDef.list);
    const basePath = ['sections', g.widget.at, 'widgets', g.widget.j, 'config', 'items'];
    return {
      list: true,
      edit: `${g.file}#${itemsPtr}`,
      file: g.file,
      ptr: itemsPtr,
      label: listDef.label || 'Items',
      item: listDef.item ?? { ...HAND_ITEM },
      photo: null, // ListField (not PhotoList); photo is a sub-field of each item
      items: items.map((_, j) =>
        subs.map(([sub, type]) => field([...basePath, j, sub], type, sub, true)),
      ),
    };
  });

  const listOf = () => [...(live.get(g.file, itemsPtr) || [])];
  const setList = (next) =>
    live.store.set(g.file, itemsPtr, next, { source: 'panel', structure: true });
  const moveItem = (from, to) => {
    const list = listOf();
    list.splice(to, 0, ...list.splice(from, 1));
    setList(list);
  };
  const removeItem = (i) => {
    const list = listOf();
    list.splice(i, 1);
    setList(list);
  };
  const addItem = () => setList([...listOf(), structuredClone(itemsField.item)]);

  function itemName(fields, i) {
    const own = fields.find((sub) => /\/title$/.test(sub.ptr));
    const text = own && live.get(own.file, own.ptr);
    return typeof text === 'string' && text.trim() ? text : `Item ${i + 1}`;
  }

  function setValue(f, value) {
    live.store.set(f.file, f.ptr, value, { source: 'panel', structure: true });
  }
</script>

{#snippet itemFields(fields)}
  {@const halves = pairedHalves(fields)}
  <div class="fields">
    {#each fields as f (f.edit)}
      {#if f.type === 'source'}
        <ItemPicker
          store={live.store}
          mode="source"
          value={live.get(f.file, f.ptr)}
          changed={live.changed(f.file, f.ptr)}
          none={null}
          {sourceIds}
          {itemsOf}
          {onsource}
          onpick={(v) => live.store.set(f.file, f.ptr, v, { source: 'panel', structure: true })}
          onclear={() => live.store.remove(f.file, f.ptr, { source: 'panel', structure: true })}
        />
      {:else if f.type === 'link'}
        <LinkField
          {live}
          edit={f.edit}
          label={f.label}
          value={live.get(f.file, f.ptr)}
          changed={live.changed(f.file, f.ptr)}
          empty="No link"
          binds={bindings ? bindings.binds('link') : null}
          onvalue={(value) =>
            live.store.set(f.file, f.ptr, value, { source: 'panel', structure: true })}
        />
      {:else}
        <Field
          {...f}
          half={halves.has(f.edit)}
          value={live.get(f.file, f.ptr)}
          changed={live.changed(f.file, f.ptr)}
          onvalue={(value) => setValue(f, value)}
        />
      {/if}
    {/each}
  </div>
{/snippet}

<div class="ll">
  <div class="tf">
    <span class="tf__label">Items</span>
    <div class="seg" role="radiogroup" aria-label="Items">
      <button
        type="button"
        role="radio"
        aria-checked={!hand}
        class={['seg__btn', !hand && 'is-active']}
        onclick={() => setHand(false)}>From a source</button
      >
      <button
        type="button"
        role="radio"
        aria-checked={hand}
        class={['seg__btn', hand && 'is-active']}
        onclick={() => setHand(true)}>Hand-made</button
      >
    </div>
  </div>

  <!-- both panes always mounted: same height cell, no shift on a switch -->
  <div class="ll__body">
    <div class={['ll__pane', hand && 'is-hidden']} inert={hand || undefined}>
      <WidgetSource {g} {live} {base} {list} {shown} {sourceIds} {onsource} />
    </div>
    <div class={['ll__pane', !hand && 'is-hidden']} inert={!hand || undefined}>
      <ListField
        label={itemsField.label}
        items={itemsField.items}
        name={(fields, i) => itemName(fields, i)}
        addLabel="Add"
        onmove={moveItem}
        onremove={removeItem}
        onadd={addItem}
      >
        {#snippet item(fields)}{@render itemFields(fields)}{/snippet}
      </ListField>
    </div>
  </div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .ll {
    @include stack(var(--gap-items));
    min-width: 0;
  }

  .ll__body {
    display: grid;
    min-width: 0;
  }

  .ll__pane {
    grid-area: 1 / 1;
    min-width: 0;
  }

  .ll__pane.is-hidden {
    visibility: hidden;
  }
</style>
