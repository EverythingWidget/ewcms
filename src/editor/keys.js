/**
 * The editor's keyboard shortcuts, all in one place: pressed in the editor's own window, or
 * in the preview (preview-edit.js attach() forwards the keys isShortcut lets through: its 'key').
 *
 *   Ctrl+S          save
 *   Ctrl+Shift+E    the site as visitors see it (this page)
 *   Ctrl+Z / Y      undo / redo (Ctrl+Shift+Z: redo); in a panel's text field: its own undo
 *   [ ]             the selected widget's layer (by character: AltGr on other layouts)
 *   Esc             the modal in front, else the picked element, the selected link or widget;
 *                   an open Header or Footer stays open (Done is the way out)
 *   arrows          the selection moved by a cell (Shift: NUDGE_BIG; multi-select.js)
 *   Enter, a letter a picked Text widget's text edited (the letter typed at its end)
 *   Delete          the selected link removed, else several selected widgets (one undo step)
 *   Ctrl/Cmd held   ui.mod: the other sections show blocked (overlay.js)
 *
 * Not here: a drag's own Esc (it cancels that drag: overlay.js), a Text widget's editing keys
 * (Enter splits its line, Ctrl+B / I / K / A: preview-edit.js) and a menu's or a list's own
 * arrow keys (their components).
 */
import {
  ui,
  previewClicks,
  pickElement,
  selectLink,
  selectWidgets,
  deselect,
  setMod,
} from './svelte/ui.svelte.js';
import { closeModal, topModal } from './svelte/modals.svelte.js';
import { undoToast } from './svelte/toasts.svelte.js';
import { layerWidget, removeWidgets } from './layout-ops.js';
import { targetFile } from './layout-sync.js';
import { nudgeStep, selectedIds } from './multi-select.js';

/** Is the key's target somewhere typing goes (a field, a text edited in place)? */
export const typing = (t) => !!t?.closest?.('input, textarea, select, [contenteditable]');

/**
 * The preview's keys that are the editor's (forwarded, the browser's own action prevented):
 * Ctrl+S / E / Z / Y / K, Esc, and when not typing [ ], the arrows, Delete, Enter or a
 * character (a picked Text widget's text edited).
 */
export const isShortcut = (e) =>
  ((e.metaKey || e.ctrlKey) && /^[sezyk]$/i.test(e.key)) ||
  ((e.key === 'Enter' || e.key.length === 1) &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !typing(e.target)) ||
  e.key === 'Escape' ||
  ((e.key === '[' || e.key === ']') && !typing(e.target)) ||
  (/^(Arrow(Left|Right|Up|Down)|Delete|Backspace)$/.test(e.key) && !typing(e.target));

/** Ctrl/Cmd held in window `win` (the editor's, the preview's): ui.mod. */
export function watchMod(win) {
  const track = (e) => setMod(e.ctrlKey || e.metaKey);
  win.document.addEventListener('keydown', track, true);
  win.document.addEventListener('keyup', track, true);
  win.addEventListener('blur', () => setMod(false));
}

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/**
 * The one keydown handler (the editor's window, and the preview's forwarded keys): returns
 * onKey(e). store: store.js; bridge: the preview (preview-runtime.js); overlay: overlay.js
 * (nudge, deleteLink); save(): Ctrl+S; widgetAt(id): where a widget is ({ file, at, j }).
 */
export function createKeys({ store, bridge, overlay, save, widgetAt }) {
  /** Delete or Backspace with a link selected (overlay.js): that link removed. */
  function linkKey(e) {
    if (!['Delete', 'Backspace'].includes(e.key) || !ui.link) return;
    if (typing(e.target)) return;
    e.preventDefault();
    overlay.deleteLink();
  }

  /** The widget selection's keys (arrange clicks): arrows, Enter or a letter, Delete several. */
  function selectionKey(e) {
    if (e.defaultPrevented || previewClicks() !== 'arrange' || e.altKey || e.ctrlKey || e.metaKey)
      return;
    if (
      e.target.closest?.('input, textarea, select, [contenteditable], dialog, .wpop, [role="menu"]')
    )
      return;
    if (ARROWS[e.key] && selectedIds(ui).length) {
      const [x, y] = ARROWS[e.key];
      const n = nudgeStep(e.shiftKey);
      if (overlay.nudge(x * n, y * n)) e.preventDefault();
    } else if (
      (e.key === 'Enter' || (e.key.length === 1 && !'[]'.includes(e.key))) &&
      selectedIds(ui).length === 1 &&
      !e.target.closest?.('button, a, [role="button"]')
    ) {
      // a picked Text widget: Enter edits its text, a character typed starts typing at its end
      // (it went to the browser: F45, F54)
      const typed = e.key === 'Enter' || e.key === ' ' ? '' : e.key;
      if (bridge.editWidget(selectedIds(ui)[0], typed)) e.preventDefault();
    } else if (['Delete', 'Backspace'].includes(e.key) && ui.multi.length > 1 && !ui.link) {
      const found = widgetAt(ui.multi[0]);
      if (!found) return;
      e.preventDefault();
      const n = ui.multi.length;
      if (!removeWidgets(store, found.file, found.at, ui.multi)) return;
      selectWidgets([]);
      undoToast(store, `${n} widgets deleted`);
    }
  }

  /** Save, undo and redo, a widget's layer, Esc. */
  function appKey(e) {
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
      save();
    } else if (mod && k === 'e' && e.shiftKey) {
      e.preventDefault();
      location.href = bridge.path() || '/';
    } else if (mod && (k === 'z' || k === 'y') && !inField) {
      e.preventDefault();
      if (k === 'y' || e.shiftKey) store.redo();
      else store.undo();
    } else if ((e.key === '[' || e.key === ']') && !e.metaKey && (!e.ctrlKey || e.altKey)) {
      // a widget's layer: [ down, ] up (by character: AltGr / Ctrl+Alt on other layouts),
      // a widget picked in the Sections tab, not while typing, the desktop layout
      const inText =
        e.target instanceof Element &&
        e.target.closest?.('input, textarea, select, [contenteditable]');
      if (inText || previewClicks() !== 'arrange' || !ui.widget || ui.viewport === 'phone') return;
      const file = targetFile(ui.target, bridge.doc);
      const list = store.get(file, '/sections') || [];
      for (const [at, s] of list.entries()) {
        const j = (s?.widgets || []).findIndex((widget) => widget?.id === ui.widget);
        if (j < 0) continue;
        e.preventDefault();
        layerWidget(store, file, at, j, e.key === ']' ? 1 : -1);
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
        if (ui.picked) pickElement(null);
        if (previewClicks() === 'arrange' && !inField) {
          if (ui.link) selectLink(null);
          else if (ui.widget || ui.section || ui.multi.length || ui.selSection) deselect();
        }
        // an open Header or Footer stays open: Done is the way out
      }
    }
  }

  return function onKey(e) {
    linkKey(e);
    selectionKey(e);
    appKey(e);
  };
}
