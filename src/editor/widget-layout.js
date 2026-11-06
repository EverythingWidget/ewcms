/**
 * A widget's layout settings in the editor: its pop-up's tabs (Content | Layout, the last one
 * picked kept for every widget, browser-side), what its Layout tab shows (read from its type's
 * definition, never its type's name) and the changes both homes of a setting write: the Layout
 * tab (WidgetLayout.svelte) and its toolbar shortcut (WidgetToolbar.svelte) call these, so a
 * setting has one code path, one content key and one state.
 */
import { WIDGET_TYPES } from '../site/widgets/index.js';
import { placementOf } from '../site/layout/place.js';
import { hasScaleToFit } from '../site/layout/type.js';
import { baseOf } from '../site/layout/index.js';

/** The pop-up's tabs: every widget has both. */
export const WIDGET_TABS = [
  ['content', 'Content'],
  ['layout', 'Layout'],
];

/** Where the last tab picked is kept: ui.sections (editor:ui, the page tabs' store), one for all. */
export const WIDGET_TAB_KEY = 'widgettab';

/** The tab a pop-up opens on: the last one picked (unknown: Content). */
export function widgetTabOf(sections) {
  const v = sections?.[WIDGET_TAB_KEY];
  return WIDGET_TABS.some(([t]) => t === v) ? v : 'content';
}

/** A type's widget settings its definition puts in the Layout tab (config entries with `tab: 'layout'`). */
export function layoutOptions(type) {
  const def = typeof type === 'string' ? WIDGET_TYPES[type] : type;
  return (def?.config || []).filter((c) => c.tab === 'layout');
}

/**
 * When a value is missing (every widget's Content tab, GroupFields.svelte): Hide leaves the
 * widget out of the published page; Show empty keeps it. Default Hide (omitted from content).
 * A List's item widgets inherit the List's choice unless they set their own
 * (../site/layout/missing.js).
 */
export const MISSING_OPTIONS = [
  ['hide', 'Hide'],
  ['show', 'Show empty'],
];

/**
 * What a type's Layout tab shows, in order: 'options' (its widget settings with `tab:
 * 'layout'`, a List's arrangement, columns and gap), 'size' (Auto / Rows / Aspect, unless its
 * definition says `size: false`), 'layer', 'link' (what it follows), 'box' (its content box),
 * 'placement', 'scale' (Scale to fit): from its definition. (When a value is missing lives on
 * the Content tab.)
 */
export function layoutParts(type) {
  const def = typeof type === 'string' ? WIDGET_TYPES[type] : type;
  const p = placementOf(def);
  return [
    ...(layoutOptions(def).length ? ['options'] : []),
    ...(def?.size === false ? [] : ['size']),
    'layer',
    'link',
    ...(p?.box ? ['box'] : []),
    ...(p ? ['placement'] : []),
    ...(hasScaleToFit(def) ? ['scale'] : []),
  ];
}

/** The content box's labels: a photo's Contain / Cover (media), else Fit / Fill (saved: fit | fill). */
export function boxLabels(placement) {
  return placement?.media
    ? [
        ['fit', 'Contain', 'Contain: the whole photo shows in the widget'],
        ['fill', 'Cover', 'Cover: the photo covers the whole widget (its edges cropped)'],
      ]
    : [
        ['fit', 'Fit', 'Fit: as big as its content'],
        ['fill', 'Fill', 'Fill: over the whole widget'],
      ];
}

/**
 * The rows a widget shows now in the preview (`doc`), so a size it is given keeps its height;
 * the phone's rows are half the desktop's (its cells twice as big): sizes write desktop rows.
 */
export function shownRows(doc, id, widget, phone, fallback) {
  const el = doc?.querySelector(`[data-widget="${CSS.escape(id)}"]`);
  const n = parseInt(el?.style.getPropertyValue('--frs') ?? '', 10);
  if (Number.isInteger(n) && n > 0) return phone ? n * 2 : n;
  return baseOf(widget).rows || fallback;
}

/** Size (Auto | Rows | Aspect): the change to `next`; `rows` its rows now, `ratio` Aspect's. */
export function sizePatch(next, { rows, ratio }) {
  return {
    size: next === 'auto' ? undefined : next,
    aspect: next === 'aspect' ? ratio : undefined,
    rows: next === 'auto' ? undefined : rows,
  };
}

/** Auto height on or off (the toolbar's shortcut): Auto, or Rows at the rows it shows now. */
export const autoPatch = (on, rows) => sizePatch(on ? 'auto' : 'rows', { rows });

/** Scale to fit on or off. */
export const scalePatch = (on) => ({ scale: on ? true : undefined });

/** Scale to fit's hint (two lines' room in the tab). */
export const scaleHint = (on) =>
  on
    ? 'On: the whole text scales down to fit the widget.'
    : 'Off: each style keeps its own size at any width.';
