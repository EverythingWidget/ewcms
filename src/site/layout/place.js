/**
 * Content-box placement: every widget is a container (its grid area) with a content box (what it
 * renders). A widget type opts in with `placement` (src/site/widgets/index.js):
 *
 *   placement: { axes: 'both' | 'v' | 'h', box: true | false, fill: false, place: 'left top' }
 *     axes   the grid of places the editor offers: 3 x 3 ('both'), one column ('v': top / middle
 *            / bottom; its content is always full width) or one row ('h')
 *     box    whether it has the Fit | Fill switch (a Text widget: no)
 *     fill   its default box (true: Fill), place its default place
 *     media  its content is a photo or video: Fit is `object-fit: contain`, Fill `cover`, the
 *            place its object-position (cropped, Fill still places it)
 *
 * Stored on the widget, layout keys beside `size` (never a field key):
 *   box    'fit' | 'fill' (left out: the type's default)
 *            fit: the content box sizes to its content, placed in the widget
 *            fill: rows: fills the widget's width and height; auto: its full width;
 *                  aspect: stretches to the ratio box
 *   place  'left top' … 'right bottom' (PLACES; 'center' for the middle), or for axes 'v'
 *          'top' | 'center' | 'bottom', 'h' 'left' | 'center' | 'right' (left out: the type's)
 *
 * Rendered as classes and variables of the widget's element (./index.js widgetClass /
 * widgetVars; src/client/styles/_layout.scss .wgt--placed).
 */
import { WIDGET_TYPES } from '../widgets/index.js';

/** The 3 x 3 places, row by row: [value, label]. */
export const PLACES = [
  ['left top', 'Top left'],
  ['center top', 'Top'],
  ['right top', 'Top right'],
  ['left center', 'Left'],
  ['center', 'Center'],
  ['right center', 'Right'],
  ['left bottom', 'Bottom left'],
  ['center bottom', 'Bottom'],
  ['right bottom', 'Bottom right'],
];
/** One column (axes 'v') and one row ('h'). */
export const V_PLACES = [
  ['top', 'Top'],
  ['center', 'Middle'],
  ['bottom', 'Bottom'],
];
export const H_PLACES = [
  ['left', 'Left'],
  ['center', 'Center'],
  ['right', 'Right'],
];
export const BOXES = ['fit', 'fill'];

/** A type's placement ({ axes, box, fill, place, media }) or null (it has none). */
export function placementOf(type) {
  const p = (typeof type === 'string' ? WIDGET_TYPES[type] : type)?.placement;
  if (!p) return null;
  const axes = ['v', 'h'].includes(p.axes) ? p.axes : 'both';
  return {
    axes,
    box: p.box !== false,
    fill: p.fill === true,
    place: p.place || (axes === 'v' ? 'top' : axes === 'h' ? 'left' : 'left top'),
    media: p.media === true,
  };
}

/** The places a placement offers. */
export const placesOf = (p) => (p?.axes === 'v' ? V_PLACES : p?.axes === 'h' ? H_PLACES : PLACES);

/** Is widget `b` Fill? (a type without the switch: no) */
export function fillOf(b) {
  const p = placementOf(b?.type);
  if (!p || !p.box) return false;
  return BOXES.includes(b?.box) ? b.box === 'fill' : p.fill;
}

/** Widget `b`'s place (one of its type's places; else the type's default). */
export function placeOfBox(b) {
  const p = placementOf(b?.type);
  if (!p) return null;
  return placesOf(p).some(([v]) => v === b?.place) ? b.place : p.place;
}

const H = { left: 'start', right: 'end' };
const V = { top: 'start', bottom: 'end' };
/** A place as grid alignment: { h, v } (start | center | end). */
export function alignOf(place) {
  const w = String(place || '').split(/\s+/);
  return {
    h: H[w.find((x) => x in H)] || 'center',
    v: V[w.find((x) => x in V)] || 'center',
  };
}

// set: a box or place stored (a widget at its type's defaults renders as it always has: its
// content at the top left, a photo cover and centred: the stylesheet's defaults)
const isSet = (b) => b?.box !== undefined || b?.place !== undefined;

/** The classes of its placement: wgt--placed (its content box placed), wgt--fill. */
export function placeClass(b) {
  const p = placementOf(b?.type);
  if (!p || p.media || !isSet(b)) return '';
  return ' wgt--placed' + (p.axes === 'v' ? ' wgt--place-v' : '') + (fillOf(b) ? ' wgt--fill' : '');
}

/** Its variables: --ph / --pv (grid alignment), a photo's --fit / --pos. */
export function placeVars(b) {
  const p = placementOf(b?.type);
  if (!p || !isSet(b)) return '';
  const place = placeOfBox(b);
  if (p.media) return `;--fit:${fillOf(b) ? 'cover' : 'contain'};--pos:${place}`;
  const a = alignOf(place);
  return (p.axes === 'v' ? '' : `;--ph:${a.h}`) + (p.axes === 'h' ? '' : `;--pv:${a.v}`);
}

/** Problems with a widget's box / place (src/site/validate.js). */
export function checkPlacement(b) {
  const out = [];
  const p = placementOf(b?.type);
  if (b?.box !== undefined && (!p?.box || !BOXES.includes(b.box)))
    out.push(p?.box ? '"box" must be fit or fill' : '"box": this widget has no Fit / Fill');
  if (b?.place !== undefined && !(p && placesOf(p).some(([v]) => v === b.place)))
    out.push(
      p
        ? `"place" must be one of ${placesOf(p)
            .map(([v]) => v)
            .join(', ')}`
        : '"place": this widget has no placement',
    );
  return out;
}
