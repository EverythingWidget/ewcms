<!--
  The page or site part being edited, over its page tabs (the pages list takes
  its place while it is open: PagesList.svelte; its ← on the same spot):
    ← (a 32×32 filled square Button)  Title
                                      / photography/ people/   (a page: its address, clickable crumbs)
                                      Templates                (an item template)
                                      The menu and its labels  (Header / Footer: the pages list's line)
    Preview noor-vermeer / 2018 ▾   (a [param] page: the page of it the preview shows)
    ⚠ No pages are built: …        (only when its main widget can't decide its pages)
  Back to pages opens the pages list (in the Pages tab) where the page was opened (its
  own folder, or the one it is in), a path part at that folder. The path's [param]/ parts and
  the Preview line's values are in the widget accent (a param and its value read as a pair).
  A [param] page previews the page of it shown last (ui.previewAt, main.js pickTarget), else its
  first; the Preview line opens the item selector (PreviewPicker.svelte) to pick another, every
  tab shows it. The warning line jumps to the main widget, on the param row that is wrong.
-->
<script>
  import { ui, closeSectionPopup, showWidget } from './ui.svelte.js';
  import BackHead from './BackHead.svelte';
  import PreviewPicker from './PreviewPicker.svelte';
  import { parentId, pathOfId } from '../../site/routes.js';
  import { crumbsOf, pageIds, titleOf } from '../lib/page-tree.js';
  import { SITE_PARTS } from '../lib/site-parts.js';
  import { isParam, pageFile, paramsOf } from '../../site/files.js';
  import { mainProblem } from '../../site/layout/source.js';

  // live: reactive store; actions: pickTarget, setPanel, setPageTab (main.js)
  let { live, actions } = $props();

  // the store's files (live.svelte.js: one shared copy per change)
  const files = $derived(live.files);
  const t = $derived(ui.target);
  const id = $derived(
    t?.kind !== 'page'
      ? null
      : t.template || pageIds(files).find((p) => pathOfId(p) === t.path) || null,
  );
  // the page's path parts: its folder's, then its own (the current one)
  const crumbs = $derived.by(() => {
    if (!id) return []; // a site part: its title only
    if (id === 'home') return [{ label: '/', level: '' }];
    const own = id.slice(id.lastIndexOf('/') + 1); // a [param] page: "[person]"
    return [...crumbsOf(parentId(id)), { label: `${own}/`, level: null }];
  });
  // a [param] page: its menu entry's name ("People item"), not "[person]"
  const title = $derived(id && !t.template ? titleOf(files, id) : t?.title || '');
  // a page: its address is the crumbs, below; a template or site part: the pages list's line
  const sub = $derived(
    t?.kind === 'item-template'
      ? 'Templates'
      : (SITE_PARTS.find((p) => p.id === t?.id)?.sub ?? ''),
  );

  // ←: the level it was opened from (its own folder or the one it is in), else the latter
  const backTo = () => {
    const at = ui.pagesWin.folder;
    if (!id || id === 'home') return id ? '' : at;
    return at === id || at === parentId(id) ? at : parentId(id);
  };
  function list(level = backTo()) {
    ui.pagesWin = { open: true, folder: level };
    if (ui.panel !== 'pages') actions.setPanel('pages');
  }

  // ---- a [param] page: the page of it shown, and why it builds none
  const template = $derived(!!t?.template);
  const isParamCrumb = (c) => isParam(c.label.replace(/\/$/, ''));
  const route = $derived(template ? live.routeOf(ui.path) : null);
  const values = $derived(template ? paramsOf(id).map((p) => route?.params?.[p] ?? `[${p}]`) : []);
  const problem = $derived(template ? mainProblem(live.content, id) : null);
  let picker = $state();
  const entry = () => ui.pages.find((e) => e.template === id);
  /** The warning: the main widget open on its Content tab, its wrong param row focused. */
  function toMain() {
    const main = live.get(pageFile(id), '/main');
    if (ui.panel !== 'pages') actions.setPanel('pages');
    ui.pagesWin = { ...ui.pagesWin, open: false };
    closeSectionPopup();
    const has = problem?.kind !== 'none';
    showWidget(has ? main : null, has);
    ui.focusParam = has ? { widget: main, param: problem?.param ?? '' } : null;
  }
</script>

<div class="ph">
  <BackHead backLabel="Back to pages" {title} onback={() => list()}>
    {#if crumbs.length}
      <nav class="ph__path" aria-label="Where it is">
        {#each crumbs as c, i (i)}
          {#if c.level === null}
            <span
              class={['ph__crumb', 'is-current', isParamCrumb(c) && 'is-param']}
              aria-current="page">{c.label}</span
            >
          {:else}
            <button
              type="button"
              class={['ph__crumb', isParamCrumb(c) && 'is-param']}
              onclick={() => list(c.level)}>{c.label}</button
            >
          {/if}
        {/each}
      </nav>
    {:else if sub}
      <span class="ph__sub">{sub}</span>
    {/if}
  </BackHead>
  {#if template}
    <button
      type="button"
      class="ph__preview"
      title="The page every tab and the preview show: pick another"
      aria-haspopup="dialog"
      onclick={() => picker.open()}
    >
      <span class="ph__label">Preview</span>
      {#each values as v, i (i)}{#if i}<span class="ph__sep">/</span>{/if}<span class="ph__val"
          >{v}</span
        >{/each}
      <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
    </button>
    <PreviewPicker
      bind:this={picker}
      {live}
      {id}
      path={ui.path}
      onpick={(path) => actions.pickTarget(entry(), path)}
    />
  {/if}
  <!-- only in that state: the head grows by this line then (nothing is reserved for it) -->
  {#if problem}
    <p class="ph__warn" role="status">
      <button
        type="button"
        title={problem.kind === 'none' ? 'Show the sections' : 'Open the main widget'}
        onclick={toMain}
        ><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><span
          >{problem.message}</span
        ></button
      >
    </p>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // 12px sides and top, 8px under the title block to the tabs (or the body)
  .ph {
    @include stack(0);
    flex: none;
    padding: var(--space-3) var(--space-3) var(--space-2);
  }

  .ph__sub {
    @include ellipsis;
    color: var(--c-text-muted);
  }

  // one line: the parts shrink (ellipsis), the page's own last
  .ph__path {
    @include row(0);
    overflow: hidden;
    font-size: var(--fs-base);
    line-height: 20px;
  }

  // the page accent (the pages list's paths); a part's text on its left edge
  .ph__crumb {
    @include ellipsis;
    flex: 0 1 auto;
    min-width: 2ch;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-page-accent);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      @include focus-ring;
    }

    // the root "/": its own width (2ch would leave a gap after it), never shrunk
    &:first-child {
      flex: none;
      min-width: 0;
    }

    &.is-current {
      flex: none;
      color: var(--c-text-muted);
      cursor: default;
      text-decoration: none;
    }

    // a [param]/ part, its slash too: the widget accent
    &.is-param {
      color: var(--c-widget-accent);
    }
  }

  // [ PREVIEW  noor-vermeer / 2018 ▾ ]: text-style, 24px, on the 12px edge
  .ph__preview {
    @include row(var(--space-2));
    align-self: start;
    max-width: 100%;
    height: 24px;
    margin-top: var(--space-1);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    cursor: pointer;

    &:hover .ph__val {
      text-decoration: underline;
    }

    &:focus-visible {
      @include focus-ring;
    }

    i {
      flex: none;
      color: var(--c-text-muted);
      font-size: var(--fs-2xs);
    }
  }

  .ph__label {
    @include muted;
    flex: none;
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .ph__val {
    @include ellipsis;
    color: var(--c-widget-accent);
  }

  .ph__sep {
    color: var(--c-text-faint);
  }

  // the main widget's error: one 20px line in the warning colour; a click opens the widget
  .ph__warn {
    margin: var(--space-1) 0 0;

    button {
      @include row(var(--space-2));
      max-width: 100%;
      padding: 0;
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--c-notice);
      font: inherit;
      font-size: var(--fs-sm);
      line-height: 20px;
      text-align: left;
      cursor: pointer;

      &:hover span {
        text-decoration: underline;
      }

      &:focus-visible {
        @include focus-ring;
      }
    }

    i {
      flex: none;
      font-size: var(--fs-2xs);
    }

    span {
      @include ellipsis;
    }
  }
</style>
