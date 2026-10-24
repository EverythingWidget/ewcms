/**
 * The built-in Photo widget (photo): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, img, sizes } from '../../helpers.js';

/** How a photo fills its widget's area (an Aspect or Rows widget): cropped or whole. */
export const PHOTO_FITS = [
  ['cover', 'Cover'],
  ['contain', 'Contain'],
];
/** Where the photo sits in its area (CSS object-position), row by row: the editor's 3 x 3 grid. */
export const PHOTO_SPOTS = [
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
const fitOf = (s) => (s.photoFit === 'contain' ? 'contain' : 'cover');
const spotOf = (s) => (PHOTO_SPOTS.some(([v]) => v === s.photoPos) ? s.photoPos : 'center');

/**
 * One photo, as wide as the text column, with an optional caption. In an Aspect or Rows widget
 * it fills the area: photoFit (cover: cropped | contain: whole; "fit" is text's) at photoPos
 * (PHOTO_SPOTS), through
 * --fit / --pos (src/client/styles/_layout.scss, the fill mixin).
 */
export const photo = {
  type: 'photo',
  label: 'Photo',
  icon: 'image',
  line: 'One photo, with a caption',
  sketch: 'photo',
  fields: [
    { key: 'src', label: 'Photo', type: 'image' },
    { key: 'caption', label: 'Caption (empty: none)' },
    { key: 'photoFit', label: 'Fit', type: 'seg', options: PHOTO_FITS, unset: 'cover' },
    { key: 'photoPos', label: 'Position', type: 'spot', options: PHOTO_SPOTS, unset: 'center' },
  ],
  defaults: { src: '', caption: '', motion: { anim: 'image-reveal' } },
  render: (s, ctx, b) =>
    html` <div class="photowidget" style="--fit:${fitOf(s)};--pos:${spotOf(s)}">
      <figure class="photowidget__figure">
        ${s.src ? img(ctx, s.src, { sizes: sizes('100vw', '60vw'), attrs: b.ed('src', 'image') }) : ''}
        ${s.caption ? html`<figcaption class="label muted" ${b.ed('caption')}>${esc(s.caption)}</figcaption>` : ''}
      </figure>
    </div>`,
};

export default photo;
