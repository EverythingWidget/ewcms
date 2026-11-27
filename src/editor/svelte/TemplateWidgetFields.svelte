<!--
  A template widget's Content fields (in the widget pop-up, WidgetInspector.svelte): Role,
  When a value is missing, Between facts, and the type's own rows (its inTemplate, at
  src/widgets/index.js). A Template field with editTemplate (an inner List, Summary and
  details) gets the same Duplicate template / Edit template row a page List has; Back
  from the inner template returns here (ui.originStack). A Text's style and wording are
  edited in the preview, as a page Text's (the widget toolbar: style, marks, + Property).
  Layout stays WidgetLayout in the inspector. Binds are the sample item's properties,
  {number}, {back}, and an outer item's parent: keys.
-->
<script>
  import Field from './Field.svelte';
  import MissingField from './MissingField.svelte';
  import TemplateActions from './TemplateActions.svelte';
  import { sourceIds as sourceIdsOf, templateIdOf } from '../../render/files.js';
  import { schemaOf } from '../../render/schemas.js';
  import { sampleSource } from '../../widgets/list/template-preview.js';
  import { ITEM_WIDGETS, itemSection } from '../../widgets/list/item-grid.js';
  import { templatePickerGroups } from '../../widgets/list/presets.js';
  import { templateFields, widgetType } from '../../widgets/index.js';
  import { innerChoice, innerTemplates } from '../../widgets/list/nested.js';
  import { MIN_TEXT_PX, sizeLine, textSizes } from '../lib/small-text.js';
  import {
    ITEMS_FROM,
    innerSourceFor,
    TEMPLATE_MISSING,
    templateProperties,
  } from '../lib/item-template.js';

  // live: the reactive store (live.svelte.js); file: the template's; j: the widget's index
  let { live, bridge = null, file, j } = $props();

  let sizes = $state({});
  $effect(() => {
    const read = () => {
      const next = textSizes(bridge?.doc);
      if (JSON.stringify(next) !== JSON.stringify(sizes)) sizes = next;
    };
    read();
    const t = setInterval(read, 700);
    return () => clearInterval(t);
  });

  const id = $derived(templateIdOf(file) || '');
  const tpl = $derived.by(() => {
    return live.current(file) || null;
  });
  const section = $derived(itemSection(tpl));
  const widgets = $derived(Array.isArray(section?.widgets) ? section.widgets : []);
  const w = $derived(widgets[j] || {});
  const b = $derived(`${ITEM_WIDGETS}/${j}`);
  const from = $derived(sampleSource(live.content, tpl));
  const schema = $derived(from ? schemaOf(live.content, from) : null);
  const own = $derived((schema?.properties || []).map((p) => p.key));
  const used = $derived(templateProperties(widgets));
  const EXTRA = [
    { value: 'number', label: 'Number (01, 02 …)' },
    { value: 'back', label: 'Back (the page around it)' },
  ];
  const binds = $derived([
    ...[...new Set([...own, ...used])]
      .filter((k) => !EXTRA.some((x) => x.value === k) || own.includes(k))
      .map((k) => ({ value: k, label: k })),
    ...EXTRA.filter((x) => !own.includes(x.value)),
  ]);
  const names = $derived(new Set(binds.map((x) => x.value)));

  const templates = $derived(live.content?.templates || {});
  const outer = $derived(
    Object.entries(templates).find(([, t]) => innerTemplates(t).includes(id))?.[0] || '',
  );
  const parentFrom = $derived(outer ? sampleSource(live.content, templates[outer]) : '');
  const parentKeys = $derived(
    parentFrom ? (schemaOf(live.content, parentFrom)?.properties || []).map((p) => p.key) : [],
  );
  const allBinds = $derived([
    ...binds,
    ...parentKeys.map((k) => ({ value: `parent:${k}`, label: `parent: ${k}` })),
  ]);
  const listProps = $derived(
    (schema?.properties || [])
      .filter(
        (p) =>
          p.type === 'photos' || (from && Array.isArray(live.content.sources[from]?.[0]?.[p.key])),
      )
      .map((p) => [p.key, p.label || p.key]),
  );
  const sourceIds = $derived(sourceIdsOf(live.store.current));
  const propsOf = (src) =>
    (schemaOf(live.content, src)?.properties || []).map((p) => [p.key, p.label || p.key]);
  const innerOptions = $derived(
    templatePickerGroups(
      Object.entries(templates)
        .filter(([t]) => t !== id && innerChoice(templates, id, t) !== 'loop')
        .map(([t, tp]) => {
          const choice = innerChoice(templates, id, t);
          const o = { value: t, label: tp.name || t };
          if (choice === 'deep')
            return { ...o, disabled: true, hint: 'It holds a list: a third level' };
          if (choice === 'opens')
            return { ...o, disabled: true, hint: 'Its items open: not inside a List' };
          return o;
        }),
    ),
  );
  const detailsOptions = $derived(
    Object.entries(templates)
      .filter(([t]) => t !== id)
      .map(([t, tp]) =>
        itemSection(tp)?.widgets?.some?.((x) => widgetType(x?.type)?.templateOnly)
          ? [t, tp.name || t, { disabled: true, hint: 'It has Summary and details of its own' }]
          : [t, tp.name || t],
      ),
  );

  const wAt = (ptr) =>
    ptr
      .split('/')
      .slice(1)
      .reduce((o, k) => o?.[k], tpl) || {};
  const set = (ptr, value, structure = false) =>
    live.store.set(file, ptr, value, { source: 'panel', structure });
  function setInner(ptr, mode) {
    const prev = wAt(ptr).source || {};
    set(
      `${ptr}/source`,
      innerSourceFor(mode, prev, {
        listProperty: listProps[0]?.[0] || 'photos',
        source: from || sourceIds[0] || '',
        own: schema?.slug || 'slug',
      }),
      true,
    );
  }
  function setRule(ptr, key, v) {
    const where = structuredClone(wAt(ptr).source?.where || { op: 'and', rules: [{}] });
    where.rules[0] = { ...where.rules[0], [key]: v };
    set(`${ptr}/source/where`, where, true);
  }
  function setRole(ptr, v) {
    const role = String(v || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    set(`${ptr}/role`, role || undefined);
  }

  const fields = $derived(templateFields(widgetType(w.type)));
  let note = $state('');

  const at = (obj, path) => path.split('/').reduce((o, k) => o?.[k], obj);
  const valueOf = (f) => (f.value ? f.value(w) : at(w, f.key));
  const helpOf = (f) => (typeof f.help === 'function' ? f.help(w) : f.help);
  const disabledOf = (f) => (typeof f.disabled === 'function' ? f.disabled(w) : !!f.disabled);
  function optionsOf(f) {
    const name = f.options;
    const empty = f.empty != null ? [['', f.empty]] : [];
    if (Array.isArray(name)) return [...empty, ...name];
    if (name === 'itemsFrom') return ITEMS_FROM;
    if (name === 'listProps')
      return listProps.length ? listProps : [['', 'No list property in the sample']];
    if (name === 'sources') return sourceIds.map((n) => [n, schemaOf(live.content, n)?.label || n]);
    if (name === 'innerTemplates') return innerOptions;
    if (name === 'detailsTemplates') return [...empty, ...detailsOptions];
    if (name === 'bindsOrSummary')
      return [['', 'What the summary shows'], ...binds.map((x) => [x.value, x.label])];
    return empty;
  }
  function writeField(f, v) {
    if (f.replace === 'source') {
      setInner(b, v);
      return;
    }
    set(`${b}/${f.key}`, f.write ? f.write(v) : v, !!f.structure);
  }
</script>

<div class="twf">
  <p
    class="hint small twf__size"
    class:twf__size--warn={sizes[w.id] < MIN_TEXT_PX}
    data-text-size={w.id}
  >
    {sizeLine(sizes[w.id]) || 'No text in the preview'}
  </p>
  <Field
    edit={`${file}#${b}/role`}
    label="Role"
    value={w.role || ''}
    placeholder="none"
    help="Its class: .li__<role>"
    onvalue={(v) => setRole(b, v)}
  >
    {#snippet tip()}<b>Role</b>: this widget's name in the template, and its style hook (the class
      .li__&lt;role&gt;). It doesn't pick what it shows: its own property does. Only a preset uses
      it, to fill the part from the source's property of the same name.{/snippet}
  </Field>
  <!-- what its type offers in an item template (its inTemplate: src/widgets/index.js) -->
  {#if widgetType(w.type)?.inTemplate?.missing}
    <!-- When a value is missing (src/render/layout/missing.js): one full row; Inherit is left out -->
    <MissingField
      edit={`${file}#${b}/config/missing`}
      value={w.config?.missing || ''}
      options={TEMPLATE_MISSING}
      inherit
      onvalue={(v) => set(`${b}/config/missing`, v || undefined, true)}
    />
  {/if}
  {#if widgetType(w.type)?.inTemplate?.join}
    <!-- Style + Text: edited in the preview (the page Text's toolbar), not here -->
    {#if w.join !== undefined}
      <Field
        edit={`${file}#${b}/join`}
        label="Between facts"
        value={w.join}
        help="Its first line’s properties joined by it; an empty one takes none"
        onvalue={(v) => set(`${b}/join`, v)}
      />
    {/if}
  {/if}
  <!-- the type's own rows (templateFields: its settings' and config's inTemplate, and its
     template-only inTemplate.fields); every row always there (no shift): the ones
     the Items from doesn't use disabled -->
  {#each fields as f (f.key || f.type)}
    {#if f.type === 'match'}
      {@const src = w.source || {}}
      {@const mode = src.mode === 'item' ? 'all' : src.mode}
      <div class="twf__match">
        <Field
          edit={`${file}#${b}/source/where/rules/0/property`}
          label={f.theirs}
          type="select"
          value={src.where?.rules?.[0]?.property || ''}
          options={propsOf(src.from)}
          disabled={mode !== 'match'}
          onvalue={(v) => setRule(b, 'property', v)}
        />
        <span class="twf__is">{f.between}</span>
        <Field
          edit={`${file}#${b}/source/where/rules/0/parent`}
          label={f.ours}
          type="select"
          value={src.where?.rules?.[0]?.parent || ''}
          options={propsOf(from)}
          disabled={mode !== 'match'}
          onvalue={(v) => setRule(b, 'parent', v)}
        />
      </div>
    {:else if f.editTemplate}
      {@const tid = valueOf(f) || ''}
      <div class="twf__template" data-template-picker>
        <Field
          edit={`${file}#${b}/${f.key}`}
          label={f.label}
          type={f.type || 'text'}
          value={tid}
          options={optionsOf(f)}
          disabled={disabledOf(f)}
          help={helpOf(f)}
          onvalue={(v) => {
            note = '';
            writeField(f, v);
          }}
        />
        <TemplateActions
          {live}
          {file}
          templateId={tid}
          setTemplate={(id) => writeField(f, id)}
          source={from || ''}
          withFile="template"
          bind:note
        />
      </div>
    {:else}
      <Field
        edit={`${file}#${b}/${f.key}`}
        label={f.label}
        type={f.type || 'text'}
        value={valueOf(f)}
        binds={f.binds ? allBinds : null}
        names={f.binds ? names : null}
        formats={!!f.binds}
        from={f.binds ? from : ''}
        options={optionsOf(f)}
        disabled={disabledOf(f)}
        help={helpOf(f)}
        onvalue={(v) => writeField(f, v)}
      />
    {/if}
  {/each}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .twf {
    @include stack(var(--space-3));
    align-content: start;
  }

  .twf__match {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: var(--space-2);
    align-items: end;
  }

  .twf__is {
    height: var(--size-control);
    line-height: var(--size-control);
    color: var(--c-text-muted);
  }

  .twf__size {
    overflow: hidden;
    height: 16px;
    margin: 0;
    line-height: 16px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .twf__size--warn {
    color: var(--c-warning);
  }

  .twf__template {
    @include stack(var(--gap-rows));
    min-width: 0;
  }
</style>
