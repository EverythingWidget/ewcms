<!--
  One toolbar, on the selected widget only (ui.widget, Content tab), over the preview: drawn on
  the stage (App.svelte) at the widget's top left edge, above it (below it when there is no
  room, inside it when it is taller than the frame), never moving the page. Two parts:

    text      (a Text widget) style ▾ (the line the caret is in: the whole line), Fit (the
              text's longest line fills the widget's width, type.js "fit"), B, I, link
              (the selected text only: greyed with nothing selected or when not editing),
              + Field (a field of the item the widget shows, or a count, at the caret)

  Selected, a widget with text shows Edit (where it is: the overlay's tag, its size and place;
  what it follows: its link line and its pop-up's Layout); its text tools only in its edit mode (Edit,
  or a double click on the widget; Esc or a click outside ends it, no Done). A single click
  only selects. Menus open under their own button and stay open after a pick.

  Its layout (size, layer) is on the widget's card only (WidgetLayout.svelte); the
  keys [ and ] still move it down / up a layer (App.svelte). A widget without text has none
  (nothing shows). A narrow widget puts the text marks into a "…" menu. The edit itself is bridge.js's
  (rich.js).
-->
<script>
  import { ui } from './ui.svelte.js';
  import { targetFile } from '../layout-sync.js';
  import { schemaFor } from './source-items.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import { sourceFile, sourceIds as sourceIdsOf } from '../../site/files.js';
  import { sourceOf } from '../../site/layout/source.js';
  import { untrack } from 'svelte';
  import { setWidget } from '../layout-ops.js';
  import { FIT_TYPES, fitted } from '../../site/layout/type.js';
  import { isSafeHref, UNSAFE_HREF } from '../../site/hrefs.js';
  import {
    LINE_STYLES,
    insertRun,
    lineLength,
    setLink,
    setStyle,
    toggleList,
    styleLabel,
    toggleMark,
  } from '../../site/text.js';
  import { MOD } from '../lib/format.js';

  let { live, bridge } = $props();

  // ---- the widget: where it is in its file, its stored value, its element in the preview
  const where = $derived.by(() => {
    live.version;
    ui.previewVersion;
    const id = ui.widget;
    if (!id || ui.mode !== 'text') return null;
    const file = targetFile(ui.target, bridge.doc);
    const list = live.get(file, '/sections') || [];
    for (const [at, s] of list.entries()) {
      const j = (s?.widgets || []).findIndex((b) => b?.id === id);
      if (j >= 0) return { id, file, at, j, base: `/sections/${at}/widgets/${j}` };
    }
    return null;
  });
  const widget = $derived.by(() => {
    live.version;
    return where ? live.get(where.file, where.base) || {} : null;
  });
  const type = $derived(WIDGET_TYPES[widget?.type] || {});
  const hasText = $derived(!!type.fields?.some((f) => f.type === 'rich'));
  const rich = $derived(ui.rich && ui.rich.widget === where?.id ? ui.rich : null);
  const editing = $derived(!!rich);
  const style = $derived(rich ? rich.style : widget?.body?.[0]?.style || 'paragraph');
  // Fit: its longest line fills its width (type.js "fit"), or its styles' sizes
  const canFit = $derived(FIT_TYPES.includes(widget?.type));
  const isFit = $derived(fitted(widget));
  const toggleFit = () =>
    setWidget(live.store, where.file, where.at, where.j, { fit: isFit ? undefined : true });
  const bodyRef = $derived(where ? { file: where.file, ptr: `${where.base}/body` } : null);

  // ---- where it is drawn: the widget's box in the frame, on the stage, every frame
  let box = $state(null); // { x, y, w, h, frameTop, frameBottom }
  let hidden = $state(false);
  // its section shown from the panel (the widget's section card hovered): none, as the frame
  const peeking = $derived(ui.peek?.from === 'panel');
  // shown: a widget picked, its box known, no drag and no peek (else hidden, still mounted)
  const shown = $derived(!!(where && widget && hasText && pos && !hidden && !peeking));
  $effect(() => {
    if (!where) return void (box = null);
    const id = where.id;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const doc = bridge.doc;
      const frame = doc?.defaultView?.frameElement;
      const el = doc?.querySelector(`[data-widget="${CSS.escape(id)}"]`);
      const stage = frame?.parentElement;
      if (!el || !stage) return void (box = null);
      const r = el.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      const next = {
        x: Math.round(f.left - s.left + r.left),
        y: Math.round(f.top - s.top + r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
        frameTop: Math.round(f.top - s.top),
        frameBottom: Math.round(f.bottom - s.top),
        frameLeft: Math.round(f.left - s.left),
        frameRight: Math.round(f.right - s.left),
      };
      if (!box || Object.keys(next).some((k) => next[k] !== box[k])) box = next;
      // a drag in the preview (overlay.js holds the rows): out of the way
      const drag = doc.documentElement.hasAttribute('data-flow-hold');
      if (drag !== hidden) hidden = drag;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  });

  // its toolbar's width (measured), for where it goes and what moves into "…"
  let barW = $state(0);
  const TEXT_W = 440; // style + Fit + lists + B I link + Field, about
  const level = $derived.by(() => {
    if (!box) return 0;
    const room = Math.max(box.w, 280);
    if (!editing || room >= TEXT_W + 48) return 0; // everything
    return 1; // the marks in "…"
  });
  const BAR_H = 40;
  const CIRCLE_CLEAR = 24;
  const pos = $derived.by(() => {
    if (!box) return null;
    const x = Math.min(
      Math.max(box.x, box.frameLeft + 8),
      Math.max(box.frameLeft + 8, box.frameRight - 8 - barW),
    );
    // always clear of the widget's link circles (overlay.js: centred, 12px outside its top and
    // bottom edges, 12px wide), whatever its width: it never jumps when its width changes
    const gap = CIRCLE_CLEAR;
    const above = box.y - BAR_H - gap;
    const below = box.y + box.h + gap + 4;
    let y;
    let flip = false;
    let side = 'inside';
    if (above >= box.frameTop + 8) {
      y = above;
      side = 'above';
    } else if (below + BAR_H <= box.frameBottom - 8) {
      y = below;
      flip = true;
      side = 'below';
    } else y = Math.max(box.frameTop + 8, box.y + 8); // taller than the frame: inside its top
    return { x, y, flip, side };
  });

  // the preview's label of the selected text steps aside on the toolbar's side (no shift)
  $effect(() => {
    const side = where && widget && pos && !hidden && !peeking ? pos.side : null;
    bridge.toolbarSide(side);
    return () => bridge.toolbarSide(null);
  });

  // ---- menus: one open at a time; a click elsewhere (here or in the preview) closes it
  let open = $state(null);
  // under its own button: the button's left edge in the toolbar
  let anchor = $state(0);
  // its menu over the bar when there's more room there than under it (a caret low in the
  // preview), and never past the stage: scrolls inside instead (nothing moves)
  let barEl = $state();
  let popEl = $state();
  let popUp = $state(false);
  let popMax = $state(0);
  $effect(() => {
    if (!open || !popEl || !barEl) return;
    void pos?.y;
    const stage = barEl.closest('.btb')?.offsetParent?.getBoundingClientRect();
    const bar = barEl.getBoundingClientRect();
    if (!stage) return;
    const GAP = 4;
    const MARGIN = 8;
    const below = Math.min(stage.bottom, innerHeight) - bar.bottom - GAP - MARGIN;
    const above = bar.top - Math.max(stage.top, 0) - GAP - MARGIN;
    const need = popEl.scrollHeight;
    popUp = need > below && above > below;
    popMax = Math.max(0, Math.floor(popUp ? above : below));
  });
  const toggle = (name, e) => {
    if (e?.currentTarget) anchor = e.currentTarget.offsetLeft;
    open = open === name ? null : name;
  };
  $effect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.target?.closest?.('.btb')) return;
      // the link box held the edit open: a click elsewhere cancels it and lets go
      if (open === 'link') bridge.releaseRich(e.target);
      open = null;
    };
    // Esc: the menu first (the edit goes on)
    const esc = (e) => {
      if (e.key !== 'Escape' || open === 'link') return;
      e.preventDefault();
      e.stopPropagation();
      open = null;
    };
    const doc = bridge.doc;
    // the preview's window, not its document: it hears the key before the edit's own Esc
    const view = doc?.defaultView;
    window.addEventListener('pointerdown', close, true);
    doc?.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc, true);
    view?.addEventListener('keydown', esc, true);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      doc?.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', esc, true);
      view?.removeEventListener('keydown', esc, true);
    };
  });
  $effect(() => {
    where?.id;
    // another widget picked while the link box held the edit open: it lets go, the edit ends
    untrack(() => {
      if (open === 'link') bridge.releaseRich(null);
      open = null;
    });
  });
  // the edit ended (Esc, a click elsewhere): its text tools' menus go with it
  $effect(() => {
    if (!rich) open = null;
  });
  // Ctrl+K while editing: the link box
  $effect(() =>
    bridge.on('richLink', () => {
      if (rich?.selected) openLink();
    }),
  );

  // the toolbar keeps the preview's focus (the caret stays): its buttons don't take it
  const keepFocus = (e) => {
    if (!e.target.closest?.('input')) e.preventDefault();
  };

  // ---- text
  const apply = (fn) => bridge.richApply(fn, bodyRef);
  // a pick keeps its menu open (Esc, a click outside or its button closes it)
  function pickStyle(s) {
    const line = rich ? rich.line : 0;
    apply((body) => ({ body: setStyle(body, line, s) }));
  }
  // the lines selected (or the caret's) as list items, or no list any more
  const list = (kind) =>
    apply((body, sel) => {
      const at = sel || {
        from: { line: rich?.line ?? 0, at: 0 },
        to: { line: rich?.line ?? 0, at: 0 },
      };
      return { body: toggleList(body, at.from, at.to, kind), sel: sel || undefined };
    });
  const mark = (m) =>
    apply((body, sel) => (sel ? { body: toggleMark(body, sel.from, sel.to, m) } : null));

  let linkText = $state('');
  let linkBtn = $state();
  function openLink(e) {
    anchor = e?.currentTarget?.offsetLeft ?? linkBtn?.offsetLeft ?? anchor;
    linkText = rich?.link?.href ?? '';
    bridge.holdRich(true);
    open = 'link';
  }
  const linkError = $derived(linkText.trim() && !isSafeHref(linkText.trim()) ? UNSAFE_HREF : '');
  function saveLink(e) {
    e?.preventDefault();
    if (linkError) return;
    const href = linkText.trim();
    open = null;
    bridge.holdRich(false);
    apply((body, sel) =>
      sel ? { body: setLink(body, sel.from, sel.to, href ? { href } : null) } : null,
    );
  }
  function cancelLink() {
    open = null;
    bridge.holdRich(false);
  }

  // + Field: the item's fields (the widget's source), and counts of the sources
  const from = $derived(sourceOf(widget)?.from ?? null);
  const fields = $derived.by(() => {
    live.version;
    return from
      ? (schemaFor(live.store, sourceFile(from))?.fields || []).filter((f) =>
          ['text', 'choice', 'number', 'date', 'longtext'].includes(f.type),
        )
      : [];
  });
  const sources = $derived.by(() => {
    live.version;
    return sourceIdsOf(live.store.current);
  });
  function insert(run) {
    apply((body, sel) => {
      if (!sel) return null;
      const at = sel.to.line < body.length ? sel.to : { line: 0, at: lineLength(body[0]) };
      const next = { line: at.line, at: at.at + 1 };
      return { body: insertRun(body, at, run), sel: { from: next, to: next } };
    });
  }
