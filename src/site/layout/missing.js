/**
 * The hide rule (./parts.js) for one widget, in one place: the page grid's widgets
 * (./index.js renderWidget) and a List's item widgets (../widgets/list/index.js) both use it.
 * When every property part of a widget is empty it is left out of the published page (`skip`)
 * when Hide; Show empty keeps it. The editor keeps it either way, dimmed, with a hint naming
 * the empty properties and a tag (Hidden / Empty on the page): strings.js `widget.*`.
 *
 * `config.missing` on the widget: "hide" (default) | "show". A List's item widgets inherit the
 * List's choice unless they set their own (hideMissing).
 */
import { esc, editable } from '../helpers.js';
import { t } from '../strings.js';
import { missingOf } from './bindings.js';

/** True when a missing value is left out (Hide); false for Show empty. Default Hide. */
export const hideMissing = (config) => config?.missing !== 'show';

/**
 * A widget's missing state: { all, missing, skip, attr }. `hide: false` (Show empty) keeps it
 * on the page, empty. `edit` defaults to the editor's preview (helpers.js editable).
 */
export function missingState(ctx, widget, def, scope, { hide = true, edit = editable } = {}) {
  const gone = missingOf(widget, def, scope);
  if (!gone.all) return { ...gone, skip: false, attr: '' };
  const names = gone.missing.map((n) => `{${n}}`).join(', ');
  const tag = hide ? t(ctx, 'widget.hidden') : t(ctx, 'widget.empty');
  return {
    ...gone,
    skip: hide && !edit,
    attr: edit
      ? ` data-no-value="${esc(t(ctx, 'widget.noValue', { names }))}" data-missing-tag="${esc(tag)}"`
      : '',
  };
}
