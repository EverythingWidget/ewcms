<!--
  The editor's side panel, App.svelte's markup with its own styles (styles.js): the header
  (status line | Edit / Done | Publish), then the area open (no tabs on top: the areas list,
  ../../src/editor/areas.js): in Pages a page open, its head (PageHead.svelte's look: ← title /
  path; page: { title, path }, false hides it) and its tabs (the real Tabs); the scroll body
  (.ed-body) and the footer (Desktop | Phone; undo, redo in edit).
    area     the area open: 'pages' (a page open, default) or any other ('areas' for the list,
             'theme', 'animations', 'site-settings': the body only, your cards)
    editing  edit (Done, undo / redo shown) or browse (Edit; default)
    tab      the page tab shown (default 'sections'); tabs: false hides them
    height   the panel's height (default 844px)       pending  the header's line
    changes  unsaved changes                          unpublished  saved, not published
    phone    the Phone cell on                       children the body
-->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';
  import Tabs from '../../src/editor/svelte/Tabs.svelte';
  import { APP } from './styles.js';

  let {
    area = 'pages',
    tab = 'sections',
    tabs = true,
    page = { title: 'Home', path: '/' },
    height = '844px',
    pending = 'All published',
    changes = 0,
    unpublished = 0,
    editing = false,
    phone = false,
    children,
  } = $props();
  const canPublish = $derived(changes > 0 || unpublished > 0);
  const kind = $derived(changes ? 'unsaved' : unpublished ? 'pending' : 'clean');
  const line = $derived(
    changes
      ? 'Unsaved changes'
      : unpublished
        ? `${unpublished} ${unpublished === 1 ? 'change' : 'changes'} to publish`
        : pending,
  );
  const VIEWPORTS = [
    [false, 'Desktop', 'desktop'],
    [true, 'Phone', 'mobile-screen-button'],
  ];
  const PAGE_TABS = [
    ['sections', 'Sections'],
    ['page-motion', 'Page motion'],
    ['seo', 'SEO'],
  ];
  // the old Element motion tab is in Sections now (as the editor: persist.js)
  const pageTab = $derived(tab === 'element-motion' ? 'sections' : tab);
</script>

<div class={APP}>
  <aside class="ed-panel kit-panel" style:height>
    <header class="ed-head">
      <div class="ed-actions">
        <p class="ed-pending" data-kind={kind} role="status">
          <i class="ed-pending__dot"></i><span>{line}</span>
        </p>
        <Button data-edit-toggle>{editing ? 'Done' : 'Edit'}</Button>
        <Button variant="primary" disabled={!canPublish}
          >{unpublished ? `Publish · ${unpublished}` : 'Publish'}</Button
        >
      </div>
    </header>
    {#if page && area === 'pages'}
      <div class="kit-ph">
        <Button size="small" icon="arrow-left" iconOnly label="Back to pages" />
        <div>
          <b>{page.title}</b>
          <span>{page.path}</span>
        </div>
      </div>
    {/if}
    {#if tabs && area === 'pages'}
      <Tabs
        tabs={PAGE_TABS}
        value={pageTab}
        onpick={() => {}}
        label="Page"
        class="page-tabs"
        id="kit-tabs"
      />
    {/if}
    <section class="ed-body">{@render children?.()}</section>
    <footer class="ed-foot">
      <div class="seg ed-vp" role="radiogroup" aria-label="Preview size">
        {#each VIEWPORTS as [on, label, icon] (label)}
          <button
            type="button"
            role="radio"
            aria-checked={phone === on}
            class={['seg__btn', phone === on && 'is-active']}
            title={label}
            aria-label={label}
          >
            <i class="fa-solid fa-{icon}" aria-hidden="true"></i>
          </button>
        {/each}
      </div>
      <span class="ed-foot__gap"></span>
      {#if editing}
        <Button icon="rotate-left" iconOnly label="Undo" disabled={!changes} />
        <Button icon="rotate-right" iconOnly label="Redo" disabled />
      {/if}
    </footer>
  </aside>
</div>

<style lang="scss">
  // in place, not fixed to the window's right edge (App's .ed-panel is absolute)
  :global(.kit-app) > .kit-panel {
    position: relative;
    inset: auto;
  }

  // PageHead.svelte's box: 16px edges, 48px; the title over its path
  .kit-ph {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    min-height: 48px;
    padding: var(--space-4) var(--space-4) 0;
    box-sizing: content-box;

    div {
      display: grid;
      font-size: var(--fs-base);
      line-height: 20px;
    }

    b {
      color: var(--c-text-strong);
      font-weight: 500;
    }

    span {
      color: var(--c-text-muted);
    }
  }

  // ContentPanel's page tabs padding (its :global rule only lives while it is mounted)
  .kit-panel > :global(.page-tabs) {
    flex: none;
    padding: var(--space-3) var(--space-1) 0;
  }
</style>
