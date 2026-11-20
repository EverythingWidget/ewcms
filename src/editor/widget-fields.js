/**
 * What a widget's fields declare the editor can update in the preview itself (the widget
 * format, src/widgets/index.js): a setting's `blank: 'keep'` and `inPlace: { after }`, a
 * config entry's `inPlace: { on, var | class, when?, value? }`. The editor holds no widget's
 * name: it does what the field declares, else the widget renders again (layout-sync.js
 * patchTexts, preview-runtime.js patchText).
 */
import { widgetType } from '../widgets/index.js';
import { splitEdit } from '../render/helpers.js';

const WIDGET = /^\/sections\/(\d+)\/widgets\/(\d+)\/([^/]+)/;

/** A widget's setting (its first key: "title" of title, "fields" of fields/0/label), or undefined. */
export const settingOf = (widget, key) =>
  widgetType(widget?.type)?.settings?.find((f) => f?.key === key);

/** A widget's config entry, or undefined. */
export const configOf = (widget, key) =>
  widgetType(widget?.type)?.config?.find((c) => c?.key === key);

/**
 * The setting a [data-edit] reference ("pages/index.json#/sections/0/widgets/1/title") edits,
 * found through the store's widget, or undefined (not a widget's, or no such setting).
 */
export function settingAt(store, edit) {
  const { file, ptr } = splitEdit(String(edit || ''));
  const m = WIDGET.exec(ptr || '');
  if (!m) return undefined;
  const widget = store?.current?.[file]?.sections?.[Number(m[1])]?.widgets?.[Number(m[2])];
  return settingOf(widget, m[3]);
}

/**
 * The element(s) `on` names in the widget element `node`: its own, not a nested widget's or
 * list's (an element matching `on` inside another one).
 */
export function ownElements(node, on) {
  return [...node.querySelectorAll(on)].filter((el) => {
    const outer = el.parentElement?.closest(on);
    return !outer || !node.contains(outer);
  });
}

/**
 * A config value's `inPlace` declaration applied to the widget element `node` (config: the
 * widget's config now): a CSS variable set (removed for '', null or undefined) or a class
 * toggled (on when the value is `when`). A function to run, or null when it can't (no
 * `inPlace`, or not exactly one element).
 */
export function configStep(node, widget, key) {
  const inPlace = configOf(widget, key)?.inPlace;
  if (!inPlace?.on || (!inPlace.var && !inPlace.class)) return null;
  const els = ownElements(node, inPlace.on);
  if (els.length !== 1) return null;
  const config = widget.config || {};
  const value = inPlace.value ? inPlace.value(config) : config[key];
  const [el] = els;
  return () => {
    if (inPlace.var) {
      if (value === undefined || value === null || value === '')
        el.style.removeProperty(inPlace.var);
      else el.style.setProperty(inPlace.var, String(value));
    }
    if (inPlace.class) el.classList.toggle(inPlace.class, value === inPlace.when);
  };
}
