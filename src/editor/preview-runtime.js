/**
 * Bridge between the editor and the real site running in a same-origin iframe.
 *
 * The site calls window.parent.__siteEditor.connect(api, win) at startup (see
 * src/client/main.js), before it mounts the first page. From then on the editor:
 *  - pushes the edited animations.json into the preview and re-mounts animations,
 *  - re-applies edited text to every [data-edit] element whenever a page mounts (and after an
 *    undo, a redo or an edit the targeted patch didn't cover: main.js; a text typed in a
 *    widget's field is patched into its one element: layout-sync.js patchTexts, patchText),
 *  - Arrange clicks ('arrange'; ui.svelte.js previewClicks): a double click turns a
 *    [data-edit-inline] element (a Text widget's body, the only one) into an inline editor
 *    until it loses focus (a single click picks its widget: overlay.js); any other double-clicked
 *    text, photo (data-edit-type="photo") or bound value opens its field in the panel. Links,
 *    buttons and forms don't act on clicks (Alt+click does),
 *  - lets you hover/click widgets ([data-widget]) and [data-anim] elements to select them (animate
 *    clicks, 'animate': the innermost one under the pointer); visitor clicks ('visitor'):
 *    links work, nothing is picked,
 *  - a bound value ([data-bound], src/render/layout/bindings.js) is not typed in the preview:
 *    its field in the panel shows the binding.
 */
import { withDraft } from './source.js';
import { EDIT_PARAM } from './lib/editor-url.js';
import { splitEdit, words } from '../render/helpers.js';
import { ANIMATIONS } from '../render/files.js';
import { longestWord } from '../widgets/hero/index.js';
import { photoSrcset, photoUrl } from './svelte/media.svelte.js';
import { T } from './ui-tokens.js';
import { reveal } from './reveal.js';
import { createEdit } from './preview-edit.js';

