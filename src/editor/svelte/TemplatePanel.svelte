<!--
  An item template open (Pages > Site > Templates: ui.target { kind: 'item-template', id }):
  its file content/templates/<id>.json edited like a page, the preview its List of one sample
  item (src/site/widgets/list/template-preview.js). Two tabs:
    Widgets     the always-selected section card (SectionCard.svelte) of its widgets, with
                WidgetRow rows and Add widget (SectionToolbar, add only when no widget is
                selected: a new widget goes on the grid, free, below the others). A row
                selects that widget in the preview and vice versa; a selected widget has the
                same toolbar actions as a page widget (gear, locate, eye, copy, trash) and
                its settings in the same pop-up (WidgetPopup.svelte: Content and Layout; only
                the fields that apply to a template, TemplateWidgetFields.svelte). Delete is
                one undo step, in place. It is placed and sized on the preview grid: the
                Grid Engine, the overlay's drag, resize and links (../overlay.js).
    Settings    its Name (as in a List’s Template picker), Whole item clickable (the whole
                item opens the item’s page), and the preview line. Columns (the preview’s:
                the item as wide as in a List of 1–6 columns; preview.columns, never a
                List’s) is a pill above the preview frame (TemplateCols.svelte).
  The file is one section (src/site/widgets/list/item-grid.js): its widgets at
  /sections/0/widgets, as a page section’s. Templates are site-wide (no language): every List
  using one shows the edit on Save.
-->
<script>
  import { ui, selectWidgets, openPopup } from './ui.svelte.js';
  import Field from './Field.svelte';
  import Tabs from './Tabs.svelte';
  import SectionCard from './SectionCard.svelte';
  import SectionToolbar from './SectionToolbar.svelte';
  import WidgetsModal from './WidgetsModal.svelte';
  import { templateFile } from '../../site/files.js';
  import { schemaOf } from '../../site/schemas.js';
  import { sampleSource } from '../../site/widgets/list/template-preview.js';
  import { ITEM_WIDGETS, itemSection } from '../../site/widgets/list/item-grid.js';
  import { innerTemplates } from '../../site/widgets/list/nested.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import {
    STACK_TYPES,
    moveStack,
    newStackWidget,
    addAt,
    templateProperties,
  } from '../lib/item-template.js';

  // live: the reactive store (live.svelte.js)
  let { live, bridge = null } = $props();

  const id = $derived(ui.target.id);
  const file = $derived(templateFile(id));
  const tpl = $derived.by(() => {
    live.version;
    return live.current(file) || null;
  });
  const section = $derived(itemSection(tpl));
  const widgets = $derived(Array.isArray(section?.widgets) ? section.widgets : []);
  // the sample's source: its properties are the chips' names and the binds offered
  const from = $derived(sampleSource(live.content, tpl));
  const schema = $derived(from ? schemaOf(live.content, from) : null);
  const used = $derived(templateProperties(widgets));
  const templates = $derived(live.content?.templates || {});
  const outer = $derived(
    Object.entries(templates).find(([, t]) => innerTemplates(t).includes(id))?.[0] || '',
  );
  const listProps = $derived(
    (schema?.properties || [])
      .filter(
        (p) =>
          p.type === 'photos' || (from && Array.isArray(live.content.sources[from]?.[0]?.[p.key])),
      )
      .map((p) => [p.key, p.label || p.key]),
  );
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
  const setWidgets = (next) => set(ITEM_WIDGETS, next, true);
  const fresh = (type) =>
    newStackWidget(
      type,
      used[0] || schema?.title || 'title',
      'View',
      listProps[0]?.[0] || 'photos',
    );
  // where the item's widgets show now (the preview's rows.js: --fr / --frs), so a new widget
  // goes below the lowest one as it is seen (an Auto one's real height counts)
  const shownRows = () =>
    Object.fromEntries(
      [...(bridge?.doc?.querySelectorAll('.sec--item > [data-tw]') || [])].map((el) => [
        el.dataset.tw,
        {
          row: parseInt(el.style.getPropertyValue('--fr'), 10),
          rows: parseInt(el.style.getPropertyValue('--frs'), 10),
        },
      ]),
    );
  const add = (type) => {
    if (type === 'details') set('/clickable', false);
    const next = addAt(widgets, fresh(type), shownRows());
    setWidgets(next);
    const wid = next[next.length - 1]?.id;
    if (wid) {
      selectWidgets([wid]);
      openPopup();
    }
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
  const card = $derived({
    id: section?.id || 's-tpl',
    name: (typeof tpl?.name === 'string' && tpl.name.trim()) || '',
    // title from role so WidgetRow shows Type / role (nameOf reads title, not role)
    widgets: widgets.map((w) => (w?.role && !w.title ? { ...w, title: w.role } : w)),
  });
  let widgetsModal = $state();
  const typeTiles = $derived(
    STACK_TYPES.filter(
      ([type]) => !(type === 'list' && outer) && !(type === 'details' && detailsOff),
    ).map(([type]) => {
      const d = WIDGET_TYPES[type] || {};
      return {
        value: type,
        label: d.label || type,
        icon: d.icon,
        line: d.line,
        sketch: d.sketch,
      };
    }),
  );
  function pickAdd(type) {
    if ((type === 'list' && outer) || (type === 'details' && detailsOff)) return;
    add(type);
  }
</script>

<Tabs
  tabs={TABS}
  value={tab}
  onpick={(v) => (ui.sections[`tpltab:${id}`] = v)}
  label="Template"
  class="page-tabs"
/>
{#if tab === 'widgets' && tpl}
  <SectionToolbar addOnly {live} {file} {bridge} onadd={() => widgetsModal?.open(0)} />
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
      onopen={(wid) => (selectWidgets([wid]), openPopup())}
      onreorder={(from, to) => setWidgets(moveStack(widgets, from, to))}
      changed={live.changed(file, ITEM_WIDGETS)}
    />
  {:else if tab === 'settings'}
    <Field
      edit={`${file}#/name`}
      label="Name"
      value={tpl.name}
      help="Its name in a List’s Template picker"
      changed={live.changed(file, '/name')}
      onvalue={(v) => set('/name', v)}
    />
    <Field
      edit={`${file}#/clickable`}
      label="Whole item clickable"
      type="boolean"
      value={!hasDetails && tpl.clickable !== false}
      disabled={hasDetails}
      help={hasDetails
        ? 'An item that opens can’t also be a link'
        : 'The whole item opens the item’s page.'}
      changed={live.changed(file, '/clickable')}
      onvalue={(v) => set('/clickable', v)}
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
</style>
