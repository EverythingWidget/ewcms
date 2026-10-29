import { popupStays } from '../multi-select.js';
/**
 * Editor UI state. main.js changes it, the Svelte shell (App.svelte) shows it: it is a
 * $state object, so a change re-renders whatever uses that field.
 */
export const ui = $state({
  /** Why the content could not be loaded; App shows it instead of the editor. */
  loadError: '',
  /** 'text' (the Content tab) | 'motion' | 'settings' | 'preview' (the toolbar's Preview: the site as visitors see it) */
  mode: 'text',
  /** The tab Preview (and Ctrl+E) goes back to. */
  lastEdit: 'text',
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
  /** What the Content tab edits: a page { kind: 'page', path, title } or a site part { kind: 'part', id: 'header' | 'footer', title }. */
  target: { kind: 'page', path: '/', title: 'Home' },
  /** Bumped when the preview shows a (new) page: the Content tab re-reads its texts. */
  previewVersion: 0,
  /**
   * The text picked in the preview or in a field: { edit } (its data-edit), or null.
   * A new object on every pick, so picking the same text again scrolls to it again.
   */
  selection: null,
  /**
   * The section the pointer is over, { id, from: 'panel' | 'preview' }, or null: the other
   * side shows it faintly (a section row in the Content tab, the section in the preview).
   */
  peek: null,
  /** A custom section's rows while its bottom edge is dragged in the preview: { id, rows } (overlay.js). */
  secRows: null,
  /**
   * The animated element picked in the Motion tab: { el, id, key, scope }, or null.
   * scope: where its edits go: 'element' | 'target' (see motion.js).
   */
  anim: null,
  /** Content tab: the widget open in the widget inspector (its id), or null, and its tab. */
  widget: null,
  /** The selected widget's pop-up shown (a double click opens it; a single click only selects). */
  popup: false,
  /**
   * A widget hovered: { id, from: 'panel' | 'preview' } (its row hovered: its outline in the
   * preview; it hovered in the preview: its row lit), or null.
   */
  hot: null,
  /**
   * Content tab: two or more widgets selected together (their ids, all of one section; none
   * first or main: multi-select.js), else []. One selected is ui.widget.
   */
  multi: [],
  /** The widget clicked last (Shift+click in a card's list selects from it to the one clicked). */
  anchor: null,
  /** Ctrl (Cmd) is held: with a selection, the other sections' widgets are not clickable. */
  mod: false,
  /**
   * Content tab: the section card selected (its id; a click on it), or null: its section shows
   * in the preview as a hovered one does (overlay.js) while the list shows.
   */
  selSection: null,
  /**
   * Content tab: two or more section cards selected (Ctrl/Cmd or Shift click), their ids in page
   * order, [] otherwise. Sections or widgets, never both: selecting one kind clears the other.
   */
  selSections: [],
  /** Content tab: the section whose settings pop-up is open (SectionPopup.svelte; its id), or null. */
  section: null,
  /** 'content' | 'motion' (its layout: on its card, WidgetLayout.svelte) */
  widgetTab: 'content',
  /**
   * A Text widget edited in place in the preview (bridge.js richState): { widget, edit, style,
   * line, selected, bold, italic, link }, or null.
   */
  rich: null,
  /** Content tab: the link selected in the preview (its follower's widget id), or null. */
  link: null,
  /** Open/closed per Section key ("text:hero", "settings:site", ...), once toggled. */
  sections: {},
  /**
   * The Source Explorer: open or not, its file ('' = the list of files), item index and the
   * highlighted field (its key in source-items.js itemFields, e.g. "name", "images.1").
   */
  explorer: { open: false, file: '', index: 0, field: '' },
  /**
   * The Media window: open or not, the selected photo (media/ path or R2 key), the list filter
   * ('all' | 'r2' | 'local') and the field it picks for (its data-edit, '' = just managing).
   */
  media: { open: false, key: '', filter: 'all', pick: '' },
  /** The pages list (Content tab): open or not, and the folder it shows ('' = content/en/pages/ itself). */
  pagesWin: { open: false, folder: '' },
  /** Motion tab: the Animations sub-tab (open) or Elements, and its animation ('' = the list). */
  library: { open: false, name: '' },
});

/**
 * The Content tab's widget selection set to `ids` (all of one section): none, one (ui.widget:
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

/** Set by main.js: the preview's (overlay.js reveal). */
// settled(): the preview shows the latest edits (pending section renders swapped in, rows
// flowed): main.js
export const hooks = { reveal: () => {}, settled: async () => {} };
/** A widget scrolled to in the preview, only when it is out of view. */
export const reveal = (id) => hooks.reveal(id);
