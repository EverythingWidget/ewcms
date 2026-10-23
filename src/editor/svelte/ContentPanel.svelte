<!--
  Content tab: the pages list (PagesList.svelte, while ui.pagesWin.open), or the page in the
  preview or a site part (the Header: HeaderPart.svelte; the Footer) under PageHead.svelte
  (Return to navigation: back to the pages list). The two swap with a slide (lib/slide.js):
  a page opened comes in from the right, the list comes back from the left. A page is a list of sections
  holding widgets (src/site/layout/), and nothing else. A page's panel has three tabs (Tabs.svelte,
  the open one kept per page in ui.sections["pagetab:<file>"]):
    Sections     SectionsList.svelte: the section cards and the dashed Add section card. One
                 level under it: a section's settings (SectionView.svelte, ui.section; a card's
                 pen or double click). A widget's settings are not in the panel: they open in
                 one floating pop-up (WidgetPopup.svelte, ui.widget; a widget row's double
                 click or Enter, or the widget clicked in the preview). The Add widget modal (WidgetsModal.svelte): the
                 widget added opens
    Transitions  the Backdrop (BackdropFields.svelte) and the Curtain (PageCurtain.svelte)
    SEO          SeoSection.svelte
  The footer is sections only (no tabs). While this tab is open the preview is a
  layout canvas (overlay.js): a click picks a widget, a drag moves it, its handles resize it and
  a double click edits a text in place (bridge.js); links and buttons don't follow; a click on
  empty space or Esc drops the selection. The selected widget's section shows its grid (faint
  cells). The Sources button in the
  toolbar (App.svelte) opens the Source Explorer (SourcesModal.svelte); so does a
  list item's text clicked in the preview.

  Selection goes both ways through ui.selection: main.js sets it when a text is clicked in
  the preview, a field sets it (via the bridge) when it gets focus. This panel opens the widget
  of that text, highlights its field and scrolls to it.
