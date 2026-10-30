import { popupStays } from '../multi-select.js';
/**
 * Where the editor is, in three names (no others):
 *
 *   ui.panel      what the side panel shows, its top tab:
 *                   'nav'       the pages list, or the page open with its page tabs
 *                   'settings'  what is the same on every page
 *                   'preview'   the toolbar's Preview toggle: the unsaved and unpublished changes
 *   ui.pageTab    the open page's tab, under Nav: 'sections' | 'motion' | 'seo'; null when no
 *                 page is open (the pages list, the Header or Footer). Kept per page in
 *                 ui.sections["pagetab:<file>"] (ContentPanel.svelte).
 *   previewClicks()  what a click in the preview does, from the two above:
 *                   'arrange'   pick and move widgets, double click to type (Nav, not on Motion)
 *                   'animate'   pick a widget or an animated element (a page's Motion tab)
 *                   'visitor'   links work, nothing is picked (Settings, Preview)
 *
 * Editor UI state. main.js changes it, the Svelte shell (App.svelte) shows it: it is a
 * $state object, so a change re-renders whatever uses that field.
 */
export const ui = $state({
  /** Why the content could not be loaded; App shows it instead of the editor. */
  loadError: '',
  /** What the side panel shows: see "Where the editor is" above. */
  panel: 'nav',
  /** The panel Preview (and Ctrl+E) goes back to: 'nav' | 'settings'. */
  panelBeforePreview: 'nav',
  /** The open page's tab, or null when no page is open (the pages list, Header, Footer). */
  pageTab: null,
  /** 'desktop' | 'mobile' preview size */
  viewport: 'desktop',
  saving: false,
  publishing: false,
  /** Last /__editor/status: saved files not published yet ({ files, ahead, branch, ... }). */
  pub: null,
  /** Footer status line, e.g. "Saved 2 files · 12:40:03". */
  status: '',
  /**
   * Page menu items: the site parts (Header, Footer), then every page. A [param] template is
   * one item with `template` (its page id) and `items` ([{ path, title }], its pages).
   */
  pages: [],
  /**
   * The page each [param] page previews ({ "people/[person]": "/people/noor-vermeer/" }): the
   * one shown last, picked again when the page is opened (else its first). Editor state only:
   * never saved to content.
   */
  previewAt: {},
  /**
   * A param row of a widget's From URL to bring into view and focus ({ widget, param }; the page
   * head's warning sets it, WidgetSource.svelte takes it), or null.
   */
  focusParam: null,
  /** The path shown in the preview ("/people/noor-vermeer/"). */
  path: '/',
  /** What the Nav tab edits: a page { kind: 'page', path, title } or a site part { kind: 'part', id: 'header' | 'footer', title }. */
  target: { kind: 'page', path: '/', title: 'Home' },
  /** Bumped when the preview shows a (new) page: the Nav tab re-reads its texts. */
  previewVersion: 0,
  /**
   * The text picked in the preview or in a field: { edit } (its data-edit), or null.
   * A new object on every pick, so picking the same text again scrolls to it again.
   */
  selection: null,
  /**
   * The section the pointer is over, { id, from: 'panel' | 'preview' }, or null: the other
   * side shows it faintly (a section row in the Sections tab, the section in the preview).
   */
  peek: null,
  /** A custom section's rows while its bottom edge is dragged in the preview: { id, rows } (overlay.js). */
  secRows: null,
  /**
   * The animated element picked in the Motion tab: { el, id, key, scope }, or null.
   * scope: where its edits go: 'element' | 'target' (see motion.js).
   */
  anim: null,
  /** Sections tab: the widget open in the widget inspector (its id), or null, and its tab. */
  widget: null,
  /** The selected widget's pop-up shown (a double click opens it; a single click only selects). */
  popup: false,
  /**
   * A widget hovered: { id, from: 'panel' | 'preview' } (its row hovered: its outline in the
   * preview; it hovered in the preview: its row lit), or null.
   */
  hot: null,
  /**
   * Sections tab: two or more widgets selected together (their ids, all of one section; none
   * first or main: multi-select.js), else []. One selected is ui.widget.
   */
  multi: [],
  /** The widget clicked last (Shift+click in a card's list selects from it to the one clicked). */
  anchor: null,
  /** Ctrl (Cmd) is held: with a selection, the other sections' widgets are not clickable. */
  mod: false,
  /**
   * Sections tab: the section card selected (its id; a click on it), or null: its section shows
   * in the preview as a hovered one does (overlay.js) while the list shows.
   */
  selSection: null,
  /**
   * Sections tab: two or more section cards selected (Ctrl/Cmd or Shift click), their ids in page
   * order, [] otherwise. Sections or widgets, never both: selecting one kind clears the other.
   */
  selSections: [],
  /** Sections tab: the section whose settings pop-up is open (SectionPopup.svelte; its id), or null. */
  section: null,
  /**
   * A Text widget edited in place in the preview (bridge.js richState): { widget, edit, style,
   * line, selected, bold, italic, link }, or null.
   */
  rich: null,
  /** Sections tab: the link selected in the preview (its follower's widget id), or null. */
  link: null,
  /**
   * The element picked in the preview (its outline there): { el, kind: 'text' | 'anim' }, or
   * null. bridge.js reports clicks and draws the outline; pickElement() sets it.
   */
  picked: null,
  /** The element under the pointer in the preview (animate clicks) or a Motion row's, or null. */
  hoverEl: null,
  /** Open/closed per Section key ("text:hero", "settings:site", ...), once toggled. */
  sections: {},
  /**
   * The Source Explorer: open or not, its file ('' = the list of files), item index and the
   * highlighted field (its key in source-items.js itemFields, e.g. "name", "photos.1").
   */
  explorer: { open: false, file: '', index: 0, field: '' },
  /**
   * The Media window: open or not, the selected photo (media/ path or R2 key), the list filter
   * ('all' | 'r2' | 'local') and the field it picks for (its data-edit, '' = just managing).
   */
  media: { open: false, key: '', filter: 'all', pick: '' },
  /** The pages list (Nav tab): open or not, and the folder it shows ('' = content/en/pages/ itself). */
  pagesWin: { open: false, folder: '' },
  /** Settings > Motion, the Animations library: the animation open ('' = the list). */
  library: { name: '' },
});