// the preview's styles. The header clock's endless pulse is paused (the editor's motion is
// still too): it repainted the preview every frame, idle or not (F65, F66, F83)
const INJECTED_CSS = `
html .header__clock-dot { animation-play-state: paused; }
html { scrollbar-width: thin; scrollbar-color: rgb(255 255 255 / .2) transparent; }
html::-webkit-scrollbar { width: 8px; height: 8px; }
html::-webkit-scrollbar-track, html::-webkit-scrollbar-corner { background: transparent; }
html::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 999px; background: rgb(255 255 255 / .2) padding-box; }
html.__ed-arrange [data-edit], html.__ed-arrange [data-bound] { outline-offset: 3px; border-radius: ${T.radiusXs}; pointer-events: auto; }
html.__ed-arrange [data-edit]:hover { outline: 1px dashed rgb(255 255 255 / .5); }
html.__ed-arrange [data-bound]:hover { outline: 1px dotted rgb(255 255 255 / .5); }
html.__ed-arrange [data-edit-inline][contenteditable] { outline: 1.5px solid ${T.accent}; caret-color: ${T.accent}; cursor: text !important; }
html.__ed-arrange [data-edit-inline].__ed-invalid { outline-color: ${T.error} !important; }
html.__ed-arrange [data-widget], html.__ed-arrange [data-widget] *:not([contenteditable], [contenteditable] *) { cursor: default !important; }
[data-bound-missing] { opacity: .4; }
html.__ed-arrange .hero__title { z-index: 5; }
:is(html.__ed-arrange, html.__ed-animate) :is([data-header], [data-footer]):not([data-ed-open]) *, :is(html.__ed-arrange, html.__ed-animate):has([data-ed-open]) [data-router-view] * { pointer-events: none !important; }
:is(html.__ed-arrange, html.__ed-animate) :is([data-header], [data-footer]):not([data-ed-open]) { pointer-events: none; }
:is(html.__ed-arrange, html.__ed-animate) :is([data-header], [data-footer])[data-ed-open] { outline: 2px solid ${T.accent}; outline-offset: -2px; }
:is(html.__ed-arrange, html.__ed-animate) [data-footer]:not(:has([data-sec])) { min-height: 96px; }
html.__ed-animate [data-anim], html.__ed-animate [data-anim] *, html.__ed-animate [data-widget], html.__ed-animate [data-widget] * { cursor: pointer !important; }
/* a press on a widget's link or button only picks the widget: the press misses it (no :active, :hover or focus look), the widget gets it; Alt+click still clicks through (__ed-alt); a clickable template item's widgets: overlay.js finds them by position */
/* a link saved as the editor's own preview address (F50): marked, a click asks for it again (F107) */
html:is(.__ed-arrange, .__ed-animate) a:is([href*="?draft="], [href*="&draft="], [data-ts-link*="draft="]) { text-decoration: underline wavy ${T.error} !important; text-decoration-thickness: 1.5px !important; text-underline-offset: 3px; }
html:is(.__ed-arrange, .__ed-animate):not(.__ed-alt) [data-widget] :is(a, button, [role="button"], summary, label):not([data-anim], :has([data-anim], [contenteditable]), [contenteditable] *) { pointer-events: none; }
.__ed-box { position: fixed; z-index: 2147483646; pointer-events: none; border-radius: ${T.radiusSm}; opacity: 0; transition: opacity .15s; left: 0; top: 0; }
.__ed-box.is-on { opacity: 1; }
.__ed-box--hover { border: 1px dashed rgb(255 255 255 / .6); }
.__ed-box--sel { border: 1.5px solid ${T.accent}; box-shadow: 0 0 0 4px color-mix(in srgb, ${T.accent} 14%, transparent), inset 0 0 0 9999px color-mix(in srgb, ${T.accent} 4%, transparent); }
.__ed-box span { position: absolute; left: -1.5px; bottom: 100%; margin-bottom: 4px; font: 500 ${T.fsXs}/1 ${T.font}; letter-spacing: .04em; padding: 4px 8px; border-radius: ${T.radiusSm}; white-space: nowrap; }
.__ed-box--hover span { background: ${T.black}; color: ${T.white}; border: 1px solid rgb(255 255 255 / .2); }
.__ed-box--sel span { background: ${T.accent}; color: ${T.onAccent}; }
.__ed-box.is-low span { bottom: auto; top: 100%; margin: 4px 0 0; }
html.__ed-tb-above .__ed-box--sel:not(.is-low) span, html.__ed-tb-below .__ed-box--sel.is-low span { visibility: hidden; }
html.__ed-arrange .ts__chip { border-radius: ${T.radiusXs}; background: rgb(${T.chipRgb} / .16); box-shadow: inset 0 0 0 1px rgb(${T.chipRgb} / .45); color: inherit; }
html.__ed-arrange [contenteditable] .ts__chip { color: rgb(${T.chipRgb}); user-select: all; cursor: default; }
html.__ed-arrange .ts__chip[data-unknown] { background: rgb(${T.warningRgb} / .16); box-shadow: inset 0 0 0 1px rgb(${T.warningRgb} / .6); }
html.__ed-arrange [contenteditable] .ts__chip[data-unknown] { color: rgb(${T.warningRgb}); }
[data-no-value] { position: relative; overflow: clip; }
[data-no-value] > * { opacity: .4; }
/* tag + names hint as one compact corner chip INSIDE the widget's own box: no layout shift, no
   overlap of the widgets around it; clipped to the box (a one-line label fits it), cut with …. */
[data-no-value]::before {
  content: attr(data-missing-tag) " · " attr(data-no-value);
  position: absolute; top: 0; left: 0; z-index: 2;
  max-width: 100%; max-height: 100%; box-sizing: border-box; overflow: hidden;
  padding: 0 4px; border-radius: ${T.radiusXs};
  background: rgb(0 0 0 / .82); box-shadow: inset 0 0 0 1px rgb(255 255 255 / .25);
  color: ${T.white}; font: ${T.fsXs}/16px ${T.font}; letter-spacing: .04em; text-align: left;
  white-space: nowrap; text-overflow: ellipsis; pointer-events: none;
}
html.__ed-arrange [data-edit-inline][data-edit-type="rich"][contenteditable] { outline-offset: 6px; }
html.__ed-arrange [data-edit-inline][data-edit-type="rich"][contenteditable] a { cursor: text !important; }
html.__ed-arrange [data-widget] :is([data-edit], [data-bound]):not(.__ed-invalid) { outline: none !important; }
`;

const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The preview iframe is attached later: App.svelte calls bridge.attach(iframe) when it renders.
 */
