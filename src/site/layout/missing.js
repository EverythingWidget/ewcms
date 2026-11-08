/**
 * The hide rule (./parts.js) for one widget, in one place: the page grid's widgets
 * (./index.js renderWidget) and a List's item widgets (../widgets/list/index.js) both use it.
 * When every property part of a widget is empty it is left out of the published page (`skip`)
 * when Hide; Show empty keeps it. The editor keeps it either way, dimmed, with a hint naming
 * the empty properties and a tag (Hidden / Empty on the page): strings.js `widget.*`.
 *
 * `config.missing` on the widget: "hide" (default) | "show". A List's item widgets inherit the
 * List's choice unless they set their own (hideMissing).
 *
 * Hide also leaves a widget out when (feature 3):
 *   - one of `config.needs` (property names: "Also needs") is empty: a fixed "Placeholder" tag
 *     with needs ["placeholder"] shows only on the items that are placeholders;
 *   - a button's link or its label comes out empty (never an empty button, or one to "/").
 * For hiding, false is empty too (a boolean property that is off).
 */
import { esc, editable } from '../helpers.js';
import { t } from '../strings.js';
import { propertyPartsOf } from './bindings.js';
import { isPropertyPart, partEmpty, propertyValue, scopeFor } from './parts.js';
import { isObject } from '../is.js';

/** True when a missing value is left out (Hide); false for Show empty. Default Hide. */
export const hideMissing = (config) => config?.missing !== 'show';

/**
 * A widget's missing state: { all, missing, skip, attr }. `hide: false` (Show empty) keeps it
 * on the page, empty. `edit` defaults to the editor's preview (helpers.js editable).
 */
/** Empty for hiding: missing, null, '' or false. */
const emptyPart = (part, scope) =>
  partEmpty(part, scope) || propertyValue(part.property, scopeFor(part, scope)) === false;

/** A button's value at `v` (its label or link) comes out empty: '' or parts that are all empty. */
const comesOutEmpty = (v, scope) =>
  typeof v === 'string'
    ? !v.trim()
    : Array.isArray(v) &&
      v.length > 0 &&
      v.every((p) => (isPropertyPart(p) ? emptyPart(p, scope) : !String(p?.t ?? '').trim()));

/** The widget's "Also needs" (config.needs): its property names. */
export const needsOf = (widget) =>
  Array.isArray(widget?.config?.needs)
    ? widget.config.needs.filter((k) => typeof k === 'string' && k)
    : [];

/** Is the widget gone for this scope: { parts, all, missing, needs }. */
export function goneOf(widget, def, scope) {
  const uses = propertyPartsOf(widget, def);
  const missing = [
    ...new Set(uses.filter((u) => emptyPart(u.part, scope)).map((u) => u.part.property)),
  ];
  let all = uses.length > 0 && uses.every((u) => emptyPart(u.part, scope));
  // a button: an empty link or label is enough
  if (widget?.type === 'button') {
    const link = isObject(widget.config) ? widget.config.link : undefined;
    if (Array.isArray(link) && comesOutEmpty(link, scope)) all = true;
    if (Array.isArray(widget.label) && comesOutEmpty(widget.label, scope)) all = true;
  }
  const needs = needsOf(widget).filter((k) => emptyPart({ property: k }, scope));
  return {
    parts: uses.length,
    all: all || needs.length > 0,
    missing: [...missing, ...needs],
    needs,
  };
}

export function missingState(ctx, widget, def, scope, { hide = true, edit = editable } = {}) {
  const gone = goneOf(widget, def, scope);
  if (!gone.all) return { ...gone, skip: false, attr: '' };
  const own = gone.missing.filter((n) => !gone.needs.includes(n));
  const names = gone.missing.map((n) => `{${n}}`).join(', ');
  const hint = own.length ? t(ctx, 'widget.noValue', { names }) : t(ctx, 'widget.needs', { names });
  const tag = hide ? t(ctx, 'widget.hidden') : t(ctx, 'widget.empty');
  return {
    ...gone,
    skip: hide && !edit,
    attr: edit ? ` data-no-value="${esc(hint)}" data-missing-tag="${esc(tag)}"` : '',
  };
}
