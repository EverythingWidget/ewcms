/**
 * Summary and details (the "details" widget): an item that opens. The item's own template is
 * its summary (always shown); the "details" widget sits on it where its +/× goes, and names the
 * template of the details shown below once opened.
 *
 *   { "id": "w-open", "type": "details", "layout": { "base": { "col": 116, "span": 5, "row": 1 } },
 *     "config": { "template": "t-pmor", "several": false, "icon": "plus",
 *                 "screenReaderName": [{ "property": "title" }], "open": "none" } }
 *
 * config.template          the details' template ("t-…"): its widgets on a grid of their own,
 *                          filled from the same item
 * config.several           false (default): opening one item closes the open one; true: each
 *                          on its own
 * config.icon              "plus" (default): the +/× at the widget's place; "none": no icon
 * config.screenReaderName  what a screen reader calls the summary (parts; default: what it shows)
 * config.open              "none" (default): items start closed; "first": the first starts open
 *
 * The summary is the item's button (role="button", tabindex 0, aria-expanded, aria-controls):
 * Enter / Space open and close it, Esc closes and gives the summary focus back; "#<slug>" in
 * the page URL opens that item. The details open with a height transition (grid rows
 * 0fr → 1fr): the summary and the item's width never move; the items below follow. Reduced
 * motion: no transition. Behaviour: ./client.js.
 *
 * Rules (validate.js, layout/bindings.js): one per template; the template is not a link
 * ("clickable": false); no button in the summary (a button in a button); the details' template
 * exists and holds no "details" of its own; not in an inner List's template.
 */
import { isObject } from '../../is.js';
import { isTemplateId } from '../../files.js';
import { itemWidgets } from './item-grid.js';

export const DETAILS_KEYS = ['template', 'several', 'icon', 'screenReaderName', 'open'];
export const ICONS = ['plus', 'none'];
export const OPENS = ['none', 'first'];

/** The template's "details" widget, or null. */
export const detailsOf = (tpl) => itemWidgets(tpl).find((w) => w?.type === 'details') || null;

/** The +/× markup: two bars, a + that turns into × when open (CSS); '' for icon "none". */
export const toggleHtml = (w) =>
  w?.config?.icon === 'none'
    ? ''
    : `<div class="li__w li__toggle" aria-hidden="true"><i></i><i></i></div>`;

/** A screen reader name's text from the item ("" when none). */
export function nameOf(parts, item) {
  if (typeof parts === 'string') return parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) =>
      typeof p === 'string'
        ? p
        : typeof p?.text === 'string'
          ? p.text
          : p?.property && item?.[p.property] != null
            ? String(item[p.property])
            : '',
    )
    .join('')
    .trim();
}

/** One item's summary and details. */
export function opensHtml(id, summary, details, open, name = '') {
  const label = name
    ? ` aria-label="${name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`
    : '';
  return (
    `<div class="li__text li__opens">` +
    `<div class="li__summary" id="${id}-s" role="button" tabindex="0" aria-expanded="${open}" aria-controls="${id}-d"${label}>${summary}</div>` +
    `<div class="li__details" id="${id}-d" role="region" aria-labelledby="${id}-s"${open ? '' : ' inert'}><div class="li__details-in">${details}</div></div>` +
    `</div>`
  );
}

const isParts = (v) => Array.isArray(v) && v.every((p) => typeof p === 'string' || isObject(p));

/** A "details" widget's own problems (its config), at `at`. */
export function detailsWidgetProblems(w, at) {
  const out = [];
  const c = w.config;
  if (!isObject(c)) return [`${at}.config must be an object: { "template": "t-…" }`];
  for (const k of Object.keys(c))
    if (!DETAILS_KEYS.includes(k))
      out.push(
        `${at}.config.${k} is not a Summary and details setting (${DETAILS_KEYS.join(', ')})`,
      );
  if (!isTemplateId(c.template))
    out.push(`${at}.config.template must be the details' template id ("t-…")`);
  if (c.several !== undefined && typeof c.several !== 'boolean')
    out.push(`${at}.config.several must be true or false`);
  if (c.icon !== undefined && !ICONS.includes(c.icon))
    out.push(`${at}.config.icon must be ${ICONS.join(' or ')}`);
  if (c.open !== undefined && !OPENS.includes(c.open))
    out.push(`${at}.config.open must be ${OPENS.join(' or ')}`);
  if (
    c.screenReaderName !== undefined &&
    typeof c.screenReaderName !== 'string' &&
    !isParts(c.screenReaderName)
  )
    out.push(`${at}.config.screenReaderName must be a text or parts ([{ "property": "title" }])`);
  if (c.label !== undefined) out.push(`${at}.config.label is "screenReaderName"`);
  return out;
}

/** Problems of one template with a "details" widget ([] when fine). */
export function detailsProblems(d) {
  const out = [];
  const ws = itemWidgets(d);
  const at = ws.flatMap((w, i) => (w?.type === 'details' ? [i] : []));
  if (!at.length) return out;
  if (at.length > 1) out.push('One "details" widget per template');
  if (d.clickable !== false)
    out.push(
      'An item with Summary and details can\'t also be a link: set "clickable": false (a button in its details can link)',
    );
  ws.forEach((w, i) => {
    if (w?.type === 'button')
      out.push(
        `sections.0.widgets.${i}: no button in the summary (the summary is the item's button)`,
      );
  });
  return out;
}

const hasParts = (v) =>
  Array.isArray(v)
    ? v.some((x) => (x && typeof x === 'object' && typeof x.property === 'string') || hasParts(x))
    : isObject(v)
      ? Object.values(v).some(hasParts)
      : false;

/** Can Hide leave this summary widget out (it binds a property, or needs one)? */
const canHide = (w) =>
  !(w?.type === 'details' && w.config?.icon !== 'none') &&
  w?.config?.missing !== 'show' &&
  (w?.type === 'details' ||
    hasParts(w) ||
    (Array.isArray(w?.config?.needs) && w.config.needs.length > 0));

/**
 * Across the templates ({ level, message }): each details' template exists and holds no
 * "details"; a warning when every summary widget can be hidden (nothing to click).
 */
export function detailsWarnings(templates = {}) {
  const out = [];
  for (const [id, tpl] of Object.entries(templates || {})) {
    const dw = detailsOf(tpl);
    if (!dw || !isTemplateId(dw.config?.template)) continue;
    if (itemWidgets(tpl).every(canHide))
      out.push({
        level: 'warning',
        message: `templates/${id}.json: Its summary can be empty: an item could have nothing to click (every summary widget can be hidden; the +/× icon, or a widget set to Show empty, keeps it)`,
      });
    const inner = templates[dw.config.template];
    if (!inner)
      out.push({
        level: 'error',
        message: `templates/${id}.json: its details' template "${dw.config.template}" is missing (content/templates/${dw.config.template}.json)`,
      });
    else if (detailsOf(inner))
      out.push({
        level: 'error',
        message: `templates/${id}.json: its details' template "${dw.config.template}" has Summary and details of its own (one level only)`,
      });
  }
  return out;
}
