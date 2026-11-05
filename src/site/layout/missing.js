/**
 * The hide rule (./parts.js) for one widget, in one place: the page grid's widgets
 * (./index.js renderWidget) and a List's item widgets (../widgets/list/index.js) both use it.
 * When every property part of a widget is empty it is left out of the published page (`skip`);
 * the editor keeps it, dimmed, with a hint naming the empty properties (`attr`, the
 * data-no-value attribute; its text is strings.js `widget.noValue`).
 */
import { esc, editable } from '../helpers.js';
import { t } from '../strings.js';
import { missingOf } from './bindings.js';

/**
 * A widget's missing state: { all, missing, skip, attr }. `hide: false` (a List's Show empty)
 * keeps it on the page, empty. `edit` defaults to the editor's preview (helpers.js editable).
 */
export function missingState(ctx, widget, def, scope, { hide = true, edit = editable } = {}) {
  const gone = missingOf(widget, def, scope);
  const names = gone.missing.map((n) => `{${n}}`).join(', ');
  return {
    ...gone,
    skip: gone.all && hide && !edit,
    attr: gone.all && edit ? ` data-no-value="${esc(t(ctx, 'widget.noValue', { names }))}"` : '',
  };
}
