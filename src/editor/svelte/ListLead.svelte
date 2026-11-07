<!--
  A List widget's Content lead (WidgetInspector.svelte): From a source | Hand-made, then either
  the source picker (WidgetSource.svelte) or the hand-made items (ListField on config.items).
  Both panes stay in one grid cell (visibility:hidden / inert) so switching does not shift layout.
  Switching modes only flips config.handmade; source and config.items are kept for switching back.
  From a source: the type's property mapping rows under the source (type.mapping, the List's
  config.properties: a row per role the preset uses, "Photo" → a property, prefilled with the
  automatic choice; "No photo property in People" when the source has none). MAP_SLOTS rows
  always laid out, the ones the preset doesn't use visibility:hidden / inert: no shift.
  Template (config.template, both modes): the presets, then the site's templates
  (content/templates/t-….json); Duplicate (a preset) / Duplicate template copies the one picked
  into a new template file (POST /__editor/templates, kept in the store at once) and points the
  List at it. That switch is saved at once when the page had no other unsaved edits (so nothing
  is left pending); otherwise it stays an unsaved edit next to them (Save never writes edits the
  user didn't ask to save) and the note under the row says "Saved as template t-…". The button
  keeps the longer label's width and the note line is always laid out: no shift.
-->
<script>
  import WidgetSource from './WidgetSource.svelte';
  import ListField from './ListField.svelte';
  import Field from './Field.svelte';
  import LinkField from './LinkField.svelte';
  import ItemPicker from './ItemPicker.svelte';
  import { pairedHalves } from './source-items.js';
  import { sourceFile } from '../../site/files.js';
  import { HANDMADE_ITEM } from '../../site/widgets/list/handmade.js';
  import { TEXT_TYPES } from '../../site/property-types.js';
  import { pointer } from '../../site/helpers.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import Button from './Button.svelte';
  import { ui } from './ui.svelte.js';
  import { PRESETS, cloneTemplate } from '../../site/widgets/list/presets.js';
  import { t } from '../../site/strings.js';
  import { saveDev, templatesOp } from '../source.js';
  import { toast } from './toasts.svelte.js';

  let { g, live, base, list = false, shown, sourceIds, onsource, bindings = null } = $props();

  const handmadePtr = $derived(`${base}/config/handmade`);
  const itemsPtr = $derived(`${base}/config/items`);
  const handmade = $derived.by(() => {
    live.version;
    return live.get(g.file, handmadePtr) === true;
  });

  const setHandmade = (on) =>
    live.store.set(g.file, handmadePtr, on ? true : undefined, {
      key: `config:${g.file}${handmadePtr}`,
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
      item: { ...HANDMADE_ITEM },
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
      item: listDef.item ?? { ...HANDMADE_ITEM },
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

  // ---- property mapping (config.properties), a slot per mappable role: no shift
  const MAP_SLOTS = 3;
  const propsPtr = $derived(`${base}/config/properties`);
  const mapRows = $derived.by(() => {
    live.version;
    const mapping = WIDGET_TYPES[g.type]?.mapping;
    if (!mapping) return [];
    const widget = {
      source: live.get(g.file, `${base}/source`),
      config: live.get(g.file, `${base}/config`),
    };
    return mapping(live.content, widget);
  });
  const slots = $derived(Array.from({ length: MAP_SLOTS }, (_, i) => mapRows[i] || null));
  function setMapping(role, key) {
    const cur = live.get(g.file, propsPtr);
    const next = { ...(cur && typeof cur === 'object' ? cur : {}) };
    if (key) next[role] = key;
    else delete next[role];
    const opts = { key: `config:${g.file}${propsPtr}`, source: 'panel', structure: true };
    if (Object.keys(next).length) live.store.set(g.file, propsPtr, next, opts);
    else if (cur !== undefined) live.store.remove(g.file, propsPtr, opts);
  }

  // ---- template (config.template): presets, then the site's templates
  const templatePtr = $derived(`${base}/config/template`);
  const templateId = $derived.by(() => {
    live.version;
    return live.get(g.file, templatePtr) || PRESETS[0].id;
  });
  const templateOptions = $derived.by(() => {
    live.version;
    const own = Object.entries(live.content?.templates || {})
      .map(([id, tpl]) => [id, tpl?.label || id])
      .sort((a, b) => a[1].localeCompare(b[1]));
    return [...PRESETS.map((p) => [p.id, p.label]), ...own];
  });
  const setTemplate = (id) =>
    live.store.set(g.file, templatePtr, id, {
      key: `config:${g.file}${templatePtr}`,
      source: 'panel',
      structure: true,
    });
  const isOwnTemplate = $derived(templateId.startsWith('t-'));
  let duplicating = $state(false);
  let note = $state('');
  async function duplicate() {
    if (duplicating) return;
    duplicating = true;
    note = '';
    // the page's other unsaved edits: then the switch is not saved on its own
    const pending = live.store.dirtyFiles().includes(g.file);
    try {
      const ctx = live.content;
      const config = live.get(g.file, `${base}/config`) || {};
      const data = cloneTemplate(ctx, shown?.source || '', templateId, {
        handmade,
        properties: config.properties,
        open: t(ctx, 'list.open'),
        sep: t(ctx, 'list.sep'),
      });
      const { version: _v, ...body } = data; // eslint-disable-line no-unused-vars
      const res = await templatesOp({ op: 'add', data: body });
      live.store.files({ [res.file]: res.data });
      setTemplate(res.id);
      live.store.seal();
      if (pending) note = `Saved as template ${res.id}: the List's switch is saved with the page`;
      else {
        const sent = { [g.file]: structuredClone(live.store.current[g.file]) };
        await saveDev(sent);
        live.store.markSaved([g.file], sent);
        toast(`Template “${res.data.label}” added and used (content/templates/${res.id}.json)`);
      }
    } catch (err) {
      toast(err.message, { kind: 'error' });
    } finally {
      duplicating = false;
    }
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
        aria-checked={!handmade}
        class={['seg__btn', !handmade && 'is-active']}
        onclick={() => setHandmade(false)}>From a source</button
      >
      <button
        type="button"
        role="radio"
        aria-checked={handmade}
        class={['seg__btn', handmade && 'is-active']}
        onclick={() => setHandmade(true)}>Hand-made</button
      >
    </div>
  </div>

  <!-- the item template: both modes use the same ones -->
  <div class="ll__template" data-template-picker>
    <Field
      edit={`${g.file}#${templatePtr}`}
      label="Template"
      type="select"
      value={templateId}
      options={templateOptions}
      changed={live.changed(g.file, templatePtr)}
      onvalue={(v) => {
        note = '';
        setTemplate(v);
      }}
    />
    <Button
      size="small"
      icon="clone"
      title="Copy this template into a new one of the site's (content/templates)"
      disabled={duplicating}
      onclick={duplicate}
      data-duplicate
      ><span class="ll__dup"
        ><span class={[isOwnTemplate && 'is-hidden']}>Duplicate</span><span
          class={[!isOwnTemplate && 'is-hidden']}>Duplicate template</span
        ></span
      ></Button
    >
    <!-- always laid out (no shift): hidden while a preset is picked -->
    <span class={['ll__edit', !isOwnTemplate && 'is-hidden']} aria-hidden={!isOwnTemplate}>
      <Button
        size="small"
        icon="pen"
        title="Open this template in the template editor (Pages > Site > Templates)"
        disabled={!isOwnTemplate}
        onclick={() => ui.openTemplate?.(templateId)}
        data-edit-template>Edit template</Button
      >
    </span>
    <p class={['ll__note', !note && 'is-hidden']} data-template-note aria-live="polite">
      {note || ' '}
    </p>
  </div>

  <!-- both panes always mounted: same height cell, no shift on a switch -->
  <div class="ll__body">
    <div class={['ll__pane', handmade && 'is-hidden']} inert={handmade || undefined}>
      <WidgetSource {g} {live} {base} {list} {shown} {sourceIds} {onsource} />
      {#if WIDGET_TYPES[g.type]?.mapping}
        <div class="ll__map" data-mapping>
          {#each slots as row, i (i)}
            <div
              class={['ll__maprow', !row && 'is-hidden']}
              inert={!row || undefined}
              data-mapping-row={row?.role || undefined}
            >
              {#if row?.none}
                <div class="tf">
                  <span class="tf__label">{row.label}</span>
                  <p class="ll__none" data-mapping-none>{row.none}</p>
                </div>
              {:else if row}
                <Field
                  edit={`${g.file}#${propsPtr}/${row.role}`}
                  label={row.label}
                  type="select"
                  value={row.value}
                  options={row.value ? row.options : [['', 'Pick a property'], ...row.options]}
                  changed={live.changed(g.file, `${propsPtr}/${row.role}`)}
                  onvalue={(v) => setMapping(row.role, v === row.auto ? '' : v)}
                />
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <div class={['ll__pane', !handmade && 'is-hidden']} inert={!handmade || undefined}>
      <ListField
        label=""
        ariaLabel="Items"
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

  .ll__template {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: var(--gap-rows);
    align-items: end;
  }

  // both labels in one cell: the button keeps the longer one's width
  .ll__dup {
    display: inline-grid;

    > span {
      grid-area: 1 / 1;
    }
  }

  .ll__note {
    grid-column: 1 / -1;
    min-height: 16px;
    margin: 0;
    color: var(--c-text-muted);
  }

  .ll__dup .is-hidden,
  .ll__edit.is-hidden,
  .ll__note.is-hidden {
    visibility: hidden;
  }

  .ll__body {
    display: grid;
    min-width: 0;
  }

  .ll__pane {
    grid-area: 1 / 1;
    min-width: 0;
  }

  // the mapping rows: every slot laid out (space reserved), unused ones hidden
  .ll__map {
    @include stack(var(--gap-fields));
    margin-top: var(--gap-fields);
  }

  .ll__none {
    margin: 0;
    color: var(--c-text-faint);
  }

  .ll__maprow {
    min-height: var(--map-row, 56px);
  }

  .ll__maprow.is-hidden,
  .ll__pane.is-hidden {
    visibility: hidden;
  }
</style>
