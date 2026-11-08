<!--
  An item template open (Pages > Site > Templates: ui.target { kind: 'item-template', id }):
  its file content/templates/<id>.json edited like a page, the preview its List of one sample
  item (src/site/widgets/list/template-preview.js). Two tabs:
    Widgets     its name, Link (the whole item opens its page) and Photo first, then the vertical stack of widgets (ListField: drag the grip or
                Alt+↑/↓ to reorder, × removes, Add Text / Photo / Button): each widget's role
                (its .li__<role> class) and settings, its values with {property} chips
                (Field.svelte formats: type {name}, or pick one).
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
  import { templateFile } from '../../site/files.js';
  import { LINE_STYLES } from '../../site/text.js';
  import { schemaOf } from '../../site/schemas.js';
  import { sampleSource } from '../../site/widgets/list/template-preview.js';
  import {
    STACK_TYPES,
    moveStack,
    newStackWidget,
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
  const binds = $derived([...new Set([...own, ...used])].map((k) => ({ value: k, label: k })));
  const names = $derived(new Set(binds.map((b) => b.value)));

  const TABS = [
    ['widgets', 'Widgets'],
    ['properties', 'Properties'],
  ];
  const tab = $derived(ui.sections[`tpltab:${id}`] === 'properties' ? 'properties' : 'widgets');

  const set = (ptr, value, structure = false) =>
    live.store.set(file, ptr, value, { source: 'panel', structure });
  const setWidgets = (next) => set('/widgets', next, true);
  const STYLES = LINE_STYLES.map(([v, l]) => [v, l]);

  function setLine(i, j, key, value) {
    const body = structuredClone(widgets[i].body || []);
    body[j] = { ...body[j], [key]: key === 'text' ? runsOf(value) : value };
    set(`/widgets/${i}/body`, body);
  }
  function addLine(i) {
    const body = [...(widgets[i].body || []), { style: 'paragraph', text: [] }];
    set(`/widgets/${i}/body`, body, true);
  }
  function removeLine(i, j) {
    const body = (widgets[i].body || []).filter((_, k) => k !== j);
    set(`/widgets/${i}/body`, body, true);
  }
  function setRole(i, v) {
    const role = String(v || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    set(`/widgets/${i}/role`, role || undefined);
  }
  const add = (type) =>
    setWidgets([...widgets, newStackWidget(type, used[0] || schema?.title || 'title')]);

  // ---- Properties: a rename commits on Enter or leaving the box (not per letter)
  let drafts = $state({});
  function rename(old, next) {
    const to = String(next || '').trim();
    delete drafts[old];
    if (!to || to === old) return;
    setWidgets(renameProperty(widgets, old, to));
  }
</script>

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
      value={tpl.link !== false}
      changed={live.changed(file, '/link')}
      onvalue={(v) => set('/link', v)}
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
        <Field
          edit={`${file}#/widgets/${i}/role`}
          label="Role"
          value={w.role || ''}
          placeholder="none"
          help="Its class: .li__<role>"
          onvalue={(v) => setRole(i, v)}
        />
        {#if w.type === 'text'}
          {#each w.body || [] as l, j (j)}
            <div class="tp__line">
              <Field
                edit={`${file}#/widgets/${i}/body/${j}/style`}
                label="Line {j + 1}"
                type="select"
                value={l.style}
                options={STYLES}
                onvalue={(v) => setLine(i, j, 'style', v)}
              />
              <Field
                edit={`${file}#/widgets/${i}/body/${j}/text`}
                label="Text"
                value={l.text}
                {binds}
                {names}
                formats
                {from}
                onvalue={(v) => setLine(i, j, 'text', v)}
              />
              {#if (w.body || []).length > 1}
                <Button
                  size="small"
                  icon="xmark"
                  iconOnly
                  label="Remove line {j + 1}"
                  onclick={() => removeLine(i, j)}
                />
              {/if}
            </div>
          {/each}
          <span class="tp__start"
            ><Button size="small" icon="plus" onclick={() => addLine(i)}>Add line</Button></span
          >
          {#if w.join !== undefined}
            <Field
              edit={`${file}#/widgets/${i}/join`}
              label="Between facts"
              value={w.join}
              help="Its first line’s properties joined by it; an empty one takes none"
              onvalue={(v) => set(`/widgets/${i}/join`, v)}
            />
          {/if}
        {:else if w.type === 'photo'}
          <Field
            edit={`${file}#/widgets/${i}/src`}
            label="Photo"
            value={w.src}
            {binds}
            {names}
            formats
            {from}
            onvalue={(v) => set(`/widgets/${i}/src`, v)}
          />
        {:else if w.type === 'button'}
          <Field
            edit={`${file}#/widgets/${i}/label`}
            label="Label"
            value={w.label}
            {binds}
            {names}
            formats
            {from}
            onvalue={(v) => set(`/widgets/${i}/label`, v)}
          />
          <Field
            edit={`${file}#/widgets/${i}/itemLink`}
            label="Opens the item’s page"
            type="boolean"
            value={w.itemLink === true}
            onvalue={(v) => set(`/widgets/${i}/itemLink`, v ? true : undefined)}
          />
        {/if}
      {/snippet}
    </ListField>
    <div class="tp__add" role="group" aria-label="Add a widget">
      {#each STACK_TYPES.filter(([t]) => t !== 'text') as [t, label] (t)}
        <Button size="small" icon="plus" onclick={() => add(t)}>Add {label.toLowerCase()}</Button>
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

  .tp__add {
    display: flex;
    gap: var(--space-2);
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
