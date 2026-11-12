<!--
  A template widget's Content fields (in the widget pop-up, WidgetInspector.svelte): Role,
  When a value is missing, and the type's own (a Text its one line, a Photo, a Button, an
  inner List, Summary and details). Layout stays WidgetLayout in the inspector. Binds are the
  sample item's properties, {number}, {back}, and an outer item's parent: keys.
-->
<script>
  import Field from './Field.svelte';
  import { sourceIds as sourceIdsOf, templateIdOf } from '../../site/files.js';
  import { LINE_STYLES } from '../../site/text.js';
  import { schemaOf } from '../../site/schemas.js';
  import { sampleSource } from '../../site/widgets/list/template-preview.js';
  import { ITEM_WIDGETS, itemSection } from '../../site/widgets/list/item-grid.js';
  import { PRESETS } from '../../site/widgets/list/presets.js';
  import { innerChoice, innerTemplates } from '../../site/widgets/list/nested.js';
  import { MIN_TEXT_PX, sizeLine, textSizes } from '../lib/small-text.js';
  import {
    ITEMS_FROM,
    innerSourceFor,
    keepMarks,
    TEMPLATE_MISSING,
    runsOf,
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
    live.version;
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
  const innerOptions = $derived([
    ...PRESETS.map((p) => [p.id, p.label]),
    ...Object.entries(templates)
      .filter(([t]) => t !== id && innerChoice(templates, id, t) !== 'loop')
      .map(([t, tp]) =>
        innerChoice(templates, id, t) === 'deep'
          ? [t, tp.name || t, { disabled: true, hint: 'It holds a list: a third level' }]
          : innerChoice(templates, id, t) === 'opens'
            ? [t, tp.name || t, { disabled: true, hint: 'Its items open: not inside a List' }]
            : [t, tp.name || t],
      ),
  ]);
  const detailsOptions = $derived(
    Object.entries(templates)
      .filter(([t]) => t !== id)
      .map(([t, tp]) =>
        itemSection(tp)?.widgets?.some?.((x) => x?.type === 'details')
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
  const STYLES = LINE_STYLES.map(([v, l]) => [v, l]);
  function setLine(ptr, key, value) {
    const line = wAt(ptr).body?.[0] || { style: 'paragraph', text: [] };
    const next = {
      ...line,
      [key]: key === 'text' ? keepMarks(line.text, runsOf(value)) : value,
    };
    set(`${ptr}/body`, [next]);
  }
  function setRole(ptr, v) {
    const role = String(v || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    set(`${ptr}/role`, role || undefined);
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
/>
{#if ['text', 'photo', 'button'].includes(w.type)}
  <!-- When a value is missing (src/site/layout/missing.js): one full row; Inherit is left out -->
  <Field
    edit={`${file}#${b}/config/missing`}
    label="When a value is missing"
    type="select"
    value={w.config?.missing || ''}
    options={TEMPLATE_MISSING}
    onvalue={(v) => set(`${b}/config/missing`, v || undefined, true)}
  />
{/if}
{#if w.type === 'text'}
  {@const l = w.body?.[0] || { style: 'paragraph', text: [] }}
  <div class="twf__line">
    <Field
      edit={`${file}#${b}/body/0/style`}
      label="Style"
      type="select"
      value={l.style}
      options={STYLES}
      onvalue={(v) => setLine(b, 'style', v)}
    />
    <Field
      edit={`${file}#${b}/body/0/text`}
      label="Text"
      value={l.text}
      binds={allBinds}
      {names}
      formats
      {from}
      onvalue={(v) => setLine(b, 'text', v)}
    />
  </div>
  {#if w.join !== undefined}
    <Field
      edit={`${file}#${b}/join`}
      label="Between facts"
      value={w.join}
      help="Its first line’s properties joined by it; an empty one takes none"
      onvalue={(v) => set(`${b}/join`, v)}
    />
  {/if}
{:else if w.type === 'photo'}
  <Field
    edit={`${file}#${b}/src`}
    label="Photo"
    value={w.src}
    binds={allBinds}
    {names}
    formats
    {from}
    onvalue={(v) => set(`${b}/src`, v)}
  />
{:else if w.type === 'list'}
  {@const src = w.source || {}}
  {@const mode = src.mode === 'item' ? 'all' : src.mode}
  <!-- every row always there (no shift): the ones the Items from doesn't use disabled -->
  <Field
    edit={`${file}#${b}/source/mode`}
    label="Items from"
    type="select"
    value={mode}
    options={ITEMS_FROM}
    onvalue={(v) => setInner(b, v)}
  />
  <Field
    edit={`${file}#${b}/source/property`}
    label="Property"
    type="select"
    value={src.property || ''}
    options={listProps.length ? listProps : [['', 'No list property in the sample']]}
    disabled={mode !== 'property'}
    onvalue={(v) => set(`${b}/source/property`, v, true)}
  />
  <Field
    edit={`${file}#${b}/source/from`}
    label="Source"
    type="select"
    value={src.from || ''}
    options={sourceIds.map((n) => [n, schemaOf(live.content, n)?.label || n])}
    disabled={mode === 'property'}
    onvalue={(v) => set(`${b}/source/from`, v, true)}
  />
  <div class="twf__match">
    <Field
      edit={`${file}#${b}/source/where/rules/0/property`}
      label="Match: their property"
      type="select"
      value={src.where?.rules?.[0]?.property || ''}
      options={propsOf(src.from)}
      disabled={mode !== 'match'}
      onvalue={(v) => setRule(b, 'property', v)}
    />
    <span class="twf__is">is this item’s</span>
    <Field
      edit={`${file}#${b}/source/where/rules/0/parent`}
      label="Property"
      type="select"
      value={src.where?.rules?.[0]?.parent || ''}
      options={propsOf(from)}
      disabled={mode !== 'match'}
      onvalue={(v) => setRule(b, 'parent', v)}
    />
  </div>
  <Field
    edit={`${file}#${b}/config/template`}
    label="Template"
    type="select"
    value={w.config?.template || 'preset:card'}
    options={innerOptions}
    onvalue={(v) => set(`${b}/config/template`, v, true)}
  />
  <!-- its Arrangement, Columns, Space between items and the Carousel's: the Layout tab -->
{:else if w.type === 'details'}
  <Field
    edit={`${file}#${b}/config/template`}
    label="Details template"
    type="select"
    value={w.config?.template || ''}
    options={[['', 'Pick a template'], ...detailsOptions]}
    help="What opens below the summary, filled from the same item"
    onvalue={(v) => set(`${b}/config/template`, v || undefined)}
  />
  <Field
    edit={`${file}#${b}/config/several`}
    label="Several open at once"
    type="boolean"
    value={w.config?.several === true}
    help="Off: opening one closes the open one"
    onvalue={(v) => set(`${b}/config/several`, v)}
  />
  <Field
    edit={`${file}#${b}/config/icon`}
    label="Icon"
    type="select"
    value={w.config?.icon || 'plus'}
    options={[
      ['plus', '+ / ×'],
      ['none', 'None'],
    ]}
    onvalue={(v) => set(`${b}/config/icon`, v)}
  />
  <Field
    edit={`${file}#${b}/config/screenReaderName`}
    label="Screen reader name"
    type="select"
    value={w.config?.screenReaderName?.[0]?.property || ''}
    options={[['', 'What the summary shows'], ...binds.map((x) => [x.value, x.label])]}
    onvalue={(v) => set(`${b}/config/screenReaderName`, v ? [{ property: v }] : undefined)}
  />
  <Field
    edit={`${file}#${b}/config/open`}
    label="First item open"
    type="boolean"
    value={w.config?.open === 'first'}
    help="Off: every item starts closed"
    onvalue={(v) => set(`${b}/config/open`, v ? 'first' : undefined)}
  />
{:else if w.type === 'button'}
  <Field
    edit={`${file}#${b}/label`}
    label="Label"
    value={w.label}
    binds={allBinds}
    {names}
    formats
    {from}
    onvalue={(v) => set(`${b}/label`, v)}
  />
  <Field
    edit={`${file}#${b}/itemLink`}
    label="Opens the item’s page"
    type="boolean"
    value={w.itemLink === true}
    onvalue={(v) => set(`${b}/itemLink`, v ? true : undefined)}
  />
  <Field
    edit={`${file}#${b}/config/link`}
    label="Link"
    value={Array.isArray(w.config?.link) ? w.config.link : []}
    binds={allBinds}
    {names}
    formats
    {from}
    disabled={w.itemLink === true}
    help={w.itemLink === true ? 'It opens the item’s page' : 'A property: {url}'}
    onvalue={(v) => {
      const runs = runsOf(v);
      set(`${b}/config/link`, runs.length ? runs : undefined, true);
    }}
  />
{/if}
</div>


<style lang="scss">
  @use '../styles/mixins' as *;

  .twf {
    @include stack(var(--space-3));
    align-content: start;
  }

  .twf__line {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: var(--space-2);
    align-items: end;
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
</style>