-->
<script>
  import { tick, untrack } from 'svelte';
  import { gsap } from 'gsap';
  import { ui } from './ui.svelte.js';
  import HeaderPart from './HeaderPart.svelte';
  import PageHead from './PageHead.svelte';
  import PagesList from './PagesList.svelte';
  import BackdropFields from './BackdropFields.svelte';
  import PageCurtain from './PageCurtain.svelte';
  import Tabs from './Tabs.svelte';
  import WidgetPopup from './WidgetPopup.svelte';
  import { createPopup } from '../widget-popup.js';
  import WidgetsModal from './WidgetsModal.svelte';
  import SectionView from './SectionView.svelte';
  import SectionsList from './SectionsList.svelte';
  import SectionToolbar from './SectionToolbar.svelte';
  import { locate } from '../locate.js';
  import SeoSection from './SeoSection.svelte';
  import SourcesModal from './SourcesModal.svelte';
  import { allFields, contentGroups, groupFor } from './content-groups.js';
  import { splitEdit } from '../../site/helpers.js';
  import { parse } from '../lib/pointer.js';
  import { targetFile } from '../layout-sync.js';
  import { sourceIds as sourceIdsOf } from '../../site/files.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import { addWidget } from '../layout-ops.js';
  import { SLIDE, still, swapView } from '../lib/slide.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // actions: main.js (editMotion: open an element in the Motion tab)
  let { live, bridge, actions } = $props();

  let panel = $state();
  let sourcesModal = $state();

  // The texts come from the preview's [data-edit] elements: re-read them after every edit
  // (widgets may have moved) and when the preview shows another page.
  const groups = $derived.by(() => {
    live.version;
    ui.previewVersion;
    return contentGroups(live.store, bridge, ui.target);
  });
  const waiting = $derived.by(() => {
    ui.previewVersion;
    return ui.target.id !== 'header' && !bridge.doc;
  });
  // the file whose sections are listed: the page's in the preview, or the footer's
  const file = $derived.by(() => {
    ui.previewVersion;
    return targetFile(ui.target, bridge.doc);
  });
  const sections = $derived.by(() => {
    live.version;
    const list = file && live.current(file)?.sections;
    return Array.isArray(list) ? list : [];
  });
  // the widget whose settings are in the pop-up (one only; gone, e.g. undone: none)
  const popG = $derived((file && groups.find((g) => g.widget && g.id === ui.widget)) || null);
  const popup = createPopup();
  // what the Sections tab shows over the list: a section's settings ({ section: its id });
  // none: the list (a section gone, e.g. undone: the list too)
  const open = $derived(
    !ui.widget && ui.section && sections.some((s) => s?.id === ui.section)
      ? { section: ui.section }
      : null,
  );
  // the files in content/en/sources/, for a list item's source
  const sourceIds = $derived.by(() => {
    live.version;
    return sourceIdsOf(live.store.current);
  });

  // a page's tabs, the open one per page file
  const TABS = [
    ['sections', 'Sections & Widgets'],
    ['transitions', 'Transitions'],
    ['seo', 'SEO'],
  ];
  const isPage = $derived(!!file && ui.target.kind === 'page');
  const tab = $derived((isPage && ui.sections[`pagetab:${file}`]) || 'sections');
  // a widget open is in Sections: the row stays (nothing moves), another tab closes the widget
  const shownTab = $derived(open ? 'sections' : tab);
  function pickTab(v) {
    if (open && v !== 'sections') back();
    ui.sections[`pagetab:${file}`] = v;
  }
  const tabsId = $props.id();

  const onsource = (f, item, edit, then) => sourcesModal.open(f, item, edit, then);
  const itemOf = (f) => Number(parse(f.ptr)[0]) || 0; // a source field's item

  function openWidget(id) {
    ui.section = null;
    ui.widget = id;
    ui.widgetTab = 'content';
  }
  // a section card's pen or double click: its settings
  function openSection(id) {
    ui.widget = null;
    ui.selection = null;
    ui.section = id;
  }
  // the toolbar's pen: scrolled to in the preview, opened (as a card's double click)
  function enterSection(id) {
    locate(bridge, id);
    openSection(id);
  }
  let deleting = $state(''); // the section asking "Delete?" over its card
  // a click on the list's empty space (no card, no control): no section selected
  const CONTROLS = 'a, button, input, select, textarea, label, [contenteditable], [role="menu"]';
  function deselect(e) {
    if (!ui.selSection || e.target.closest?.(`.sec, ${CONTROLS}`)) return;
    ui.selSection = null;
  }

  function back() {
    ui.widget = null;
    ui.section = null;
  }

  // Add widget (a section card's): every type on offer; the widget added opens
  let widgetsModal = $state();
  const types = $derived(
    Object.values(WIDGET_TYPES).map(({ type, label, icon, line, sketch }) => ({
      value: type,
      label,
      icon,
      line,
      sketch,
    })),
  );
  const addTo = (at, type) => openWidget(addWidget(live.store, file, at, type).id);

  /** Open the widget holding `edit` and scroll to it (a Header label: its field); list items open the Sources modal. */
  async function reveal(edit) {
    await tick(); // not inside the effect below: the modal renders synchronously when opened
    const group = groups.find((g) => allFields(g).some((f) => f.edit === edit));
    if (!group) {
      const { file, ptr } = splitEdit(edit);
      // A list item shown on the home page (a person's name): edit it in the modal.
      if (groupFor(live.store, { file, ptr })?.id.startsWith('source:'))
        return sourcesModal.open(file, itemOf({ ptr }), edit);
    } else {
      if (isPage && tab !== 'sections') pickTab('sections');
      if (ui.widget !== group.id || ui.widgetTab !== 'content') openWidget(group.id);
    }
    await tick();
    document
      .querySelector(`.wpop [data-edit="${CSS.escape(edit)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // Sections: the list and the widget view side by side in a clipping wrapper. Opening a widget
  // slides the list out to the left and the widget in from the right (Back: the reverse), the
  // wrapper's height eased between them; the list's scroll comes back on Back. Widget to widget
  // swaps in place; a new slide kills a running one; reduced motion: instant.
  let held = $state(null); // the widget shown, kept while it slides out
  let moving = $state(false); // both panes shown (a slide)
  let slideEl = $state();
  let listEl = $state();
  let widgetEl = $state();
  let tl = null;
  let saved = 0; // the list's scroll
  const atWidget = $derived(!!open);
  $effect(() => {
    if (open) held = open;
  });
  let first = true;
  $effect(() => {
    const to = atWidget;
    untrack(() => slide(to));
  });

  async function slide(to) {
    if (first) return void (first = false);
    const settled = !moving;
    tl?.kill();
    tl = null;
    if (to && settled && panel) saved = panel.scrollTop;
    if (!slideEl || still()) return done(to);
    const from = slideEl.offsetHeight;
    moving = true;
    await tick();
    if (!listEl || !widgetEl || atWidget !== to) return to === atWidget && done(to);
    const w = slideEl.clientWidth;
    if (settled) {
      gsap.set(listEl, { x: to ? 0 : -w, y: -saved });
      gsap.set(widgetEl, { x: to ? w : 0 });
      panel.scrollTop = 0;
    }
    const target = (to ? widgetEl : listEl).offsetHeight;
    tl = gsap
      .timeline({ defaults: SLIDE, onComplete: () => done(to) })
      .to(listEl, { x: to ? -w : 0 }, 0)
      .to(widgetEl, { x: to ? 0 : w }, 0)
      .fromTo(slideEl, { height: from }, { height: target }, 0);
  }

  async function done(to) {
    tl = null;
    moving = false;
    if (!to) held = null;
    for (const el of [slideEl, listEl, widgetEl]) if (el) gsap.set(el, { clearProps: 'all' });
    await tick();
    if (panel) panel.scrollTop = to ? 0 : saved;
  }

  // the pages list and a page's view (its head, tabs and body) swap with the same slide: a
  // page opened comes in from the right, Return to navigation brings the list from the left
  // (lib/slide.js: a still copy of the one going slides out)
  const viewEls = () => {
    const els = [];
    for (let n = panel; n && !n.matches('.ed-head'); n = n.previousElementSibling) els.unshift(n);
    return els;
  };
  let listOpen = ui.pagesWin.open;
  $effect.pre(() => {
    const now = ui.pagesWin.open;
    untrack(() => {
      if (now === listOpen) return;
      listOpen = now;
      const play = swapView(panel?.closest('.ed-panel'), viewEls());
      tick().then(() => play(viewEls(), now ? -1 : 1));
    });
  });

  $effect(() => {
    const { edit, quiet } = ui.selection || {};
    if (!edit || quiet) return;
    // a text clicked in the preview: its widget, not the pages list
    untrack(() => (ui.pagesWin.open = false));
    reveal(edit);
  });
  // a widget clicked in the preview: the same
  $effect(() => {
    if (ui.widget) untrack(() => (ui.pagesWin.open = false));
  });
</script>

{#if ui.pagesWin.open}
  <section class="ed-body" bind:this={panel}>
    <PagesList {live} {actions} />
  </section>
{:else}
  <PageHead {live} {actions} />
  {#if isPage}
    <Tabs
      tabs={TABS}
      value={shownTab}
      onpick={pickTab}
      label="Page"
      class="page-tabs"
      id={tabsId}
      panel="{tabsId}-panel"
    />
  {/if}
  {#if file && !waiting && shownTab === 'sections' && !atWidget}
    <SectionToolbar
      {live}
      {file}
      bind:deleting
      onsection={enterSection}
      onadd={(at) => widgetsModal.open(at)}
    />
  {/if}
  <!-- (a click on its empty space deselects the section card: a pointer shortcut, Esc too) -->
  <section
    class="ed-body"
    bind:this={panel}
    id="{tabsId}-panel"
    role={isPage ? 'tabpanel' : undefined}
    aria-labelledby={isPage ? `${tabsId}-${shownTab}` : undefined}
    onclick={shownTab === 'sections' && !atWidget ? deselect : undefined}
  >
    {#if waiting}
      <p class="hint">Waiting for the preview…</p>
    {:else if file && shownTab === 'sections'}
      <div class="slide" bind:this={slideEl}>
        <div
          class={['slide__pane', atWidget && !moving && 'is-away']}
          bind:this={listEl}
          inert={atWidget}
        >
          <SectionsList
            {live}
            {bridge}
            {file}
            onopen={openWidget}
            onsection={openSection}
            bind:deleting
          />
        </div>
        {#if held}
          <div class="slide__pane slide__pane--widget" bind:this={widgetEl} inert={!atWidget}>
            <SectionView {live} {bridge} {file} id={held.section} onback={back} />
          </div>
        {/if}
      </div>
    {:else}
      {#if isPage && tab === 'transitions'}
        <BackdropFields {live} {file} />
        <hr class="pane__line" />
        <PageCurtain {live} onsettings={() => actions.setMode('settings')} />
      {:else if isPage && tab === 'seo'}
        <SeoSection {live} {file} {actions} />
      {:else if ui.target.id === 'header'}
        <HeaderPart {live} />
      {:else}
        <p class="hint">No editable content here.</p>
      {/if}
    {/if}
  </section>
{/if}

{#if popG && !ui.pagesWin.open}
  <WidgetPopup
    g={popG}
    {live}
    {bridge}
    {sourceIds}
    {onsource}
    {popup}
    onclose={() => {
      ui.selection = null;
      ui.widget = null;
    }}
    onmotion={(el) => actions.editMotion(el)}
    onlibrary={(name) => {
      ui.library = { open: true, name };
      actions.setMode('motion');
    }}
  />
{/if}

<SourcesModal bind:this={sourcesModal} {live} {bridge} />
<WidgetsModal bind:this={widgetsModal} {types} onpick={(type, at) => addTo(at, type)} />

<style lang="scss">
  // the tabs' line runs the panel's full width, above the scrolling body
  :global(.page-tabs) {
    flex: none;
    padding: 0; // a tab's own 12px: its label on the 12px edge
  }

  // the panes share one cell, clipped while they slide
  .slide {
    display: grid;
    flex: 1 0 auto; // the body's height at least: the widget's section at its bottom
    overflow: clip;
  }

  .slide__pane {
    display: flex;
    grid-area: 1 / 1;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    align-self: start;

    &--widget {
      align-self: stretch;
    }

    &.is-away {
      display: none;
    }
  }
</style>