/** What a click in the preview does now: 'arrange' | 'animate' | 'visitor' (see above). */
export function previewClicks() {
  if (ui.panel !== 'nav') return 'visitor';
  return ui.pageTab === 'motion' ? 'animate' : 'arrange';
}

/**
 * The Sections tab's widget selection set to `ids` (all of one section): none, one (ui.widget:
 * its pop-up and handles) or several (ui.multi: the shared actions only, the pop-up closed).
 */
export function selectWidgets(ids) {
  const list = ids.filter((id, i) => id && ids.indexOf(id) === i);
  const one = list.length === 1 ? list[0] : null;
  if (ui.widget !== one) ui.selection = null;
  if (!popupStays(list.length)) ui.popup = false;
  ui.multi = list.length > 1 ? list : [];
  ui.widget = one;
  ui.section = null;
  ui.selSection = null;
  ui.selSections = [];
}

/**
 * Section `id` selected (its card, its toolbar; the preview's section outline). One thing is
 * selected at a time: any widget selection goes, its pop-up closes.
 */
export function selectSection(id) {
  ui.popup = false;
  ui.selection = null;
  ui.multi = [];
  ui.widget = null;
  ui.section = null;
  ui.selSection = id;
  ui.selSections = [];
}

/**
 * Sections `ids` selected (in page order): one is selectSection's; several: ui.selSections, the
 * last clicked (`last`) staying ui.selSection (the anchor of a Shift click). No widgets.
 */
export function selectSections(ids, last = ids.at(-1) ?? null) {
  const list = ids.filter((id, i) => id && ids.indexOf(id) === i);
  if (list.length < 2) return selectSection(list[0] ?? null);
  selectSection(list.includes(last) ? last : list.at(-1));
  ui.selSections = list;
}

