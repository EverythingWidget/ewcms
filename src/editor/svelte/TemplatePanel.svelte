<!--
  An item template open (Pages > Site > Templates: ui.target { kind: 'item-template', id }):
  its file content/templates/<id>.json edited like a page, the preview its List of one sample
  item (src/site/widgets/list/template-preview.js). Two tabs:
    Widgets     the always-selected section card (SectionCard.svelte) of its widgets, with
                WidgetRow rows and Add widget (SectionToolbar, add only). A row selects that
                widget in the preview and vice versa; its settings (role, binds, …) are under
                the card while it is selected. Placement is on the preview grid.
    Settings    its Name (as in a List’s Template picker), Whole item clickable (the whole
                item opens the item’s page), and the preview line.
  Templates are site-wide (no language): every List using one shows the edit on Save.
-->
<script>
  import { ui, selectWidgets } from './ui.svelte.js';
  import Field from './Field.svelte';
  import Button from './Button.svelte';
  import Tabs from './Tabs.svelte';
  import SectionCard from './SectionCard.svelte';
  import SectionToolbar from './SectionToolbar.svelte';
  import WidgetsModal from './WidgetsModal.svelte';
  import { sourceIds as sourceIdsOf, templateFile } from '../../site/files.js';
  import { LINE_STYLES } from '../../site/text.js';
  import { schemaOf } from '../../site/schemas.js';
  import { sampleSource } from '../../site/widgets/list/template-preview.js';
  import { PRESETS } from '../../site/widgets/list/presets.js';
  import { innerChoice, innerTemplates } from '../../site/widgets/list/nested.js';
  import { MIN_TEXT_PX, sizeLine, textSizes } from '../lib/small-text.js';
  import { CAROUSEL, CAROUSEL_KEYS, withArrangement } from '../../site/widgets/list/carousel.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import {
    ITEMS_FROM,
    innerSourceFor,
    STACK_TYPES,
    keepMarks,
    moveStack,
    removeWidget,
    newStackWidget,
    needsFrom,
    needsValue,
    TEMPLATE_MISSING,
    addAt,
    runsOf,
    templateProperties,
  } from '../lib/item-template.js';

  // live: the reactive store (live.svelte.js)
  let { live, bridge = null } = $props();
  // each widget's smallest text in the preview (lib/small-text.js): read while the panel is open
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

  const id = $derived(ui.target.id);
  const file = $derived(templateFile(id));
  const tpl = $derived.by(() => {
    live.version;
    return live.current(file) || null;
  });
  const widgets = $derived(Array.isArray(tpl?.widgets) ? tpl.widgets : []);
  // the sample's source: its properties are the chips' names and the binds offered
  const from = $derived(sampleSource(live.content, tpl));
  const schema = $derived(from ? schemaOf(live.content, from) : null);
  const own = $derived((schema?.properties || []).map((p) => p.key));
  const used = $derived(templateProperties(widgets));
  // {number}: every item's place in its List (01, 02 …); {back}: the page around it (a
  // [param] page's), else the source's page; an item's own property of that name wins
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
  const names = $derived(new Set(binds.map((b) => b.value)));

  // ---- nested Lists (src/site/widgets/list/nested.js): two levels at most
  const templates = $derived(live.content?.templates || {});
  // a template another template's inner List uses: a list here would be a third level
  const outer = $derived(
    Object.entries(templates).find(([, t]) => innerTemplates(t).includes(id))?.[0] || '',
  );
  // its outer item's properties: {parent: name} binds
  const parentFrom = $derived(outer ? sampleSource(live.content, templates[outer]) : '');
  const parentKeys = $derived(
    parentFrom ? (schemaOf(live.content, parentFrom)?.properties || []).map((p) => p.key) : [],
  );
  const allBinds = $derived([
    ...binds,
    ...parentKeys.map((k) => ({ value: `parent:${k}`, label: `parent: ${k}` })),
  ]);
  // the item's list properties (Photos, or any whose value is a list)
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
  // presets, then the templates: one that loops is left out, one that would be a third level
  // is there, disabled, with why
  const innerOptions = $derived([
    ...PRESETS.map((p) => [p.id, p.label]),
    ...Object.entries(templates)
      .filter(([t]) => t !== id && innerChoice(templates, id, t) !== 'loop')
      .map(([t, tp]) =>
        innerChoice(templates, id, t) === 'deep'
          ? [t, tp.label || t, { disabled: true, hint: 'It holds a list: a third level' }]
          : innerChoice(templates, id, t) === 'opens'
            ? [t, tp.label || t, { disabled: true, hint: 'Its items open: not inside a List' }]
            : [t, tp.label || t],
      ),
  ]);
  const COLUMNS = ['1', '2', '3', '4', '5', '6'].map((n) => [n, n]);
  const GAPS = [
    ['s', 'S'],
    ['m', 'M'],
    ['l', 'L'],
  ];
  // a widget by its pointer: "/widgets/2"
  const wAt = (b) =>
    b
      .split('/')
      .slice(1)
      .reduce((o, k) => o?.[k], tpl) || {};
  function setInner(b, mode) {
    const prev = wAt(b).source || {};
    set(
      `${b}/source`,
      innerSourceFor(mode, prev, {
        listProperty: listProps[0]?.[0] || 'photos',
        source: from || sourceIds[0] || '',
        own: schema?.slug || 'slug',
      }),
      true,
    );
  }
  function setRule(b, key, v) {
    const where = structuredClone(wAt(b).source?.where || { op: 'and', rules: [{}] });
    where.rules[0] = { ...where.rules[0], [key]: v };
    set(`${b}/source/where`, where, true);
  }

  const TABS = [
    ['widgets', 'Widgets'],
    ['settings', 'Settings'],
  ];
  const tab = $derived.by(() => {
    const v = ui.sections[`tpltab:${id}`];
    return TABS.some(([t]) => t === v) ? v : 'widgets';
  });
  const set = (ptr, value, structure = false) =>
    live.store.set(file, ptr, value, { source: 'panel', structure });
  const setWidgets = (next) => set('/widgets', next, true);
  const STYLES = LINE_STYLES.map(([v, l]) => [v, l]);

  function setLine(b, j, key, value) {
    const body = structuredClone(wAt(b).body || []);
    body[j] = {
      ...body[j],
      [key]: key === 'text' ? keepMarks(body[j].text, runsOf(value)) : value,
    };
    set(`${b}/body`, body);
  }
  function addLine(b) {
    const body = [...(wAt(b).body || []), { style: 'paragraph', text: [] }];
    set(`${b}/body`, body, true);
  }
  function removeLine(b, j) {
    const body = (wAt(b).body || []).filter((_, k) => k !== j);
    set(`${b}/body`, body, true);
  }
  function setRole(b, v) {
    const role = String(v || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    set(`${b}/role`, role || undefined);
  }
  const fresh = (type) =>
    newStackWidget(
      type,
      used[0] || schema?.title || 'title',
      'View',
      listProps[0]?.[0] || 'photos',
    );
  const add = (type) => {
    if (type === 'details') set('/link', false);
    const next = addAt(widgets, fresh(type));
    setWidgets(next);
    const id = next[next.length - 1]?.id;
    if (id) selectWidgets([id]);
  };
  // ---- Summary and details (src/site/widgets/list/details.js): one per template; the item
  // is then the summary's button, not a link
  const hasDetails = $derived(widgets.some((w) => w?.type === 'details'));
  const detailsOff = $derived(
    outer
      ? 'This template is shown inside another List: its items can’t open'
      : hasDetails
        ? 'One Summary and details per template'
        : '',
  );
  const detailsOptions = $derived(
    Object.entries(templates)
      .filter(([t]) => t !== id)
      .map(([t, tp]) =>
        tp?.widgets?.some?.((w) => w?.type === 'details')
          ? [t, tp.label || t, { disabled: true, hint: 'It has Summary and details of its own' }]
          : [t, tp.label || t],
      ),
  );
  // an inner List's Arrangement and Carousel rows (the List's own definitions)
  const LIST_CONFIG = WIDGET_TYPES.list.config;
  const ARRANGE = LIST_CONFIG.find((c) => c.key === 'arrangement').options;
  const CAR_ROWS = LIST_CONFIG.filter((c) => CAROUSEL_KEYS.includes(c.key));
  const card = $derived({
    id: 's-tpl',
    name: (typeof tpl?.label === 'string' && tpl.label.trim()) || '',
    // title from role so WidgetRow shows Type / role (nameOf reads title, not role)
    widgets: widgets.map((w) => (w?.role && !w.title ? { ...w, title: w.role } : w)),
  });
  const selectedAt = $derived(widgets.findIndex((w) => w?.id && w.id === ui.widget));
  const selected = $derived(selectedAt >= 0 ? widgets[selectedAt] : null);
  let widgetsModal = $state();
  const typeTiles = $derived(
    STACK_TYPES.filter(([type]) => !(type === 'list' && outer) && !(type === 'details' && detailsOff)).map(
      ([type]) => {
        const d = WIDGET_TYPES[type] || {};
        return {
          value: type,
          label: d.label || type,
          icon: d.icon,
          line: d.line,
          sketch: d.sketch,
        };
      },
    ),
  );
  function pickAdd(type) {
    if ((type === 'list' && outer) || (type === 'details' && detailsOff)) return;
    add(type);
  }
</script>

{#snippet editW(w, b)}
  <Field
    edit={`${file}#${b}/role`}
    label="Role"
    value={w.role || ''}
    placeholder="none"
    help="Its class: .li__<role>"
    onvalue={(v) => setRole(b, v)}
  />
  {#if ['text', 'photo', 'button'].includes(w.type)}
    <!-- When a value is missing / Also needs (src/site/layout/missing.js): always both rows -->
    <div class="tp__pair">
      <Field
        edit={`${file}#${b}/config/missing`}
        label="When a value is missing"
        type="select"
        value={w.config?.missing || ''}
        options={TEMPLATE_MISSING}
        onvalue={(v) => set(`${b}/config/missing`, v || undefined, true)}
      />
      <Field
        edit={`${file}#${b}/config/needs`}
        label="Also needs"
        value={needsValue(w.config?.needs)}
        binds={allBinds}
        {names}
        formats
        {from}
        disabled={w.config?.missing === 'show'}
        help="Hidden when one of these is empty, too"
        onvalue={(v) => set(`${b}/config/needs`, needsFrom(v), true)}
      />
    </div>
  {/if}
  {#if w.type === 'text'}
    {#each w.body || [] as l, j (j)}
      <div class="tp__line">
        <Field
          edit={`${file}#${b}/body/${j}/style`}
          label="Line {j + 1}"
          type="select"
          value={l.style}
          options={STYLES}
          onvalue={(v) => setLine(b, j, 'style', v)}
        />
        <Field
          edit={`${file}#${b}/body/${j}/text`}
          label="Text"
          value={l.text}
          binds={allBinds}
          {names}
          formats
          {from}
          onvalue={(v) => setLine(b, j, 'text', v)}
        />
        {#if (w.body || []).length > 1}
          <Button
            size="small"
            icon="xmark"
            iconOnly
            label="Remove line {j + 1}"
            onclick={() => removeLine(b, j)}
          />
        {/if}
      </div>
    {/each}
    <span class="tp__start"
      ><Button size="small" icon="plus" onclick={() => addLine(b)}>Add line</Button></span
    >
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
    <div class="tp__match">
      <Field
        edit={`${file}#${b}/source/where/rules/0/property`}
        label="Match: their property"
        type="select"
        value={src.where?.rules?.[0]?.property || ''}
        options={propsOf(src.from)}
        disabled={mode !== 'match'}
        onvalue={(v) => setRule(b, 'property', v)}
      />
      <span class="tp__is">is this item’s</span>
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
    <div class="tp__pair">
      <Field
        edit={`${file}#${b}/config/columns`}
        label="Columns"
        type="select"
        value={w.config?.columns || '3'}
        options={COLUMNS}
        onvalue={(v) => set(`${b}/config/columns`, v)}
      />
      <Field
        edit={`${file}#${b}/config/gap`}
        label="Space between items"
        type="select"
        value={w.config?.gap || 'm'}
        options={GAPS}
        onvalue={(v) => set(`${b}/config/gap`, v)}
      />
    </div>
    <!-- Arrangement, and the Carousel's settings: always shown, disabled with Grid -->
    <Field
      edit={`${file}#${b}/config/arrangement`}
      label="Arrangement"
      type="select"
      value={w.config?.arrangement || 'grid'}
      options={ARRANGE}
      onvalue={(v) => set(`${b}/config`, withArrangement(w.config, v), true)}
    />
    <div class="tp__pair">
      {#each CAR_ROWS as c (c.key)}
        <Field
          edit={`${file}#${b}/config/${c.key}`}
          label={c.label}
          type={c.type === 'boolean' ? 'boolean' : 'select'}
          value={c.type === 'boolean'
            ? (w.config?.[c.key] ?? CAROUSEL[c.key][0]) === true
            : (w.config?.[c.key] ?? CAROUSEL[c.key][0])}
          options={c.options ?? []}
          disabled={w.config?.arrangement !== 'carousel'}
          onvalue={(v) => set(`${b}/config/${c.key}`, v)}
        />
      {/each}
    </div>
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
{/snippet}

<Tabs
  tabs={TABS}
  value={tab}
  onpick={(v) => (ui.sections[`tpltab:${id}`] = v)}
  label="Template"
  class="page-tabs"
/>
{#if tab === 'widgets' && tpl}
  <SectionToolbar addOnly {live} {file} onadd={() => widgetsModal?.open(0)} />
{/if}
<section class="ed-body tp" data-template-panel={id}>
  {#if !tpl}
    <p class="hint">No template {id} (content/templates/{id}.json)</p>
  {:else if tab === 'widgets'}
    {#if outer}
      <p class="hint small">
        This template is shown inside another List: a list here would be a third level
      </p>
    {/if}
    <SectionCard
      {live}
      {file}
      at={0}
      section={card}
      selected
      onselect={() => {}}
      onsection={() => {}}
      onopen={(wid) => selectWidgets([wid])}
      onreorder={(from, to) => setWidgets(moveStack(widgets, from, to))}
      changed={live.changed(file, '/widgets')}
    />
    {#if selected && selectedAt >= 0}
      <p
        class="hint small tp__size"
        class:tp__size--warn={sizes[selected.id] < MIN_TEXT_PX}
        data-text-size={selected.id}
      >
        {sizeLine(sizes[selected.id]) || 'No text in the preview'}
      </p>
      {@render editW(selected, `/widgets/${selectedAt}`)}
      <Button size="small" icon="trash" onclick={() => {
        setWidgets(removeWidget(widgets, selectedAt));
        selectWidgets([]);
      }}>Remove widget</Button>
    {/if}
  {:else if tab === 'settings'}
    <Field
      edit={`${file}#/label`}
      label="Name"
      value={tpl.label}
      help="Its name in a List’s Template picker"
      changed={live.changed(file, '/label')}
      onvalue={(v) => set('/label', v)}
    />
    <Field
      edit={`${file}#/link`}
      label="Whole item clickable"
      type="boolean"
      value={!hasDetails && tpl.link !== false}
      disabled={hasDetails}
      help={hasDetails
        ? 'An item that opens can’t also be a link'
        : 'The whole item opens the item’s page.'}
      changed={live.changed(file, '/link')}
      onvalue={(v) => set('/link', v)}
    />
    <p class="hint small tp__sample">
      {from
        ? `Preview: the first item of ${schema?.label || from}`
        : 'Preview: a hand-made sample item (no source)'}
    </p>
  {/if}
</section>
<WidgetsModal bind:this={widgetsModal} types={typeTiles} onpick={(type) => pickAdd(type)} />

<style lang="scss">
  @use '../styles/mixins' as *;

  .tp {
    @include stack(var(--space-3));
    align-content: start;
  }

  .tp__line {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr) var(--size-control);
    gap: var(--space-2);
    align-items: end;
  }

  .tp__start {
    justify-self: start;
  }

  .tp__match {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: var(--space-2);
    align-items: end;
  }

  .tp__is {
    height: var(--size-control);
    line-height: var(--size-control);
    color: var(--c-text-muted);
  }

  .tp__size {
    overflow: hidden;
    height: 16px;
    margin: 0;
    line-height: 16px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .tp__size--warn {
    color: var(--c-warning);
  }

  .tp__pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }
</style>
