<!--
  Nav tab: the pages list (PagesList.svelte, while ui.pagesWin.open), or the page in the
  preview or a site part (the Header: HeaderPart.svelte; the Footer) under PageHead.svelte
  (Return to navigation: back to the pages list). The two swap with a slide (lib/slide.js):
  a page opened comes in from the right, the list comes back from the left. A page is a list of sections
  holding widgets (src/site/layout/), and nothing else. A page's panel has three tabs (Tabs.svelte,
  the open one kept per page in ui.sections["pagetab:<file>"]; unknown: Sections):
    Sections     SectionsList.svelte: the section cards and the dashed Add section card. One
                 Settings are not in the panel: a section's open in a floating pop-up
                 (SectionPopup.svelte, ui.section; a card's double click or the toolbar's
                 gear), a widget's in another (WidgetPopup.svelte, ui.widget; a widget row's
                 double click or Enter, or the widget clicked in the preview); one at a time. The Add widget modal (WidgetsModal.svelte): the
                 widget added opens
    Motion       MotionPanel.svelte: the widgets' animations, then the Transition card
                 (the Backdrop and the Curtain). While it is open (ui.pageTab 'motion') the
                 preview's clicks animate (previewClicks, ui.svelte.js): they pick a widget or
                 an animated part. The top tab stays Nav.
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
  import { ui, selectWidgets, selectSection, hooks, previewClicks } from './ui.svelte.js';
  import HeaderPart from './HeaderPart.svelte';
  import PageHead from './PageHead.svelte';
  import PagesList from './PagesList.svelte';
  import MotionPanel from './MotionPanel.svelte';
  import Tabs from './Tabs.svelte';
  import WidgetPopup from './WidgetPopup.svelte';
  import { createPopup } from '../widget-popup.js';
  import WidgetsModal from './WidgetsModal.svelte';
  import SectionPopup from './SectionPopup.svelte';
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
  import { PHONE_MQ } from '../../site/layout/grid.js';
  import { swapView } from '../lib/slide.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // actions: main.js (editMotion: open an element in the page's Motion tab)
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
  const popG = $derived(
    (file && ui.popup && groups.find((g) => g.widget && g.id === ui.widget)) || null,
  );
  const popup = createPopup();
  // the section whose settings are in the pop-up (gone, e.g. deleted or undone: none)
  const popSection = $derived(
    !ui.widget && ui.section && sections.some((s) => s?.id === ui.section) ? ui.section : null,
  );
  $effect(() => {
    // its section deleted: the pop-up closes for good (not back when undone)
    if (ui.section && !popSection && !ui.widget && file) untrack(() => (ui.section = null));
  });
  // the files in content/en/sources/, for a list item's source
  const sourceIds = $derived.by(() => {
    live.version;
    return sourceIdsOf(live.store.current);
  });

  // a page's tabs, the open one per page file
  const TABS = [
    ['sections', 'Sections'],
    ['motion', 'Motion'],
    ['seo', 'SEO'],
  ];
  const isPage = $derived(!!file && ui.target.kind === 'page');
  const tab = $derived.by(() => {
    const v = isPage && ui.sections[`pagetab:${file}`];
    return TABS.some(([t]) => t === v) ? v : 'sections';
  });
  const shownTab = $derived(tab);
  function pickTab(v) {
    if (ui.section && v !== 'sections') ui.section = null;
    ui.sections[`pagetab:${file}`] = v;
    actions.setPageTab(v);
  }
  // ui.pageTab is the open page's tab (kept per page), null for the pages list or a site part;
  // on Motion the preview's clicks animate (main.js setPageTab). Motion stays open from page to
  // page (and after a refresh); the pages list or a site part ends it.
  $effect(() => {
    const listing = ui.pagesWin.open || ui.target.kind !== 'page';
    const f = file;
    const kept = tab;
    untrack(() => {
      if (listing) {
        if (ui.pageTab !== null) actions.setPageTab(null);
      } else if (f && ui.pageTab === 'motion' && kept !== 'motion') {
        ui.sections[`pagetab:${f}`] = 'motion';
      } else if (f && ui.pageTab !== kept) actions.setPageTab(kept); // f: the page is known
    });
  });
  const tabsId = $props.id();

  const onsource = (f, item, edit, then) => sourcesModal.open(f, item, edit, then);
  const itemOf = (f) => Number(parse(f.ptr)[0]) || 0; // a source field's item

  function openWidget(id) {
    ui.section = null;
    selectWidgets([id]);
    ui.popup = true;
    ui.widgetTab = 'content';
  }
  // a section card's double click or the toolbar's gear: its settings pop-up (selected; a
  // widget's pop-up closes)
  function openSection(id) {
    selectSection(id);
    ui.section = id;
  }
  // the toolbar's gear: scrolled to in the preview, opened (as a card's double click); again: closed
  function enterSection(id) {
    if (ui.section === id) return void (ui.section = null);
    locate(bridge, id);
    openSection(id);
  }
  // a click on the list's empty space (no card, no control): no section selected
  const CONTROLS = 'a, button, input, select, textarea, label, [contenteditable], [role="menu"]';
  function deselect(e) {
    if (!ui.selSection || e.target.closest?.(`.sec, ${CONTROLS}`)) return;
    ui.selSection = null;
    ui.selSections = [];
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
  // where the section's widgets are in the preview now (rows.js's --fr / --frs: an auto
  // widget's real height, a follower's row), so the new one goes below all of them
  const shownRows = (at) => {
    const out = {};
    const win = bridge?.doc?.defaultView;
    if (!win || win.matchMedia(PHONE_MQ).matches) return out; // the phone grid's rows: not these
    const ids = (live.store.current[file]?.sections?.[at]?.widgets || []).map(
      (widget) => widget.id,
    );
    for (const id of ids) {
      const el = bridge?.doc?.querySelector(`[data-widget="${CSS.escape(id)}"]`);
      if (!el || el.hidden) continue;
      const st = win.getComputedStyle(el);
      const row = parseInt(el.style.getPropertyValue('--fr') || st.getPropertyValue('--r'), 10);
      // rows.js's rows, else (not flowed yet) its height in cells: an auto widget's stored --rs
      // is a placeholder (1), never its content's
      const cell = parseFloat(win.getComputedStyle(el.parentElement).getPropertyValue('--cell'));
      const tall = cell > 0 ? Math.ceil(el.getBoundingClientRect().height / cell - 0.01) : 0;
      const flowed = parseInt(el.style.getPropertyValue('--frs'), 10) || 0;
      const stored = el.classList.contains('wgt--auto')
        ? 0
        : parseInt(st.getPropertyValue('--rs'), 10) || 0;
      const rows = Math.max(flowed || stored, tall);
      if (row > 0 && rows > 0) out[id] = { row, rows };
    }
    return out;
  };
  // first the preview catches up with the last edits (typed text, a size: their renders and
  // rows), so the new widget goes below what they make, not a stale height
  async function addTo(at, type) {
    await hooks.settled();
    openWidget(addWidget(live.store, file, at, type, { shown: shownRows(at) }).id);
  }

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
  {#if file && !waiting && shownTab === 'sections'}
    <SectionToolbar
      {live}
      {file}
      {bridge}
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
    onclick={shownTab === 'sections' ? deselect : undefined}
  >
    {#if waiting}
      <p class="hint">Waiting for the preview…</p>
    {:else if file && shownTab === 'sections'}
      <div class="list">
        <SectionsList {live} {bridge} {file} onopen={openWidget} onsection={openSection} />
      </div>
    {:else}
      {#if isPage && shownTab === 'motion'}
        <MotionPanel {live} {bridge} {actions} {file} />
      {:else if isPage && shownTab === 'seo'}
        <SeoSection {live} {file} {actions} />
      {:else if ui.target.id === 'header'}
        <HeaderPart {live} />
      {:else}
        <p class="hint">No editable content here.</p>
      {/if}
    {/if}
  </section>
{/if}

{#if popSection && file && !ui.pagesWin.open && previewClicks() === 'arrange'}
  <SectionPopup
    {live}
    {bridge}
    {file}
    id={popSection}
    {popup}
    onclose={() => (ui.section = null)}
  />
{/if}

{#if popG && !ui.pagesWin.open && previewClicks() === 'arrange'}
  <WidgetPopup
    g={popG}
    {live}
    {bridge}
    {sourceIds}
    {onsource}
    {popup}
    onclose={() => {
      // closed: the widget stays selected
      ui.selection = null;
      ui.popup = false;
    }}
    onmotion={(el) => actions.editMotion(el)}
    onlibrary={(name) => {
      ui.library = { name };
      actions.setPanel('settings');
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

  // the section cards: the body's height at least
  .list {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }
</style>
