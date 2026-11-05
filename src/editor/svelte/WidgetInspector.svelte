<!--
  One widget of the page (ui.widget), its two tabs (every widget has both; the last one picked
  is kept for every widget, browser-side: ui.sections["widgettab"], ../widget-layout.js):
    Layout   what its type supports: size, layer, what it follows, its content box,
             placement, Scale to fit (WidgetLayout.svelte; where it sits is dragged in the
             preview, overlay.js)
    Content  its source (WidgetSource.svelte: Item / All, From URL or None, and on a [param] page
             whether it is the main widget), then its settings and texts (GroupFields.svelte),
             each bindable setting with its picker: Custom or a property of the item it shows
  (its motion is in the page's Element motion tab, MotionPanel.svelte)
  One level under the list of sections (a widget's row on its section's card, or the widget
  clicked in the preview): its top (ViewTop.svelte: ← Back to the list, Locate), then the widget
  in a card: its type and title (Main: the page's main widget), the tabs and their fields. Both
  tabs are laid out in one place, the one not shown hidden: its height is the taller one's, so
  switching moves nothing.
-->
<script>
  import GroupFields from './GroupFields.svelte';
  import WidgetSource from './WidgetSource.svelte';
  import Tabs from './Tabs.svelte';
  import { schemaFor } from './source-items.js';
  import { isTemplate, pageIdOf, sourceFile } from '../../site/files.js';
  import { resolve } from '../../site/layout/bindings.js';
  import { BIND_TYPES } from '../../site/property-types.js';
  import { widgetItems, sourceOf } from '../../site/layout/source.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import { ui } from './ui.svelte.js';
  import ViewTop from './ViewTop.svelte';
  import WidgetLayout from './WidgetLayout.svelte';
  import { WIDGET_TABS, WIDGET_TAB_KEY, widgetTabOf } from '../widget-layout.js';

  // bare: in the pop-up (WidgetPopup.svelte, its header has the type and name): no Back row,
  // no card, no title line
  let { g, live, bridge, sourceIds, onsource, onback, bare = false } = $props();

  // Content | Layout: the last one picked, for every widget
  const tab = $derived(widgetTabOf(ui.sections));
  const pickTab = (v) => (ui.sections[WIDGET_TAB_KEY] = v);
  const { at, j } = $derived(g.widget);
  const base = $derived(`/sections/${at}/widgets/${j}`);
  const widget = $derived.by(() => {
    live.version;
    return live.get(g.file, base) || {};
  });
  const type = $derived(WIDGET_TYPES[g.type] || {});

  // ---- what it shows (src/site/layout/source.js): on a [param] page with the page the
  // preview shows (its params), the item its bound settings show the first
  const pageId = $derived(pageIdOf(g.file) || '');
  // (read on its own: the store changes a value in place, so `widget` stays the same object)
  const source = $derived.by(() => {
    live.version;
    const v = live.get(g.file, `${base}/source`);
    return v && typeof v === 'object' ? structuredClone(v) : null;
  });
  const shown = $derived.by(() => {
    const route = live.routeOf(ui.path);
    const at = isTemplate(pageId) && route?.id === pageId ? route : { params: {} };
    return widgetItems(live.content, at, { source });
  });
  const item = $derived(shown.item);
  const from = $derived(sourceOf({ source })?.from ?? null);
  const schema = $derived.by(() => {
    live.version;
    return from ? schemaFor(live.store, sourceFile(from)) : null;
  });
  const isMain = $derived.by(() => {
    live.version;
    return isTemplate(pageId) && live.get(g.file, '/main') === g.id;
  });
  // a property's value as one line (the picker's hint)
  const line = (v) =>
    typeof v === 'string' || typeof v === 'number'
      ? String(v)
      : Array.isArray(v)
        ? `${v.length} items`
        : '';
  // for the widget settings (Field.svelte): the item's properties per bind type (with their value), what
  // one shows, and the item's name for the picker's group
  const bindings = $derived({
    // the title property first
    binds: (bindType) =>
      (schema?.properties || [])
        .filter((f) => (BIND_TYPES[bindType] || []).includes(f.type))
        .sort((a, b) => (b.key === schema.title) - (a.key === schema.title))
        .map((f) => ({
          value: f.key,
          label: f.key,
          hint: (item && line(item[f.key])) || f.label || f.type,
        })),
    resolved: (f) => {
      const v = resolve(live.get(f.file, f.ptr), {
        item,
        keys: new Set((schema?.properties || []).map((p) => p.key)),
        sources: live.content?.sources,
        def: { type: f.type },
      });
      return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
    },
    // the sources: {people} shows how many there are (no item needed)
    lists: Object.keys(live.content?.sources || {}),
    // a List: {items}, how many it shows (Count of this List in the pickers); else none
    listItems: type.list ? (shown.items?.length ?? 0) : null,
    // the names a property part can have (any other is a warning chip)
    names: new Set([
      ...(schema?.properties || []).map((f) => f.key),
      ...Object.keys(item || {}),
      ...(type.list ? ['items'] : []), // {items}: a list widget's own items
      ...Object.keys(live.content?.sources || {}),
    ]),
    from: item && schema ? (schema.title && line(item[schema.title])) || from : from,
    // a Text widget's summary: its properties' values, its own count
    item,
    items: shown.items?.length ?? 0,
  });
</script>

{#if !bare}<ViewTop {bridge} id={g.id} {onback} />{/if}

<!-- the widget, in a card: its type and title, its tabs and fields -->
<div class={['card', bare && 'card--bare']}>
  {#if !bare}
    <div class="head">
      <span class="title">
        {g.title}
        {#if g.name}<strong>{g.name}</strong>{/if}
      </span>
      {#if isMain}<span class="badge" title="The page’s main widget: it decides which pages exist"
          >Main</span
        >{/if}
    </div>
  {/if}

  <Tabs class="card__tabs" label="Widget" tabs={WIDGET_TABS} value={tab} onpick={pickTab} />

  <div class="card__body">
    <!-- its layout: what its type supports -->
    <div class={['card__pane', tab !== 'layout' && 'is-hidden']} inert={tab !== 'layout'}>
      <WidgetLayout {live} {bridge} file={g.file} {at} {j} id={g.id} {widget} />
    </div>
    <div class={['card__pane', tab !== 'content' && 'is-hidden']} inert={tab !== 'content'}>
      <!-- its source first (a widget whose type shows items), then its settings and fields -->
      {#snippet lead()}
        <WidgetSource {g} {live} {base} list={!!type.list} {shown} {sourceIds} {onsource} />
      {/snippet}
      <GroupFields
        {g}
        {live}
        {bridge}
        {sourceIds}
        {onsource}
        {bindings}
        lead={type.list || type.item || g.fields.some((f) => f.bindType) || widget.source
          ? lead
          : undefined}
      />
      {#if !g.fields.length && !g.config?.length}
        <p class="hint small">No texts or settings in this widget.</p>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the side padding is on its parts, so the tabs' line runs edge to edge
  .card {
    padding: var(--space-3) 0;
    border-radius: var(--radius-lg);
    background: var(--c-card);
  }

  // in the panel a surface of its own (_mixins.scss surface()); bare, in the pop-up, on the pop-up's
  .card:not(.card--bare) {
    @include surface(var(--c-card), $quiet: 45%);
  }

  .card--bare {
    padding: 0;
    border-radius: 0;
    background: none;
  }

  // [ Type name ]
  .head {
    @include row(var(--space-2));
    margin-bottom: var(--space-3);
    padding-inline: var(--space-3);
  }

  .title {
    @include row(var(--space-2));
    min-width: 0;
    font-size: var(--fs-base);

    strong {
      @include ellipsis;
      color: var(--c-link);
      font-weight: 400;
    }
  }

  // Main: the widget accent, a pill
  .badge {
    margin-left: auto;
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    color: var(--c-widget-accent);
    font-size: var(--fs-xs);
    line-height: 16px;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-widget-accent) 45%, transparent);
  }

  .card :global(.card__tabs) {
    margin-bottom: var(--space-4);
  }

  // both tabs in one cell: the taller one sets the height, the other hidden (no shift on a switch)
  .card__body {
    display: grid;
    padding-inline: var(--space-3);
  }

  .card__pane {
    grid-area: 1 / 1;
    min-width: 0;
  }

  .card__pane.is-hidden {
    visibility: hidden;
  }
</style>
