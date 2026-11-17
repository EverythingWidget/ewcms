<!--
  The editor shell: the site preview on the left, the side panel on the right with the
  header (the status line | Edit / Done | Publish; the top tabs Pages | Site Settings), the
  current tab's panel (Pages: the pages list in browse, or the page open with its tabs
  Sections | Motion | SEO in edit, ContentPanel.svelte; Site Settings: SettingsPanel.svelte) and
  the footer (Desktop | Phone, Sources, Media; undo, redo in edit). Also the modals, each
  mounted once here and opened through state (modals.svelte.js), the toasts and the keyboard
  shortcuts.
  Browse or edit is ui.mode (ui.svelte.js): Edit opens the page in the preview; Done saves
  the changes (the save behind Ctrl+S), then goes back to browse.
  main.js holds the logic: it changes `ui` (ui.svelte.js) and passes `actions`.
-->
<script>
  import { keptForReload } from '../keep-unsaved.js';
  import InfoHelp from './InfoHelp.svelte';
  import { untrack } from 'svelte';
  import Button from './Button.svelte';
  import Tabs from './Tabs.svelte';
  import { SITE, contentPath } from '../../render/files.js';
  import ContentPanel from './ContentPanel.svelte';
  import SettingsPanel from './SettingsPanel.svelte';
  import PublishModal from './PublishModal.svelte';
  import MediaModal from './MediaModal.svelte';
  import SourcesModal from './SourcesModal.svelte';
  import WidgetsModal from './WidgetsModal.svelte';
  import AddPageModal from './AddPageModal.svelte';
  import ItemModal from './ItemModal.svelte';
  import PreviewModal from './PreviewModal.svelte';
  import { openMedia } from './media.svelte.js';
  import {
    closeModal,
    isOpen,
    openFirstRun,
    openPublish,
    openSources,
    syncModals,
    topModal,
  } from './modals.svelte.js';
  import { toast } from './toasts.svelte.js';
  import Toasts from './Toasts.svelte';
  import SaveFailedModal from './SaveFailedModal.svelte';
  import UnsavedEditsModal from './UnsavedEditsModal.svelte';
  import FirstRunModal from './FirstRunModal.svelte';
  import UpdateNotice from './UpdateNotice.svelte';
  import WidgetToolbar from './WidgetToolbar.svelte';
  import TemplateCols from './TemplateCols.svelte';
  import { templateOfPath } from '../../render/widgets/list/template-preview.js';
  import { layerWidget } from '../layout-ops.js';
  import { targetFile } from '../layout-sync.js';
  import {
    ui,
    previewClicks,
    pickElement,
    selectLink,
    deselect,
    closePopup,
    setMode,
  } from './ui.svelte.js';
  import { writeUrl } from './persist.js';
  import { MOD, plural } from '../lib/format.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // actions: setPanel, setPageTab, setMode, pickTarget, save, refreshStatus, pagesOp
  let { live, bridge, actions } = $props();

  // Publish: the status first (what is saved but not published, whether it can publish)
  async function publish() {
    if (ui.publishing || isOpen('publish')) return;
    await actions.refreshStatus();
    if (ui.pub?.error)
      return toast(`Can't publish: ${ui.pub.error}`, { kind: 'error', timeout: 0 });
    openPublish();
  }
  // the modals' dialogs follow the stack (ui.modals)
  $effect(syncModals);

  // [panel, label, icon]: a tab with an icon shows only the icon (ui.panel, ui.svelte.js)
  const TABS = [
    ['pages', 'Pages'],
    ['settings', 'Site Settings'],
  ];
  const pages = $derived(ui.panel === 'pages');
  const phone = $derived(ui.viewport === 'phone');
  // the item template editor: a row above the frame holds its Columns control; on pages
  // the frame takes that space (the frame moving when a template opens is accepted)
  const templating = $derived(!!templateOfPath(ui.path || ''));
  // browse or edit (ui.mode): Edit opens the page in the preview (in the Pages tab); Done saves
  // what is unsaved first (nothing is lost), then browses; a failed save stays in edit
  const editing = $derived(ui.mode === 'edit');
  function edit() {
    if (ui.panel !== 'pages') actions.setPanel('pages');
    setMode('edit');
  }
  async function done() {
    if (await actions.save()) setMode('browse');
  }
  const VIEWPORTS = [
    ['desktop', 'Desktop', 'desktop'],
    ['phone', 'Phone', 'mobile-screen-button'],
  ];
  const unpublished = $derived(ui.pub?.files || []);
  const ahead = $derived(ui.pub?.ahead || 0);
  const unpublishedChanges = $derived(unpublished.reduce((n, f) => n + (f.changes || 1), 0));
  // the footer's status line: what is left to do (unsaved, to publish, to push) or done
  const pending = $derived.by(() => {
    const details = [
      unpublished.length &&
        `${plural(unpublishedChanges, 'saved change')} not published (${plural(unpublished.length, 'file')})`,
      ahead && `${plural(ahead, 'commit')} not pushed`,
      ui.pub?.error && `Publish unavailable: ${ui.pub.error}`,
      ui.status,
    ]
      .filter(Boolean)
      .join('\n');
    const line = (kind, text) => ({ kind, text, details });
    if (live.changes) return line('unsaved', 'Unsaved changes');
    if (!ui.pub) return line('none', 'Checking…');
    if (ui.pub.error) return line('none', 'Publish unavailable');
    // just saved (nothing edited since): say so, not one count swapped for another (F60);
    // Publish · N says how many to publish
    if (unpublished.length && ui.saved) return line('pending', 'Saved');
    if (unpublished.length)
      return line('pending', `${plural(unpublishedChanges, 'change')} to publish`);
    if (ahead) return line('pending', `${plural(ahead, 'commit')} to push`);
    return line('clean', 'All published');
  });
  const branch = $derived(ui.pub?.branch ? `origin/${ui.pub.branch}` : 'GitHub');

  // an edit after a save: the footer no longer says "Saved"
  $effect(() => {
    if (live.changes) ui.saved = false;
  });

  // The tab, Header/Footer, the open Sources item and library animation in the URL (persist.js).
  $effect(writeUrl);

  // a new site (site.json with no name: the starter's, src/cli/scaffold.mjs): its name,
  // language and look, asked once per visit (FirstRunModal.svelte; Later asks again next time)
  let askedFirstRun = false;
  $effect(() => {
    const site = live.get(SITE, '');
    if (askedFirstRun || !site || site.name) return;
    askedFirstRun = true;
    untrack(openFirstRun);
  });

  $effect(() => {
    // the site's name (site.json), like the page's own title (src/cli/vite-plugin-static-site.mjs)
    const name = live.get(SITE, '/name');
    document.title = `${live.changes ? '● ' : ''}Editor${name ? ` · ${name}` : ''}`;
  });

  /** Keyboard shortcuts, also while the preview has focus (it forwards them: bridge 'key'). */
  function onKey(e) {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    // Ctrl+Z in a text field of the panel undoes the typing there, not an editor step
    // (switches, sliders and selects have none: there it is the editor's undo).
    const inField =
      e.target instanceof Element &&
      e.target.matches?.('textarea, input:not([type="checkbox"], [type="range"])') &&
      e.target.ownerDocument === document;
    if (mod && k === 's') {
      e.preventDefault();
      actions.save();
    } else if (mod && k === 'e' && e.shiftKey) {
      e.preventDefault();
      location.href = bridge.path() || '/';
    } else if (mod && (k === 'z' || k === 'y') && !inField) {
      e.preventDefault();
      if (k === 'y' || e.shiftKey) live.store.redo();
      else live.store.undo();
    } else if ((e.key === '[' || e.key === ']') && !e.metaKey && (!e.ctrlKey || e.altKey)) {
      // a widget's layer: [ down, ] up (by character: AltGr / Ctrl+Alt on other layouts),
      // a widget picked in the Sections tab, not while typing, the desktop layout
      const typing =
        e.target instanceof Element &&
        e.target.closest?.('input, textarea, select, [contenteditable]');
      if (typing || previewClicks() !== 'arrange' || !ui.widget || phone) return;
      const file = targetFile(ui.target, bridge.doc);
      const list = live.get(file, '/sections') || [];
      for (const [at, s] of list.entries()) {
        const j = (s?.widgets || []).findIndex((widget) => widget?.id === ui.widget);
        if (j < 0) continue;
        e.preventDefault();
        layerWidget(live.store, file, at, j, e.key === ']' ? 1 : -1);
        break;
      }
    } else if (e.key === 'Escape') {
      // in the widget pop-up: its own (an open menu first, then the pop-up; WidgetPopup.svelte)
      if (e.target instanceof Element && e.target.closest('.wpop')) return;
      // A modal closes itself on Esc (the one in front); this also covers Esc pressed in the
      // preview. arrange clicks: then the selected link, else the selected widget (the panel
      // shows the sections again, the grid hides); not while typing in a field of the panel.
      if (topModal()) {
        e.preventDefault();
        closeModal();
      } else {
        const picked = !!ui.picked;
        if (picked) pickElement(null);
        if (previewClicks() === 'arrange' && !inField) {
          if (ui.link) selectLink(null);
          else if (ui.widget || ui.section || ui.multi.length || ui.selSection) deselect();
          else if (!picked) actions.lockPart(); // nothing picked, a site part open: locked
        } else if (previewClicks() === 'animate' && !inField && !picked) actions.lockPart();
      }
    }
  }
  $effect(() => bridge.on('key', onKey)); // once: the bridge never changes
  // a widget opened anywhere (a row, Add widget, the page head): the one selected
  $effect(() => {
    if (ui.widget && untrack(() => ui.multi.length)) ui.multi = [];
  });
  // nothing selected: no pop-up either (a later single click only selects)
  $effect(() => {
    if (!ui.widget) closePopup();
  });

  /** Leaving the page with unsaved edits: the browser asks first. */
  function onBeforeUnload(e) {
    if (live.store.dirtyFiles().length && !keptForReload()) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
</script>

<svelte:window onkeydown={onKey} onbeforeunload={onBeforeUnload} />

{#if ui.loadError}
  <p class="ed-boot">Could not load content: {ui.loadError}</p>
{:else}
  <main class={['ed-stage', phone && 'is-phone', templating && 'has-cols']}>
    <!-- only in the item template editor: the row with its Columns control -->
    {#if templating}<div class="ed-cols-slot"><TemplateCols {live} /></div>{/if}
    <iframe class="ed-frame" title="Site preview" {@attach bridge.attach}></iframe>
    <WidgetToolbar {live} {bridge} />
  </main>

  <aside class="ed-panel">
    <header class="ed-head">
      <!-- [ (i) status line | Edit / Done | Publish ]: Edit and Done share one 80px slot -->
      <div class="ed-actions">
        <!-- the tip leads the row (always there: nothing moves when the status changes) -->
        <InfoHelp label="About saving and publishing"
          ><b>Edit</b> opens the page shown in the preview to change it; <b>Done</b> saves and goes
          back to browsing (links work again). <b>{MOD}+S</b> saves your edits as a draft: the
          preview shows them, the live site doesn't.
          <b>Publish</b> puts every saved change live in one commit; edits not saved yet it offers to
          save first. The number counts edits (a widget added, moved or restyled, a section removed, a
          setting), not files.</InfoHelp
        >
        <!-- one short line; the details in its tooltip -->
        <p class="ed-pending" data-kind={pending.kind} title={pending.details} role="status">
          {#if pending.kind !== 'none'}<i class="ed-pending__dot"></i>{/if}
          <span>{pending.text}</span>
        </p>
        <Button
          size="small"
          data-edit-toggle
          title={editing
            ? `Done: save the changes (${MOD}+S) and go back to browsing`
            : 'Edit the page shown in the preview (opens it in the Pages tab)'}
          disabled={editing && (ui.saving || ui.publishing)}
          onclick={editing ? done : edit}>{editing ? 'Done' : 'Edit'}</Button
        >
        <Button
          size="small"
          variant="primary"
          title="Commit all saved content changes in one commit and push to {branch}"
          disabled={ui.publishing || (!unpublished.length && !ahead && !live.changes)}
          onclick={publish}
        >
          {ui.publishing
            ? 'Publishing…'
            : `Publish${unpublished.length ? ` · ${unpublishedChanges}` : ''}`}
        </Button>
      </div>
      <!-- the modes: evenly spread, the picked one with a white line; their line ends the header -->
      <Tabs
        class="ed-panels"
        role="navigation"
        fill
        label="Panel"
        tabs={TABS}
        value={ui.panel}
        onpick={(panel) => panel !== ui.panel && actions.setPanel(panel)}
      />
    </header>

    {#if pages}
      <ContentPanel {live} {bridge} {actions} />
    {:else}
      <SettingsPanel {live} {bridge} {actions} />
    {/if}

    <!-- (i) [ Desktop | Phone ] Sources Media ... (the tip leads, before the toggle it explains;
         undo redo: edit only, at the end, so nothing before them moves) -->
    <footer class="ed-foot">
      <InfoHelp label="About Desktop and Phone"
        ><b>Desktop</b> and <b>Phone</b> each have their own layout. Moving, resizing and linking widgets,
        and a section's height, change only the view you are in; Auto height, Rows and Aspect are shared.
        Phone is 60 columns wide; a widget not yet placed there stacks full width in page order.</InfoHelp
      >
      <div class="seg ed-vp" role="radiogroup" aria-label="Preview size">
        {#each VIEWPORTS as [value, label, icon] (value)}
          <button
            type="button"
            role="radio"
            aria-checked={ui.viewport === value}
            class={['seg__btn', ui.viewport === value && 'is-active']}
            title={label}
            aria-label={label}
            onclick={() => (ui.viewport = value)}
          >
            <i class="fa-solid fa-{icon}" aria-hidden="true"></i>
          </button>
        {/each}
      </div>
      <Button
        icon="database"
        iconOnly
        label="Sources"
        title="Sources: your lists of items, such as products, team members or events (in {contentPath(
          'sources/',
        )})"
        onclick={() => openSources()}
      />
      <Button
        icon="images"
        iconOnly
        label="Media"
        title="Media: every photo, upload, alt text"
        onclick={() => openMedia({ key: ui.media.key })}
      />
      <span class="ed-foot__gap"><UpdateNotice /></span>
      {#if editing}
        <Button
          icon="rotate-left"
          iconOnly
          label="Undo ({MOD}+Z)"
          disabled={!live.canUndo}
          onclick={() => live.store.undo()}
        />
        <Button
          icon="rotate-right"
          iconOnly
          label="Redo ({MOD}+Shift+Z)"
          disabled={!live.canRedo}
          onclick={() => live.store.redo()}
        />
      {/if}
    </footer>
  </aside>

  <!-- the modals, once each (modals.svelte.js) -->
  <PublishModal {live} {actions} />
  <MediaModal {live} {bridge} {actions} />
  <SourcesModal {live} {bridge} />
  <WidgetsModal />
  <AddPageModal {live} {actions} />
  <ItemModal />
  <PreviewModal {live} />
  <SaveFailedModal />
  <UnsavedEditsModal />
  <FirstRunModal {live} {actions} />
  <Toasts />
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .ed-stage {
    position: absolute;
    inset: 0 calc(var(--panel-w) + 24px) 0 0;
    padding: var(--space-3) 0 var(--space-3) var(--space-3);
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    place-items: stretch;
    gap: var(--space-2);
    &.has-cols {
      grid-template-rows: var(--size-control) minmax(0, 1fr);
    }
  }

  // the template editor's row above the frame: its Columns control sits here, centred
  .ed-cols-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: var(--size-control);
  }

  // the preview iframe
  .ed-frame {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    border: 0;
    border-radius: 0; // square: the page's own edges (the phone frame keeps its round corners)
    box-shadow:
      0 0 0 1px var(--c-fill-active),
      0 30px 80px -30px var(--c-scrim);
    transition:
      width 0.5s var(--ease-out),
      height 0.5s var(--ease-out);
    background: var(--c-bg-site);
  }

  .ed-stage.is-phone .ed-frame {
    width: 392px;
    height: min(844px, 100%);
    place-self: center;
    border-radius: var(--radius-3xl);
  }

  .ed-panel {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 12px;
    width: var(--panel-w);
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-2xl);
    overflow: hidden;
    @include surface(var(--c-surface), $quiet: 50%);
    background: var(--c-surface);
    box-shadow: var(--shadow-panel); // borderless: no ring, no top highlight
  }

  // the tab panels (child components) may shrink
  .ed-panel > :global(*) {
    min-width: 0;
  }

  // [ status | Edit / Done | Publish ], then the modes; 16px edges
  .ed-head {
    flex: none;
    padding-top: var(--space-4);
    background: var(--c-panel-head);
    @include stack(var(--space-2));
  }

  // (i) [ status | Edit / Done | Publish ]
  .ed-actions {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: 0 var(--space-4);
  }

  // its tip on the 16px edge, 8px (the gap) before the status (no label to keep 4px from)
  .ed-actions > :global(.ih) {
    margin: 0;
  }

  // Edit / Done and Publish: 32px (size small, --size-control), as the back arrow and the icon
  // buttons; the row keeps its 40px, so the tabs and the panel under it don't move.
  // Edit and Done share one slot: both are 4 letters, this min-width stops any shift
  .ed-actions :global([data-edit-toggle]) {
    min-width: 80px;
  }

  // (i) [ Desktop | Phone ] Sources Media ... undo redo: 16px edges, 8px apart
  .ed-foot {
    position: relative; // the update card's anchor
    border-top: 1px solid transparent; // borderless: no line, its 1px kept (no shift)
    background: var(--c-panel-head);
    padding: var(--space-3) var(--space-4) var(--space-4);
    display: flex;
    align-items: center;
    gap: var(--space-2);

    > :global(*) {
      flex: none;
    }

    // the Desktop / Phone tip leads the row: on the 16px edge (no label to keep 4px from)
    > :global(.ih) {
      margin: 0;
    }
  }

  // the update notice's pill sits here (its card floats over the panel: UpdateNotice.svelte)
  .ed-foot__gap {
    flex: 1 !important;
    display: flex;
    justify-content: flex-start;
    min-width: 0;
  }

  // Desktop | Phone: the editor's .seg, icon-only 32×32 cells, as tall as the buttons
  .ed-vp .seg__btn {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--size-control);
    height: var(--size-control);
    padding: 0;
    font-size: var(--fs-lg);
    line-height: 1;
  }

  .ed-pending {
    min-width: 16ch; // "Unsaved changes": Saved must not shrink the row (G16)
    margin: 0;
    @include row(var(--space-2));
    @include muted;
    line-height: 16px;

    span {
      @include ellipsis;
    }

    &:is([data-kind='pending'], [data-kind='unsaved']) {
      color: var(--c-text);
    }

    &__dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-round);
      background: var(--c-success);
      flex: none;
    }

    &:is([data-kind='pending'], [data-kind='unsaved']) .ed-pending__dot {
      background: var(--c-warning);
      box-shadow: 0 0 0 4px var(--amber-300-a15);
    }
  }

  @media (width <= 900px) {
    .ed-stage {
      inset: 0 0 50vh;
      padding: var(--space-2);
    }
    .ed-panel {
      inset: auto 8px 8px;
      width: auto;
      height: calc(50vh - 16px);
    }
  }
</style>
