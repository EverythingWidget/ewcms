<!--
  A List widget's Content lead (WidgetInspector.svelte): Template, then Source
  (From URL | All | None | Custom). Custom is the old Hand-made mode: it only flips
  config.handmade; source and config.items are kept for switching back. From a source:
  WidgetSource.svelte (the template names the properties it shows: no mapping). Custom:
  ListField on config.items. Only the active pane is in the flow (the other is unmounted)
  so the pop-up is content-height.
  Template (config.template, both modes): the presets, then the site's templates
  (content/templates/t-….json); Duplicate template / Edit template sit on their own row
  under the full-width selector. Edit template opens it in the template editor; its Back
  returns here (the List selected, this pop-up on the same tab: ui.originStack). Duplicate copies the one picked into a new template file
  (POST /__editor/templates, kept in the store at once) and points the List at it. That
  switch is saved at once when the page had no other unsaved edits; otherwise it stays an
  unsaved edit and the note under the row says "Saved as template t-…". The note line is
  always laid out: no shift.
-->
<script>
  import WidgetSource from './WidgetSource.svelte';
  import ListField from './ListField.svelte';
  import Field from './Field.svelte';
  import LinkField from './LinkField.svelte';
  import SourceField from './SourceField.svelte';
  import { pairedHalves } from './source-items.js';
  import { sourceFile } from '../../render/files.js';
  import { HANDMADE_ITEM } from '../../render/widgets/list/handmade.js';
  import { TEXT_TYPES } from '../../render/property-types.js';
  import { pointer } from '../../render/helpers.js';
  import Button from './Button.svelte';
  import { ui } from './ui.svelte.js';
  import { PRESETS, cloneTemplate } from '../../render/widgets/list/presets.js';
  import { t } from '../../render/strings.js';
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

  // ---- template (config.template): presets, then the site's templates
  const templatePtr = $derived(`${base}/config/template`);
  const templateId = $derived.by(() => {
    live.version;
    return live.get(g.file, templatePtr) || PRESETS[0].id;
  });
  const templateOptions = $derived.by(() => {
    live.version;
    const own = Object.entries(live.content?.templates || {})
      .map(([id, tpl]) => [id, tpl?.name || id])
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
      const data = cloneTemplate(ctx, shown?.source || '', templateId, {
        handmade,
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
        toast(`Template “${res.data.name}” added and used (content/templates/${res.id}.json)`);
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
        <SourceField
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
    <div class="ll__actions">
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
          onclick={() => ui.openTemplate?.(templateId, { back: true })}
          data-edit-template>Edit template</Button
        >
      </span>
    </div>
    <p class={['ll__note', !note && 'is-hidden']} data-template-note aria-live="polite">
      {note || ' '}
    </p>
  </div>

  <div class="ll__source-head">
    <span class="tf__label">Source</span>
    {#if handmade}
      <Button size="small" icon="plus" onclick={addItem}>Add</Button>
    {/if}
  </div>
  <WidgetSource
    {g}
    {live}
    {base}
    {list}
    {shown}
    {sourceIds}
    {onsource}
    {handmade}
    oncustom={() => setHandmade(true)}
  />

  {#if handmade}
    <ListField
      label=""
      ariaLabel="Items"
      items={itemsField.items}
      name={(fields, i) => itemName(fields, i)}
      addLabel="Add"
      hideAdd
      onmove={moveItem}
      onremove={removeItem}
      onadd={addItem}
    >
      {#snippet item(fields)}{@render itemFields(fields)}{/snippet}
    </ListField>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .ll {
    @include stack(var(--gap-items));
    min-width: 0;
  }

  .ll__template {
    @include stack(var(--gap-rows));
    min-width: 0;
  }

  .ll__actions {
    @include row(var(--space-2));
    flex-wrap: wrap;
  }

  .ll__source-head {
    @include row(var(--space-2));
    justify-content: space-between;
  }

  // both labels in one cell: the button keeps the longer one's width
  .ll__dup {
    display: inline-grid;

    > span {
      grid-area: 1 / 1;
    }
  }

  .ll__note {
    min-height: 16px;
    margin: 0;
    color: var(--c-text-muted);
  }

  .ll__dup .is-hidden,
  .ll__edit.is-hidden,
  .ll__note.is-hidden {
    visibility: hidden;
  }
</style>
