/**
 * Items that open and close (feature 2): a template with "opens" shows each item's summary,
 * and its details below it once opened.
 *
 *   { "kind": "template", "link": false, "opens": { "several": false },
 *     "widgets": [ …summary…, { …, "details": true }, …details… ] }
 *
 * opens.several   false (default): opening one item closes the open one; true: each on its own
 * "details": true on one top-level widget: it and the widgets after it are the details (hidden
 *                 until opened), the ones before it the summary (always shown)
 * { "type": "toggle" }  the +/× icon (once, in the summary, often last in a Side by side)
 *
 * The summary is the item's button (role="button", tabindex 0, aria-expanded, aria-controls):
 * Enter / Space open and close it, Esc closes and gives the summary focus back. Items start
 * closed; "#<slug>" in the page URL opens that item. The details open with a height
 * transition (grid rows 0fr → 1fr): the summary and the item's width never move; the items
 * below follow. Reduced motion: no transition. Behaviour: ./client.js.
 *
 * Rules (validate.js): not with Link (the whole item is a button, not a link); one "details"
 * widget with a widget before and after it; one toggle, in the summary; no button in the
 * summary (a button in a button); "details" and toggles only with "opens"; not in an inner
 * List's template; Photo first doesn't apply.
 */
import { isObject } from '../../is.js';

/** Where the details start (the index of the "details": true widget), -1 when none. */
export const detailsAt = (widgets) =>
  (Array.isArray(widgets) ? widgets : []).findIndex((w) => w?.details === true);

/** The toggle's markup: two bars, a + that turns into × when open (CSS). */
export const toggleHtml = (role) =>
  `<div class="li__w li__toggle${role ? ` li__${role}` : ''}" aria-hidden="true"><i></i><i></i></div>`;

/** One item's summary and details. */
export function opensHtml(id, summary, details, open) {
  return (
    `<div class="li__text li__opens">` +
    `<div class="li__summary" id="${id}-s" role="button" tabindex="0" aria-expanded="${open}" aria-controls="${id}-d">${summary}</div>` +
    `<div class="li__details" id="${id}-d" role="region" aria-labelledby="${id}-s"${open ? '' : ' inert'}><div class="li__details-in">${details}</div></div>` +
    `</div>`
  );
}

const isToggle = (w) => w?.type === 'toggle';
const kidsOf = (w) => (w?.type === 'sideBySide' && Array.isArray(w.widgets) ? w.widgets : []);

/** Problems with a template's "opens", "details" and toggles ([] when fine). */
export function opensProblems(d) {
  const out = [];
  const ws = Array.isArray(d.widgets) ? d.widgets : [];
  const opens = d.opens !== undefined;
  if (opens) {
    if (!isObject(d.opens)) out.push('"opens" must be an object: { "several": false }');
    else
      for (const [k, v] of Object.entries(d.opens))
        if (k !== 'several') out.push(`opens.${k} is not an "opens" setting (several)`);
        else if (typeof v !== 'boolean') out.push('opens.several must be true or false');
    if (d.link !== false)
      out.push(
        'An item that opens can\'t also be a link: set "link": false (a button in its details can link)',
      );
  }
  const cuts = ws.flatMap((w, i) => (w?.details === true ? [i] : []));
  ws.forEach((w, i) => {
    if (w?.details !== undefined && w.details !== true)
      out.push(`widgets.${i}.details: true, or left out`);
    kidsOf(w).forEach((k, j) => {
      if (k?.details !== undefined)
        out.push(`widgets.${i}.widgets.${j}.details: the details start at a top-level widget`);
    });
  });
  const toggles = [];
  ws.forEach((w, i) => {
    if (isToggle(w)) toggles.push([`widgets.${i}`, i]);
    kidsOf(w).forEach((k, j) => isToggle(k) && toggles.push([`widgets.${i}.widgets.${j}`, i]));
  });
  if (!opens) {
    if (cuts.length)
      out.push(`widgets.${cuts[0]}.details: only in a template that opens ("opens")`);
    if (toggles.length)
      out.push(`${toggles[0][0]}: a toggle is only for a template that opens ("opens")`);
    return out;
  }
  if (cuts.length !== 1)
    out.push(
      cuts.length
        ? 'Details start at one widget only ("details": true once)'
        : 'An item that opens needs its details: "details": true on the widget they start at',
    );
  const cut = cuts[0];
  if (cuts.length === 1 && cut === 0)
    out.push(`widgets.${cut}.details: the summary needs a widget before the details`);
  if (toggles.length > 1) out.push('One toggle per template');
  for (const [at, top] of toggles)
    if (cut !== undefined && top >= cut)
      out.push(`${at}: the toggle goes in the summary, before the details`);
  ws.slice(0, cut ?? ws.length).forEach((w, i) => {
    if (w?.type === 'button')
      out.push(`widgets.${i}: no button in the summary (the summary is the item's button)`);
    kidsOf(w).forEach((k, j) => {
      if (k?.type === 'button')
        out.push(
          `widgets.${i}.widgets.${j}: no button in the summary (the summary is the item's button)`,
        );
    });
  });
  return out;
}
