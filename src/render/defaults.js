/**
 * Defaults are never stored: a page file leaves out every value that equals its default.
 * DEFAULTS lists them; omitDefaults(file, data) strips them (the editor's save does this before
 * writing), storedDefaults(file, data) lists the ones still there (validation reports them).
 *
 *   section  enabled: true, width: "contained", height: "fit"
 *   widget    size: "auto", config.enabled: true; its list settings' items: the setting's
 *            itemDefaults (src/widgets/index.js; the Hero's photos[].layer: "back")
 *   backdrop the page's (src/render/backdrop.js BACKDROP_DEFAULTS); and the other transition's
 *            options, and a backdrop without photos, are left out too
 *
 * omitDefaults also tidies (not a validation error): no empty "config" or "meta", and a widget's
 * area without col 1, row 1 or a span to the last column (no "layout": full width at row 1).
 *
 * The animation library (animations.json animations) is not covered: each animation carries every
 * value it uses (there is no global layer to fall back on).
 */
import { THEME, docKindOf } from './files.js';
import { COLS } from './layout/grid.js';
import { tidyBackdrop } from './backdrop.js';
import { isObject } from './is.js';
import { eachWidget } from './layout/ids.js';
import { widgetType } from '../widgets/index.js';

export const DEFAULTS = {
  section: { enabled: true, width: 'contained', height: 'fit' },
  widget: { size: 'auto' },
  config: { enabled: true },
};

/** Every [object, defaults, where] of a page's data that can hold a default. */
function* places(data) {
  for (const [at, s] of (Array.isArray(data?.sections) ? data.sections : []).entries()) {
    if (!isObject(s)) continue;
    yield [s, DEFAULTS.section, `section ${at + 1}`];
    for (const [j, widget] of (Array.isArray(s.widgets) ? s.widgets : []).entries()) {
      if (!isObject(widget)) continue;
      const where = `section ${at + 1}, widget ${j + 1}`;
      yield [widget, DEFAULTS.widget, where];
      if (isObject(widget.config)) yield [widget.config, DEFAULTS.config, `${where} config`];
      // a list setting's items: the defaults its type declares (itemDefaults)
      for (const f of widgetType(widget.type)?.settings || []) {
        const d = f?.itemDefaults;
        if (!d || !Array.isArray(widget[f.key])) continue;
        for (const [i, p] of widget[f.key].entries())
          if (isObject(p)) yield [p, d.values, `${where} ${d.name} ${i + 1}`];
      }
    }
  }
}

const isEmpty = (v) => isObject(v) && !Object.keys(v).length;

/** Strip the DEFAULTS values from a page's `data` in place, calling found(where, message) for each. */
function strip(data, found) {
  tidyBackdrop(data, (message) => found('backdrop', message));
  for (const [obj, defs, where] of places(data))
    for (const [k, v] of Object.entries(defs))
      if (obj[k] === v) {
        found(where, `"${k}" is the default (${JSON.stringify(v)}): leave it out`);
        delete obj[k];
      }
}

/**
 * Tidy a page's `data` in place for saving (not a validation error: the editor's copy keeps
 * whole areas while it works): no empty "config" or "meta", and a widget's desktop area without
 * its defaults (col 1, row 1, a span that reaches the last column; placeOf fills them in), its
 * "layout" left out when nothing is left (full width at row 1).
 */
function tidy(data) {
  if (isEmpty(data.meta)) delete data.meta;
  for (const [widget] of eachWidget(data.sections)) {
    if (!isObject(widget)) continue;
    if (isEmpty(widget.config)) delete widget.config;
    const base = widget.layout?.base;
    if (!isObject(base)) continue;
    const col = Number.isInteger(base.col) ? base.col : 1;
    if (base.col === 1) delete base.col;
    if (base.row === 1) delete base.row;
    if (Number.isInteger(base.span) && col + base.span - 1 === COLS) delete base.span;
    if (isEmpty(base) && Object.keys(widget.layout).length === 1) delete widget.layout;
  }
}

/**
 * theme.json without what says nothing: an empty color, typography, layout or text style (all
 * unset is { "version": 1 }, the same as no file).
 */
function tidyTheme(data) {
  const copy = structuredClone(data);
  if (isObject(copy.typography))
    for (const [k, s] of Object.entries(copy.typography)) if (isEmpty(s)) delete copy.typography[k];
  for (const k of ['color', 'typography', 'layout']) if (isEmpty(copy[k])) delete copy[k];
  return copy;
}

/** A copy of a content file's data without its default values (page files and theme.json). */
export function omitDefaults(file, data) {
  if (file === THEME && isObject(data)) return tidyTheme(data);
  if (!docKindOf(file) || !isObject(data)) return data;
  const copy = structuredClone(data);
  strip(copy, () => {});
  tidy(copy);
  return copy;
}

/** Problems for values stored that equal their default: ["section 1: \"enabled\" is the default (true): leave it out"]. */
export function storedDefaults(file, data) {
  if (!docKindOf(file) || !isObject(data)) return [];
  const out = [];
  strip(structuredClone(data), (where, message) => out.push(`${where}: ${message}`));
  return out;
}