/**
 * picked(): the element picked ({ el, kind }, or null) and hovered(): the one under the pointer
 * (ui.svelte.js: ui.picked, ui.hoverEl). The bridge draws their outlines; it keeps no selection
 * of its own: a pick is reported ('pick': el, kind, { quiet }), as is a hover ('hover': el).
 * clicks(): what a click in the preview does (ui.svelte.js previewClicks, its one copy): clicksChanged() when it changes.
 */
export function createBridge({
  store,
  labelFor,
  picked = () => null,
  hovered = () => null,
  clicks = () => 'visitor',
  wake = () => {},
}) {
  const handlers = {
    connect: [],
    navigate: [],
    pick: [], // an element picked in the preview (el, kind, { quiet }), or null: none
    hover: [], // the element under the pointer (animate clicks), or null
    key: [],
    textPick: [],
    part: [],
    rich: [], // the Text widget editor's state changed (richState)
    richDone: [], // a Text widget's edit ended: its section renders again (edit ref)
    richLink: [], // Ctrl+K while editing: the toolbar's link box opens
  };
  const emit = (name, ...args) => handlers[name].forEach((fn) => fn(...args));
  let iframe = null;
  let api = null;
  let win = null;
  let doc = null;
  let boxes = null; // the hover and selected boxes (animate clicks; drawn: drawBoxes)
  const written = new WeakMap(); // box -> the styles drawBoxes last wrote on it
  const frameFns = new Set(); // called after each of the overlay's frames (onFrame)
  let applied = new WeakMap(); // element -> value it currently shows
  let restore = null; // after a reload(): puts scroll and selection back once mounted
  // editing in place (a Text widget's body; preview-edit.js)
  const edit = createEdit({
    store,
    emit,
    clicks,
    reveal: (el) => bridge.reveal(el),
    markApplied: (el, value) => applied.set(el, value),
  });

  const bridge = {
    /** The hover and selected boxes drawn (the overlay's frame: overlay.js); true: again. */
    drawBoxes: () => drawBoxes(),
    /**
     * `fn` called after every frame the overlay's loop draws (main.js: overlay's afterFrame), so
     * what follows the page from the editor (the widget toolbar) idles with it; one frame now.
     * Returns the unsubscribe.
     */
    onFrame(fn) {
      frameFns.add(fn);
      wake();
      return () => frameFns.delete(fn);
    },
    /** The overlay drew a frame (overlay.js frame(), after layout()). */
    framed() {
      for (const fn of frameFns) fn();
    },
    /** True when `node` is, or holds, an element a box is on (it moving moves the box). */
    boxed: (node) => [picked()?.el, hovered()].some((el) => el && node.contains?.(el)),
    get api() {
      return api;
    },
    get doc() {
      return doc;
    },
    on(name, fn) {
      handlers[name].push(fn);
    },
    path: () => (win ? win.location.pathname : null),

    /** Use `el` as the preview (an attachment: {@attach bridge.attach} in App.svelte). */
    attach(el) {
      iframe = el;
      // A full navigation inside the frame to an editor URL (?edit: the dev server gives frames the
      // site anyway) or the mock sandbox: load that page as a preview, never the editor in itself.
      iframe.addEventListener('load', () => {
        try {
          const cw = iframe.contentWindow;
          const { pathname, search } = cw?.location || {};
          if (cw && new URLSearchParams(search).has(EDIT_PARAM)) iframe.src = withDraft(pathname);
          else if (cw && pathname.startsWith('/sandbox/')) iframe.src = withDraft('/');
        } catch {
          /* cross-origin or frame not ready */
        }
      });
    },

    load(path) {
      iframe.src = withDraft(path);
    },
    /** Reload the preview page (a fresh render from disk) at the same scroll and selection. */
    reload() {
      if (!api) {
        iframe.contentWindow?.location.reload(); // not connected yet: load it again
        return;
      }
      const y = api.scrollTop();
      const view = doc.querySelector('[data-router-view]');
      const cur = picked();
      const sel = cur && {
        kind: cur.kind,
        edit: cur.el.dataset.edit ?? cur.el.dataset.bound,
        anim: [...view.querySelectorAll('[data-anim]')].indexOf(cur.el),
        widget: cur.el.dataset.widget,
      };
      restore = () => {
        api.scrollTop(y);
        if (!sel) return;
        const el = sel.edit
          ? doc.querySelector(
              `[data-edit="${CSS.escape(sel.edit)}"], [data-bound="${CSS.escape(sel.edit)}"]`,
            )
          : sel.widget
            ? doc.querySelector(`[data-widget="${CSS.escape(sel.widget)}"]`)
            : doc.querySelectorAll('[data-router-view] [data-anim]')[sel.anim];
        if (el) emit('pick', el, sel.kind, { quiet: true }); // never opens a pop-up
      };
      win.location.reload();
      // The old page is going away: no calls into it until the new one connects. Its document
      // stays readable meanwhile, so the panels keep their fields (no "waiting" flash).
      api = win = null;
      edit.lost();
    },
    navigate(path) {
      if (api && win.location.pathname !== path) api.navigate(path);
      else if (!api) iframe.src = withDraft(path);
    },

    /** What a click in the preview does changed (clicks(): ui.svelte.js previewClicks). */
    clicksChanged() {
      if (!doc) return;
      doc.documentElement.classList.toggle('__ed-arrange', clicks() === 'arrange');
      doc.documentElement.classList.toggle('__ed-animate', clicks() === 'animate');
      // Freeze first: reverting split-text animations re-creates their inner elements,
      // which would drop contenteditable from editable text inside them (page titles, hero name).
      if (api) {
        if (clicks() === 'arrange') api.freeze();
        else api.unfreeze();
      }
      if (clicks() !== 'arrange') edit.endEdits();
      wake();
    },

    /** Unique [data-edit] fields on the current page, in document order. */
    editFields() {
      if (!doc) return [];
      const seen = new Map();
      for (const el of doc.querySelectorAll('[data-edit]')) {
        const edit = el.dataset.edit;
        if (!seen.has(edit))
          seen.set(edit, {
            edit,
            ...splitEdit(edit),
            type: el.dataset.editType || 'text',
            els: [],
          });
        seen.get(edit).els.push(el);
      }
      return [...seen.values()];
    },

    /** [data-anim] elements on the current page (view + portal + footer). */
    animElements() {
      if (!doc) return [];
      return [
        ...doc.querySelectorAll(
          '[data-router-view] [data-anim], #portal [data-anim], [data-footer] [data-anim]',
        ),
      ].map((el) => ({
        el,
        id: el.dataset.anim,
        key: el.dataset.animKey,
      }));
    },

    /**
     * Write the store's text values into the preview. `applied` remembers what each
     * element shows, so unrelated changes don't touch (or re-animate) the page.
     */
    applyTexts({ force = false, skip = null, plain = false } = {}) {
      if (!doc) return;
      const pending = [];
      for (const el of doc.querySelectorAll('[data-edit]')) {
        const { file, ptr } = splitEdit(el.dataset.edit);
        const value = store.get(file, ptr);
        if (value === undefined || value === null) continue;
        // a Text widget's body: the dev server renders it (its properties' values)
        if (el.dataset.editType === 'rich') continue;
        if (el === skip) {
          applied.set(el, value);
          continue;
        }
        if (!force && (el === doc.activeElement || applied.get(el) === value)) continue;
        pending.push([el, value]);
      }
      bridge.applyCurtain();

      if (!pending.length) return;
      const run = () => {
        for (const [el, value] of pending) writeText(el, value);
      };
      // Without arrange clicks, split-text animations own the DOM: revert, write, re-mount.
      if (!plain && clicks() !== 'arrange' && api) {
        api.freeze();
        run();
        api.unfreeze();
      } else run();
    },

    /** The page-transition label on <main> in step with the draft content. */
    applyCurtain() {
      const view = doc?.querySelector('[data-router-view]');
      if (!view?.dataset.curtainEdit) return;
      const { file, ptr } = splitEdit(view.dataset.curtainEdit);
      const value = store.get(file, ptr);
      if (value !== undefined && value !== null) view.setAttribute('data-curtain', String(value));
    },

    /**
     * One [data-edit] element shows `value` now (the targeted patch: layout-sync.js patchTexts).
     * Its words and lines as the render writes them (text, multiline, words; a photo's URL).
     */
    patchText(el, value) {
      writeText(el, value);
    },

    updateAnimations(cfg, { replay = true } = {}) {
      if (!api) return;
      api.setAnimations(cfg);
      if (replay && clicks() !== 'arrange')
        bridge.replay(picked()?.kind === 'anim' ? picked().el : null, { scroll: false });
    },

    /**
     * Play one widget's (or data-anim element's) animation again, bringing it into view first;
     * every animation of the page when it has none of its own.
     */
    replayOne(el) {
      if (!api || !el) return;
      reveal(el, { when: 'play', smooth: false });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!api?.replay(el)) api?.remount();
        }),
      );
    },

    /** Re-run the page's animations, optionally bringing `el` into view first. */
    replay(el, { scroll = true } = {}) {
      if (!api) return;
      if (el && scroll) reveal(el, { when: 'play', smooth: false });
      // (api is null again if a save reloads the preview in between)
      requestAnimationFrame(() => requestAnimationFrame(() => api?.remount()));
    },

    /** Scroll helper: 0 = element just entering the viewport, 1 = just left it. */
    scrubTo(el, p) {
      if (!api) return;
      const { start, end, max } = api.scrollRange(el);
      api.scrollTop(Math.max(0, Math.min(max, start + (end - start) * p)));
    },
    scrubProgress(el) {
      if (!api) return 0;
      const { start, end } = api.scrollRange(el);
      return end > start ? Math.max(0, Math.min(1, (api.scrollTop() - start) / (end - start))) : 0;
    },

    /** A text (focused, picked) centred when it is out of view (reveal.js). */
    reveal(el) {
      if (el && api) reveal(el);
    },
    /**
     * Where the widget toolbar sits ('above' | 'below' | 'inside', null: none): the selected
     * box's label on that side is hidden so the toolbar is never under it.
     */
    toolbarSide(side) {
      const root = doc?.documentElement;
      if (!root) return;
      root.classList.toggle('__ed-tb-above', side === 'above');
      root.classList.toggle('__ed-tb-below', side === 'below');
    },
    /** Editing in place (preview-edit.js): the Text widget editor's state for the toolbar. */
    get rich() {
      return edit.rich;
    },
    /** Is a Text widget being edited? */
    get richEditing() {
      return edit.richEditing;
    },
    endRich: edit.endRich,
    releaseRich: edit.releaseRich,
    richApply: edit.richApply,
    selectLink: edit.selectLink,
    holdRich: edit.holdRich,
    editWidget: edit.editWidget,
    /** The editing itself and the bridge's events, for the preview's pointer (preview-pointer.js). */
    edit,
    emit,
    focusEdit(ref) {
      const el = doc?.querySelector(
        `[data-edit="${CSS.escape(ref)}"], [data-bound="${CSS.escape(ref)}"]`,
      );
      if (!el) return;
      bridge.reveal(el);
      emit('pick', el, 'text');
    },
  };

  /** Write `value` into the [data-edit] element `el`, as its type is rendered. */
  function writeText(el, value) {
    applied.set(el, value);
    if (el.dataset.editType === 'photo') {
      // a new photo: its URL and, for an R2 photo, its sizes (the sizes attribute stays)
      const url = photoUrl(value);
      if (el.getAttribute('src') !== url) {
        const srcset = photoSrcset(value);
        if (srcset) el.srcset = srcset;
        else el.removeAttribute('srcset');
        el.src = url;
      }
    } else if (el.dataset.editType === 'multiline') {
      const html = escText(value).replace(/\r?\n/g, '<br>');
      if (el.innerHTML !== html) el.innerHTML = html;
    } else if (el.dataset.editType === 'words') {
      const html = words(value);
      if (el.innerHTML !== html) el.innerHTML = html;
      // the hero's name: its size follows its longest word (hero__title's --hero-word)
      const title = el.parentElement;
      if (title?.style.getPropertyValue('--hero-word'))
        title.style.setProperty('--hero-word', String(longestWord(value)));
    } else if (el.textContent !== String(value)) el.textContent = String(value);
  }

  function boxLabel(el, kind) {
    if (kind === 'text') {
      // a bound value: its field's label, "from the item"
      const edit = el.dataset.edit ?? el.dataset.bound;
      const label = labelFor?.(splitEdit(edit)) || edit;
      return el.dataset.bound ? `${label} · from the item` : label;
    }
    if (el.dataset.anim === undefined) {
      const type = [...el.classList].find((c) => c.startsWith('wgt--'))?.slice(5) || 'widget';
      return `${type} · ${el.dataset.motion || 'no motion'}`;
    }
    return `${el.dataset.anim} · ${api?.resolve(el.dataset.anim, el)?.animation || '?'}`;
  }

  /**
   * A box on `el` (none: hidden); true when it changed. Only what changed is written: a box
   * that stays where it is writes nothing (the overlay's loop idles, no mutation for it).
   */
  function placeBox(box, el, kind) {
    const r = el?.isConnected ? el.getBoundingClientRect() : null;
    const on = !!r && (r.width > 0 || r.height > 0) && clicks() !== 'visitor';
    let changed = box.classList.contains('is-on') !== on;
    box.classList.toggle('is-on', on);
    if (!on) return changed;
    // (compared with what was written, not read back: the browser rounds what it serializes)
    const was = written.get(box) || {};
    written.set(box, was);
    const set = (k, v) => was[k] !== v && ((box.style[k] = was[k] = v), (changed = true));
    set('transform', `translate(${r.left - 4}px, ${r.top - 4}px)`);
    set('width', `${r.width + 8}px`);
    set('height', `${r.height + 8}px`);
    if (box.classList.contains('is-low') !== r.top < 30) {
      box.classList.toggle('is-low', r.top < 30);
      changed = true;
    }
    const label = boxLabel(el, kind);
    if (box.firstChild.textContent !== label) box.firstChild.textContent = label;
    return changed;
  }

  /**
   * The hover and selected boxes placed on their elements: in the overlay's frame (its one
   * draw loop: overlay.js), while it runs (the page, the pointer, a key or an animation woke
   * it); true: a box moved this frame (what it is on may still be moving: one more frame).
   */
  function drawBoxes() {
    if (!boxes?.hover.isConnected) return false;
    const selected = picked();
    const hoverEl = hovered();
    const sameAsSel = selected && hoverEl === selected.el;
    // a text in a widget (arrange clicks): the overlay's frame on the widget is its one border
    const boxTarget = (el) =>
      clicks() === 'arrange' && el?.closest?.('[data-widget]') ? null : el;
    const a = placeBox(
      boxes.hover,
      sameAsSel ? null : boxTarget(hoverEl),
      clicks() === 'arrange' ? 'text' : 'anim',
    );
    const b = placeBox(boxes.sel, boxTarget(selected?.el), selected?.kind);
    return a || b;
  }

  function attachListeners() {
    const style = doc.createElement('style');
    style.id = '__ed-style';
    // (its colours: ui-tokens.js, read from the editor's styles/_tokens.scss)
    style.textContent = INJECTED_CSS;
    doc.head.append(style);
    const mk = (cls) => {
      const b = doc.createElement('div');
      b.className = `__ed-box ${cls}`;
      b.append(doc.createElement('span'));
      doc.documentElement.append(b);
      return b;
    };
    boxes = { hover: mk('__ed-box--hover'), sel: mk('__ed-box--sel') };
    edit.attach(); // typing, its keys, paste (the pointer's: preview-pointer.js)
  }

  // Called by the site (src/client/main.js) before its first mount.
  window.__siteEditor = {
    connect(siteApi, siteWin) {
      api = siteApi;
      win = siteWin;
      applied = new WeakMap();
      doc = siteWin.document;
      edit.connect(doc, win);
      boxes = null;
      api.setAnimations(store.current[ANIMATIONS]);
      if (clicks() === 'arrange') api.freeze();
      api.hooks.beforeMount.add(() => bridge.applyTexts({ force: true, plain: true }));
      api.hooks.afterMount.add(() => {
        doc.documentElement.classList.toggle('__ed-arrange', clicks() === 'arrange');
        doc.documentElement.classList.toggle('__ed-animate', clicks() === 'animate');
        emit('pick', null);
        emit('navigate', win.location.pathname);
        restore?.();
        restore = null;
        wake();
      });
      attachListeners();
      emit('connect', api);
    },
  };

  return bridge;
}