/**
 * A pick in the preview's Motion tab: a widget ({ el, widget }) or a data-anim element
 * ({ el, id, key, owner, scope }). The widget (or the element's) is also the Sections tab's widget
 * (ui.widget), so both tabs show the same one.
 */
export function pickAnim(sel) {
  if (sel?.kind !== 'anim') return null;
  const { el } = sel;
  const owner = el.closest('[data-widget]')?.dataset.widget;
  if (owner) ui.widget = owner;
  if (el.dataset.anim === undefined)
    return el.dataset.widget ? { el, widget: el.dataset.widget } : null;
  // scope: where edits go, set by AnimEditor (its widget's elements if they have values, else All)
  return { el, id: el.dataset.anim, key: el.dataset.animKey, owner, scope: null };
}

/**
 * Element `el` of the preview picked (null: none): with animate clicks it is ui.anim, else a
 * text's ui.selection ({ edit }). quiet: put back (a reload, a refresh), not picked: the panel
 * opens nothing for it.
 */
export function pickElement(
  el,
  kind = previewClicks() === 'arrange' ? 'text' : 'anim',
  { quiet = false } = {},
) {
  ui.picked = el ? { el, kind } : null;
  if (previewClicks() === 'animate') ui.anim = pickAnim(ui.picked);
  else
    ui.selection =
      el && kind === 'text'
        ? { edit: el.dataset.edit ?? el.dataset.bound, ...(quiet && { quiet }) }
        : null;
}

/** A text's field focused (its `data-edit` path): the panel shows that field. */
export function selectText(edit, { quiet = false } = {}) {
  ui.selection = { edit, ...(quiet && { quiet }) };
}

/** The element under the pointer in the preview (or a Motion row's), or null. */
export function hoverElement(el) {
  if (ui.hoverEl !== el) ui.hoverEl = el || null;
}

/** Nothing picked or hovered in the preview (what a click does changed). */
export function clearPick() {
  pickElement(null);
  hoverElement(null);
}

/**
 * Nothing selected: no widget, section or link, no text or element picked (the site part
 * shown changed).
 */
export function clearSelection() {
  ui.widget = null;
  ui.section = null;
  ui.selSection = null;
  ui.selSections = [];
  ui.selection = null;
  ui.link = null;
  if (ui.picked) pickElement(null);
}

/**
 * Nothing selected in the panel (Esc): no widget or widgets, section, link or text field. The
 * preview's pick is the caller's (Esc drops it first); the Shift-click anchor stays.
 */
export function deselect() {
  ui.selection = null;
  ui.widget = null;
  ui.multi = [];
  ui.section = null;
  ui.selSection = null;
  ui.selSections = [];
  ui.link = null;
}

/** Section `id` under the pointer on one side (`from`: 'panel' | 'preview'); null: none there. */
export function peekSection(id, from) {
  if (id) {
    if (ui.peek?.id !== id || ui.peek.from !== from) ui.peek = { id, from };
  } else if (ui.peek?.from === from) ui.peek = null;
}

/** Widget `id` hovered on one side (`from`: 'panel' | 'preview'); null: none there. */
export function hotWidget(id, from) {
  if (id) {
    if (ui.hot?.id !== id || ui.hot.from !== from) ui.hot = { id, from };
  } else if (ui.hot?.from === from) ui.hot = null;
}

/** The link selected in the preview (its follower's widget id), or null. */
export function selectLink(id) {
  ui.link = id;
}

/** The widget clicked last (a Shift click selects from it). */
export function setAnchor(id) {
  ui.anchor = id;
}

/** A custom section's rows while its bottom edge is dragged ({ id, rows, phone }), or null. */
export function setSecRows(rows) {
  ui.secRows = rows;
}

/** Ctrl (Cmd) held or not. */
export function setMod(on) {
  if (ui.mod !== on) ui.mod = on;
}

/** Set by main.js: the preview's (overlay.js reveal). */
// settled(): the preview shows the latest edits (pending section renders swapped in, rows
// flowed): main.js
export const hooks = { reveal: () => {}, settled: async () => {} };
/** A widget scrolled to in the preview, only when it is out of view. */
export const reveal = (id) => hooks.reveal(id);