</script>

{#snippet styleMenu()}
  <div class="btb__menu" role="listbox" aria-label="Style of this line">
    <span class="btb__grp">{editing ? 'This line' : 'Its first line'} · Settings › Typography</span>
    {#each LINE_STYLES as [s, label, tag] (s)}
      <button
        type="button"
        role="option"
        aria-selected={s === style}
        class={['btb__opt', s === style && 'is-on']}
        onclick={() => pickStyle(s)}
        ><span class="sty sty--{s}">{label}</span><span class="btb__hint">{tag.toUpperCase()}</span
        ><i class={['fa-solid fa-check btb__check', s !== style && 'is-off']} aria-hidden="true"
        ></i></button
      >
    {/each}
  </div>
{/snippet}

{#snippet marks()}
  <button
    type="button"
    class={['btb__btn btb__icon', rich?.list === 'bullet' && 'is-on']}
    disabled={!rich}
    aria-label="Bulleted list"
    aria-pressed={rich?.list === 'bullet'}
    title="Bulleted list: the lines selected (or typed - at a line's start)"
    onclick={() => list('bullet')}><i class="fa-solid fa-list-ul" aria-hidden="true"></i></button
  >
  <button
    type="button"
    class={['btb__btn btb__icon', rich?.list === 'number' && 'is-on']}
    disabled={!rich}
    aria-label="Numbered list"
    aria-pressed={rich?.list === 'number'}
    title="Numbered list: the lines selected (or typed 1. at a line's start)"
    onclick={() => list('number')}><i class="fa-solid fa-list-ol" aria-hidden="true"></i></button
  >
  <button
    type="button"
    class={['btb__btn btb__icon', rich?.bold && 'is-on']}
    disabled={!rich?.selected}
    aria-label="Bold"
    aria-pressed={!!rich?.bold}
    title="Bold ({MOD}+B): the selected text"
    onclick={() => mark('b')}><i class="fa-solid fa-bold" aria-hidden="true"></i></button
  >
  <button
    type="button"
    class={['btb__btn btb__icon', rich?.italic && 'is-on']}
    disabled={!rich?.selected}
    aria-label="Italic"
    aria-pressed={!!rich?.italic}
    title="Italic ({MOD}+I): the selected text"
    onclick={() => mark('i')}><i class="fa-solid fa-italic" aria-hidden="true"></i></button
  >
  <button
    type="button"
    class={['btb__btn btb__icon', rich?.link && 'is-on']}
    disabled={!rich?.selected}
    aria-label="Link"
    bind:this={linkBtn}
    title="Link ({MOD}+K): the selected text"
    onclick={openLink}><i class="fa-solid fa-link" aria-hidden="true"></i></button
  >
  <button
    type="button"
    class={['btb__btn btb__field', open === 'field' && 'is-open']}
    disabled={!editing}
    title="A field of the item it shows, or a count, at the caret"
    onclick={(e) => toggle('field', e)}
    ><i class="fa-solid fa-plus" aria-hidden="true"></i><span>Field</span></button
  >
{/snippet}

<!-- one element for the whole session: hidden when nothing shows, only its content swaps -->
<div
  class={['btb', pos?.flip && 'is-below', !shown && 'is-hidden']}
  style:left="{pos?.x ?? 0}px"
  style:top="{pos?.y ?? 0}px"
  aria-hidden={!shown}
  bind:clientWidth={barW}
  onpointerdown={keepFocus}
  onmousedown={keepFocus}
  role="presentation"
>
  {#if where && widget}
    <div class="btb__bar" bind:this={barEl} role="toolbar" aria-label="Widget">
      {#if hasText && !editing}
        <button
          type="button"
          class="btb__btn"
          title="Edit its text (or double-click it); Esc or a click outside ends"
          onclick={() => bridge.editWidget(where.id)}
          ><i class="fa-solid fa-pen" aria-hidden="true"></i><span>Edit</span></button
        >
      {/if}
      {#if editing}
        <button
          type="button"
          class={['btb__btn btb__style', open === 'style' && 'is-open']}
          title="The style of the line the caret is in (the whole line)"
          onclick={(e) => toggle('style', e)}
          ><span>{styleLabel(style)}</span><i
            class="fa-solid fa-chevron-down btb__caret"
            aria-hidden="true"
          ></i></button
        >
        {#if canFit}
          <button
            type="button"
            class={['btb__btn btb__icon', isFit && 'is-on']}
            aria-label="Fit"
            aria-pressed={isFit}
            title={isFit
              ? "Fit on: its longest line fills the widget's width. Click: its styles' sizes"
              : "Fit: its longest line fills the widget's width (off: its styles' sizes)"}
            onclick={toggleFit}
            ><i class="fa-solid fa-arrows-left-right-to-line" aria-hidden="true"></i></button
          >
        {/if}
        {#if level === 0}{@render marks()}{/if}
      {/if}
      {#if level > 0}
        <button
          type="button"
          class={['btb__btn btb__icon', open === 'more' && 'is-open']}
          aria-label="More"
          title="More: bold, italic, link, field"
          onclick={(e) => toggle('more', e)}
          ><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button
        >
      {/if}
    </div>

    {#if open}
      <div
        bind:this={popEl}
        class={['btb__pop', (open === 'style' || open === 'field') && 'is-list', popUp && 'is-up']}
        style="left: {anchor}px; max-height: {popMax ? `${popMax}px` : 'none'}"
      >
        {#if open === 'style'}
          {@render styleMenu()}
        {:else if open === 'link'}
          <form class="btb__row" onsubmit={saveLink}>
            <input
              class="tf__input btb__input btb__url"
              placeholder="https://… or /about/ (empty: no link)"
              aria-label="Link address"
              class:is-invalid={!!linkError}
              aria-invalid={!!linkError}
              bind:value={linkText}
              {@attach (el) => el.focus()}
              onkeydown={(e) => e.key === 'Escape' && (e.stopPropagation(), cancelLink())}
            />
            <button type="submit" class="btb__btn" disabled={!!linkError}>Link</button>
          </form>
          {#if linkError}<p class="btb__err" role="alert">{linkError}</p>{/if}
        {:else if open === 'field'}
          <span class="btb__grp">{from ? `A field of ${from}` : 'No source: no fields'}</span>
          {#each fields as f (f.key)}
            <button type="button" class="btb__opt" onclick={() => insert({ field: f.key })}
              ><span class="btb__chip">{f.key}</span><span class="btb__hint"
                >{f.label || f.type}</span
              ></button
            >
          {/each}
          <span class="btb__grp">A count</span>
          {#if from}
            <button
              type="button"
              class="btb__opt"
              onclick={() => insert({ count: { of: 'items' } })}
              ><span class="btb__chip">#items</span><span class="btb__hint">the ones it shows</span
              ></button
            >
          {/if}
          {#each sources as s (s)}
            <button type="button" class="btb__opt" onclick={() => insert({ count: { source: s } })}
              ><span class="btb__chip">#{s}</span><span class="btb__hint">items in {s}</span
              ></button
            >
          {/each}
        {:else if open === 'more'}
          <div class="btb__bar btb__bar--inner">{@render marks()}</div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .btb__err {
    max-width: 320px;
    margin: 0;
    padding: 0 var(--space-2) var(--space-2);
    color: var(--c-danger);
    font-size: var(--fs-xs);
  }

  .btb {
    position: absolute;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);

    // nothing to show: hidden in place (still measured, never unmounted)
    &.is-hidden {
      visibility: hidden;
      pointer-events: none;
    }
  }

  // above the widget: its menus open below the bar; under it the same
  .btb__bar {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    background: var(--c-card);
    color: var(--c-text);
    box-shadow:
      inset 0 0 0 1px var(--c-line),
      0 8px 24px var(--black-a40);
  }

  .btb__bar--inner {
    padding: 0;
    box-shadow: none;
  }

  .btb__btn {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    height: 32px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: inherit;
    font: inherit;
    font-size: var(--fs-base);
    white-space: nowrap;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--c-control-hover);
    }

    &:disabled {
      color: var(--c-text-faint);
      cursor: default;
    }

    &:focus-visible {
      @include focus-ring;
    }

    &.is-on,
    &.is-open {
      background: var(--c-control-hover);
    }

    &.is-on {
      color: var(--c-text-strong);
      box-shadow: inset 0 0 0 1px var(--c-line);
    }
  }

  .btb__icon {
    justify-content: center;
    width: 32px;
    padding: 0;
  }

  .btb__style {
    justify-content: space-between;
    width: 112px;
  }

  .btb__field:not(:disabled) {
    color: var(--c-widget-accent);
  }

  .btb__caret {
    font-size: var(--fs-2xs);
  }

  // out of the flow (the bar's width and place never change with it): under the bar, or over it
  .btb__pop {
    @include stack(var(--space-2));
    position: absolute;
    top: calc(100% + var(--space-1));
    width: 280px;
    overflow-y: auto;
    overscroll-behavior: contain;

    &.is-up {
      top: auto;
      bottom: calc(100% + var(--space-1));
    }

    padding: var(--space-2);
    border-radius: var(--radius-md);
    background: var(--c-card);
    box-shadow:
      inset 0 0 0 1px var(--c-line),
      0 8px 24px var(--black-a40);

    // every menu 280px wide; a list of rows: closer
    &.is-list {
      gap: 0;
      padding: var(--space-1);
    }
  }

  // a list menu: 4px card padding, its rows 8px in: every label, hint and check 12px from the edge
  .btb__grp {
    padding: var(--space-2) var(--space-2) var(--space-1);
    color: var(--c-text-soft);
    font-size: var(--fs-2xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .btb__opt {
    @include row(var(--space-2));
    width: 100%;
    min-height: 32px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    text-align: left;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--c-control-hover);
    }

    // the current choice: a light teal tint (a step stronger hovered), a teal check
    &.is-on {
      background: color-mix(in srgb, var(--c-widget-accent) 12%, transparent);
    }

    &.is-on:hover:not(:disabled) {
      background: color-mix(in srgb, var(--c-widget-accent) 20%, transparent);
    }

    &:disabled {
      color: var(--c-text-faint);
      cursor: default;
    }

    > span:first-of-type {
      flex: 1;
    }
  }

  // every row keeps the check's room: the hints line up
  .btb__check {
    width: 12px;
    color: var(--c-widget-accent);
    font-size: var(--fs-xs);

    &.is-off {
      visibility: hidden;
    }
  }

  .btb__hint {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }

  .btb__info {
    padding-inline: var(--space-1);
    font-variant-numeric: tabular-nums;
  }

  .btb__row {
    @include row(var(--space-2));
  }

  .btb__input {
    flex: 1;
    min-width: 0;
    height: 32px;
  }

  .btb__url {
    width: 220px;
  }

  .btb__chip {
    flex: none !important;
    padding: 0 var(--space-1);
    border-radius: var(--radius-xs);
    background: color-mix(in srgb, var(--c-widget-accent) 16%, transparent);
    color: var(--c-widget-accent);
  }

  // the styles as they look, small
  .sty--title {
    font-size: var(--fs-xl);
    font-weight: 600;
  }

  .sty--heading {
    font-size: var(--fs-lg);
    font-weight: 600;
  }

  .sty--subheading {
    font-weight: 600;
  }

  .sty--statement {
    font-size: var(--fs-md);
  }

  .sty--label {
    font-size: var(--fs-2xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .sty--small {
    font-size: var(--fs-xs);
  }
</style>
