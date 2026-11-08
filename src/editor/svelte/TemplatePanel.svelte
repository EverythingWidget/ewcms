<!--
  An item template open (Pages > Site > Templates: ui.target { kind: 'item-template', id }):
  its file content/templates/<id>.json edited like a page, the preview its List of one sample
  item (src/site/widgets/list/template-preview.js). Two tabs:
    Widgets     its name, Link (the whole item opens its page) and Photo first, then the vertical stack of widgets (ListField: drag the grip or
                Alt+↑/↓ to reorder, × removes, Add Text / Photo / Button): each widget's role
                (its .li__<role> class) and settings, its values with {property} chips
                (Field.svelte formats: type {name}, or pick one).
    Style       the item style (src/site/widgets/list/item-style.js): one picker per key,
                Theme first (the key left out of the file)
    Properties  every property the template binds, renamed in one go: each {old} part in its
                widgets becomes {new} (lib/item-template.js renameProperty). Replaces the List's
                mapping for templates (a List using a template has no Properties rows).
  Templates are site-wide (no language): every List using one shows the edit on Save.
-->
<script>
  import { ui } from './ui.svelte.js';
  import Field from './Field.svelte';
  import ListField from './ListField.svelte';
  import Button from './Button.svelte';
  import Tabs from './Tabs.svelte';
  import { sourceIds as sourceIdsOf, templateFile } from '../../site/files.js';
  import { LINE_STYLES } from '../../site/text.js';
  import { schemaOf } from '../../site/schemas.js';
  import { sampleSource } from '../../site/widgets/list/template-preview.js';
  import { STYLE_ROWS } from '../lib/item-style-rows.js';
  import { isObject } from '../../site/is.js';
  import { PRESETS } from '../../site/widgets/list/presets.js';
  import { innerChoice, innerTemplates } from '../../site/widgets/list/nested.js';
  import { SBS, SBS_CHILDREN } from '../../site/widgets/list/side-by-side.js';
  import {
    ITEMS_FROM,
    innerSourceFor,
    STACK_TYPES,
    keepMarks,
    moveStack,
    newStackWidget,
    needsFrom,
    needsValue,
    TEMPLATE_MISSING,
    addAt,
    setDetails,
    renameProperty,
    runsOf,
    stackName,
    templateProperties,
  } from '../lib/item-template.js';

  // live: the reactive store (live.svelte.js)
  let { live } = $props();

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
  // {number}: every item's place in its List (01, 02 …)
  const binds = $derived([
    ...[...new Set([...own, ...used])]
      .filter((k) => k !== 'number' || own.includes('number'))
      .map((k) => ({ value: k, label: k })),
    ...(own.includes('number') ? [] : [{ value: 'number', label: 'Number (01, 02 …)' }]),
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
  // a widget by its pointer: "/widgets/2", or in a Side by side "/widgets/2/widgets/1"
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
    ['properties', 'Properties'],
    ['style', 'Style'],
  ];
  const tab = $derived.by(() => {
    const v = ui.sections[`tpltab:${id}`];
    return TABS.some(([t]) => t === v) ? v : 'widgets';
  });
  const style = $derived(isObject(tpl?.style) ? tpl.style : {});
  // a row picked Theme: its key removed (never saved); the last one: no "style" at all
  function setStyle(key, raw) {
    const v = STYLE_ROWS.find((r) => r.key === key).parse(raw);
    const next = { ...style };
    if (v === undefined) delete next[key];
    else next[key] = v;
    set('/style', Object.keys(next).length ? next : undefined, true);
  }

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
  const add = (type) => setWidgets(addAt(widgets, fresh(type)));
  // ---- items that open (src/site/widgets/list/opens.js)
  const opens = $derived(isObject(tpl?.opens));
  const cut = $derived(widgets.findIndex((w) => w?.details === true));
  const hasToggle = $derived(
    widgets.some(
      (w) => w?.type === 'toggle' || (w?.widgets || []).some((c) => c?.type === 'toggle'),
    ),
  );
  // an item that opens can't be a link: turning Opens on turns Link off
  function setOpens(on) {
    if (on) {
      set('/link', false);
      set('/opens', { several: false }, true);
    } else set('/opens', undefined, true);
  }
  const topOf = (b) => Number(b.split('/')[2]);
  // why Add toggle is off here ('' when it can): `top` the top-level widget it would go in
  const toggleOff = (top = -1) =>
    !opens
      ? 'Only for items that open'
      : hasToggle
        ? 'One toggle per template'
        : top >= 0 && cut >= 0 && top >= cut
          ? 'The toggle goes in the summary, before the details'
          : '';
  // a widget into the Side by side at `b`
  const addIn = (b, type) => set(`${b}/widgets`, [...(wAt(b).widgets || []), fresh(type)], true);
  const SBS_TYPES = STACK_TYPES.filter(([t]) => SBS_CHILDREN.includes(t));
  const SBS_ALIGN = [
    ['top', 'Top'],
    ['center', 'Middle'],
    ['bottom', 'Bottom'],
    ['baseline', 'Baseline'],
  ];
  const SBS_SPACING = SBS.spacing.map((n) => [String(n), `${n} px`]);
  const SBS_PHONE = [
    ['wrap', 'Wrap'],
    ['stack', 'Stack'],
    ['keep', 'Keep on one line'],
  ];
  const PHOTO_WIDTH = [
    ['', 'As wide as its share'],
    ['s', 'Small (64 px)'],
    ['m', 'Medium (96 px)'],
    ['l', 'Large (160 px)'],
  ];

  // ---- Properties: a rename commits on Enter or leaving the box (not per letter)
  let drafts = $state({});
  function rename(old, next) {
    const to = String(next || '').trim();
    delete drafts[old];
    if (!to || to === old) return;
    setWidgets(renameProperty(widgets, old, to));
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
  {:else if w.type === 'sideBySide'}
    <div class="tp__sbs">
      <Field
        edit={`${file}#${b}/config/align`}
        label="Align"
        type="select"
        value={w.config?.align || 'center'}
        options={SBS_ALIGN}
        onvalue={(v) => set(`${b}/config/align`, v)}
      />
      <Field
        edit={`${file}#${b}/config/spacing`}
        label="Space between"
        type="select"
        value={String(w.config?.spacing ?? 16)}
        options={SBS_SPACING}
        onvalue={(v) => set(`${b}/config/spacing`, Number(v))}
      />
      <Field
        edit={`${file}#${b}/config/phone`}
        label="On a phone"
        type="select"
        value={w.config?.phone || 'wrap'}
        options={SBS_PHONE}
        onvalue={(v) => set(`${b}/config/phone`, v)}
      />
    </div>
    {@const kids = Array.isArray(w.widgets) ? w.widgets : []}
    <ListField
      label="Side by side"
      items={kids}
      name={(c) => stackName(c)}
      addLabel="Add text"
      onmove={(x, y) => set(`${b}/widgets`, moveStack(kids, x, y), true)}
      onremove={(j) =>
        set(
          `${b}/widgets`,
          kids.filter((_, k) => k !== j),
          true,
        )}
      onadd={() => addIn(b, 'text')}
    >
      {#snippet item(c, j)}
        {@const cb = `${b}/widgets/${j}`}
        <Field
          edit={`${file}#${cb}/grow`}
          label="Fill the space"
          type="boolean"
          value={c.grow === true}
          disabled={c.grow !== true && kids.some((k) => k.grow === true)}
          help={c.grow !== true && kids.some((k) => k.grow === true)
            ? 'Another widget here fills the space'
            : 'It takes the space left, pushing the next ones to the end'}
          onvalue={(v) => set(`${cb}/grow`, v ? true : undefined)}
        />
        {#if c.type === 'photo'}
          <Field
            edit={`${file}#${cb}/config/width`}
            label="Photo width"
            type="select"
            value={c.config?.width || ''}
            options={PHOTO_WIDTH}
            onvalue={(v) => set(`${cb}/config/width`, v || undefined)}
          />
        {/if}
        {@render editW(c, cb)}
      {/snippet}
    </ListField>
    <div class="tp__add" role="group" aria-label="Add a widget to Side by side">
      {#each SBS_TYPES as [t, label] (t)}
        <Button
          size="small"
          icon="plus"
          disabled={kids.length >= 6 || (t === 'toggle' && !!toggleOff(topOf(b)))}
          title={kids.length >= 6
            ? 'Six widgets at most'
            : t === 'toggle' && toggleOff(topOf(b))
              ? toggleOff(topOf(b))
              : undefined}
          onclick={() => addIn(b, t)}>Add {label.toLowerCase()}</Button
        >
      {/each}
    </div>
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
<section class="ed-body tp" data-template-panel={id}>
  {#if !tpl}
    <p class="hint">No template {id} (content/templates/{id}.json)</p>
  {:else if tab === 'widgets'}
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
      label="Link: whole item opens the item’s page"
      type="boolean"
      value={!opens && tpl.link !== false}
      disabled={opens}
      help={opens ? 'An item that opens can’t also be a link' : ''}
      changed={live.changed(file, '/link')}
      onvalue={(v) => set('/link', v)}
    />
    <Field
      edit={`${file}#/opens`}
      label="Opens: items open and close"
      type="boolean"
      value={opens}
      disabled={!!outer && !opens}
      help={outer
        ? 'This template is shown inside another List: its items can’t open'
        : 'Each item shows its summary; its details open below it'}
      changed={live.changed(file, '/opens')}
      onvalue={(v) => setOpens(v)}
    />
    <Field
      edit={`${file}#/opens/several`}
      label="Several open at once"
      type="boolean"
      value={tpl.opens?.several === true}
      disabled={!opens}
      help="Off: opening one closes the open one"
      changed={live.changed(file, '/opens/several')}
      onvalue={(v) => set('/opens/several', v)}
    />
    <Field
      edit={`${file}#/photoFirst`}
      label="Photo first: a leading photo set apart"
      type="boolean"
      value={tpl.photoFirst !== false}
      changed={live.changed(file, '/photoFirst')}
      onvalue={(v) => set('/photoFirst', v)}
    />
    <p class="hint small tp__sample">
      {from
        ? `Preview: the first item of ${schema?.label || from}`
        : 'Preview: a hand-made sample item (no source)'}
    </p>
    <ListField
      label="Widgets"
      items={widgets}
      name={(w) => stackName(w)}
      addLabel="Add text"
      onmove={(a, b) => setWidgets(moveStack(widgets, a, b))}
      onremove={(i) => setWidgets(widgets.filter((_, k) => k !== i))}
      onadd={() => add('text')}
    >
      {#snippet item(w, i)}
        {#if opens && w.details === true}
          <p class="tp__divider" data-details-divider>Details, hidden until opened</p>
        {/if}
        <Field
          edit={`${file}#/widgets/${i}/details`}
          label="Details start here"
          type="boolean"
          value={opens && w.details === true}
          disabled={!opens || i === 0}
          help={!opens
            ? 'For items that open'
            : i === 0
              ? 'The summary needs a widget before the details'
              : 'It and the widgets after it are the details'}
          onvalue={(v) => setWidgets(setDetails(widgets, v ? i : -1))}
        />
        {@render editW(w, `/widgets/${i}`)}
      {/snippet}
    </ListField>
    <div class="tp__add" role="group" aria-label="Add a widget">
      {#each STACK_TYPES.filter(([t]) => t !== 'text') as [t, label] (t)}
        <Button
          size="small"
          icon="plus"
          disabled={(t === 'list' && !!outer) || (t === 'toggle' && !!toggleOff())}
          title={t === 'list' && outer
            ? 'This template is shown inside another List: a list here would be a third level'
            : t === 'toggle' && toggleOff()
              ? toggleOff()
              : undefined}
          onclick={() => add(t)}>Add {label.toLowerCase()}</Button
        >
      {/each}
    </div>
  {:else if tab === 'style'}
    <p class="hint small">How each item looks. Theme: the site theme’s value.</p>
    <div class="tp__style" data-template-style>
      {#each STYLE_ROWS as r (r.key)}
        <Field
          edit={`${file}#/style/${r.key}`}
          label={r.label}
          type="select"
          half
          value={style[r.key] === undefined ? '' : String(style[r.key])}
          options={r.options}
          changed={live.changed(file, `/style/${r.key}`)}
          onvalue={(v) => setStyle(r.key, v)}
        />
      {/each}
    </div>
  {:else}
    <p class="hint small">
      The properties its widgets show. A new name changes every chip of it in this template{from
        ? `; ${schema?.label || from} has: ${own.join(', ')}`
        : ''}.
    </p>
    {#if !used.length}<p class="hint">No properties in this template yet</p>{/if}
    <div class="tp__props" data-template-properties>
      {#each used as name (name)}
        <label class="tp__prop">
          <span class="tf__label">{name}</span>
          <input
            class="tf__input"
            value={drafts[name] ?? name}
            aria-label="Rename the property {name}"
            oninput={(e) => (drafts[name] = e.currentTarget.value)}
            onchange={(e) => rename(name, e.currentTarget.value)}
            onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <span class={['tp__state', from && !own.includes(drafts[name] ?? name) && 'is-warn']}>
            {from && !own.includes(drafts[name] ?? name) ? `Not in ${schema?.label || from}` : ''}
          </span>
        </label>
      {/each}
    </div>
  {/if}
</section>

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

  // the line between the summary and the details (inside the widget's card: no shift)
  .tp__divider {
    margin: 0;
    padding-bottom: var(--space-2);
    font-size: var(--fs-base);
    color: var(--c-text-muted);
    box-shadow: inset 0 -1px 0 var(--c-line, currentcolor);
  }

  .tp__sbs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .tp__pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .tp__add {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .tp__style {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--gap-rows) var(--space-2);
  }

  .tp__props {
    @include stack(var(--space-2));
  }

  .tp__prop {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: var(--space-1) var(--space-2);
    align-items: center;
  }

  // reserved: the line is there with or without a warning (no shift)
  .tp__state {
    grid-column: 2;
    min-height: 16px;
    font-size: var(--fs-base);
    line-height: 16px;
    color: var(--c-text-muted);

    &.is-warn {
      color: var(--c-warning);
    }
  }
</style>
