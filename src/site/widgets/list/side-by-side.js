/**
 * Side by side (feature 1): a group in an item template whose widgets sit on one line.
 *
 *   { "type": "sideBySide", "role": "head",
 *     "config": { "align": "baseline", "spacing": 16, "phone": "wrap" },
 *     "widgets": [ { "type": "text", … }, { "type": "text", "grow": true, … }, … ] }
 *
 * config.align    top | center | bottom | baseline   (default center)
 * config.spacing  0 | 4 | 8 | 12 | 16 | 24 | 32 px   (default 16)
 * config.phone    wrap | stack | keep   at the List's one-column width: flow onto new lines,
 *                 one under another, or kept on one line (texts cut with …)   (default wrap)
 * a widget's "grow": true   it takes the space left (one per Side by side)
 * a photo's config.width    s | m | l: 64 | 96 | 160 px wide (else as wide as its share)
 *
 * Only in item templates, one level (no Side by side in one), 2–6 widgets: text, photo,
 * button or toggle (a List needs the whole width). Widths come from the content and a fixed gap: an item
 * never reflows on hover or as it loads.
 */
import { isObject } from '../../is.js';

export const SBS = {
  align: ['top', 'center', 'bottom', 'baseline'],
  spacing: [0, 4, 8, 12, 16, 24, 32],
  phone: ['wrap', 'stack', 'keep'],
};
export const SBS_DEFAULTS = { align: 'center', spacing: 16, phone: 'wrap' };
export const SBS_CHILDREN = ['text', 'photo', 'button', 'toggle'];
export const PHOTO_WIDTHS = { s: 64, m: 96, l: 160 };

const pick = (key, v) => (SBS[key].includes(v) ? v : SBS_DEFAULTS[key]);

/** A child's extra classes: grow, a photo's fixed width. */
export const childClass = (c) =>
  (c?.grow === true ? ' li__grow' : '') +
  (c?.type === 'photo' && PHOTO_WIDTHS[c.config?.width] ? ` li__pw li__pw--${c.config.width}` : '');

/** The group's markup around its children's. */
export function sideBySideHtml(w, kids) {
  const c = isObject(w.config) ? w.config : {};
  const role = w.role ? ` li__${w.role}` : '';
  return `<div class="li__w li__sbs li__sbs--${pick('align', c.align)} li__sbs--${pick('phone', c.phone)}${role}" style="--sbs-gap:${pick('spacing', c.spacing)}px">${kids.join('')}</div>`;
}

/** Problems with a Side by side at `at` ([] when fine); `checkChild(w, at)` checks each widget. */
export function sideBySideProblems(w, at, checkChild) {
  const out = [];
  const c = w.config;
  if (c !== undefined && !isObject(c))
    out.push(`${at}.config must be an object (align, spacing, phone)`);
  for (const [k, v] of Object.entries(isObject(c) ? c : {}))
    if (!SBS[k])
      out.push(`${at}.config.${k} is not a Side by side setting (align, spacing, phone)`);
    else if (!SBS[k].includes(v))
      out.push(
        `${at}.config.${k} must be one of ${SBS[k].map((x) => JSON.stringify(x)).join(', ')}`,
      );
  for (const k of Object.keys(w))
    if (!['type', 'role', 'config', 'widgets', 'details'].includes(k))
      out.push(`${at}: "${k}" is not a Side by side key (type, role, config, widgets)`);
  const kids = Array.isArray(w.widgets) ? w.widgets : null;
  if (!kids || kids.length < 2) out.push(`${at}: a Side by side needs at least two widgets`);
  else if (kids.length > 6) out.push(`${at}: a Side by side holds six widgets at most`);
  (kids || []).forEach((k, j) => {
    const here = `${at}.widgets.${j}`;
    if (!isObject(k)) return out.push(`${here} must be an object`);
    if (k.type === 'sideBySide')
      return out.push(`${here}: no Side by side inside a Side by side (one level)`);
    if (k.type === 'list')
      return out.push(`${here}: no List in a Side by side (a List needs the whole width)`);
    if (!SBS_CHILDREN.includes(k.type))
      return out.push(`${here}: a Side by side holds text, photo, button or toggle widgets`);
    if (k.grow !== undefined && k.grow !== true) out.push(`${here}.grow: true, or left out`);
    out.push(...checkChild(k, here));
  });
  if ((kids || []).filter((k) => k?.grow === true).length > 1)
    out.push(`${at}: only one widget in a Side by side can fill the space ("grow")`);
  return out;
}
