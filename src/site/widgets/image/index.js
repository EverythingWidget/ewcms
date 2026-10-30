/**
 * The built-in Image widget (image): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, img, sizes } from '../../helpers.js';

/**
 * One image, as wide as the text column, with an optional caption. In an Aspect or Rows widget
 * it fills the area: the widget's box (Fill: cover, cropped | Fit: contain, whole) at its
 * place (../../layout/place.js, media), through --fit / --pos on the widget
 * (src/client/styles/_layout.scss, the fill mixin). Its caption is edited in its settings popup
 * only (no widget.ed on it: only a Text widget's content is edited in the preview); the image itself
 * keeps widget.ed('src', 'image') for picking.
 */
export const image = {
  type: 'image',
  label: 'Image',
  icon: 'image',
  line: 'One image, with a caption',
  sketch: 'image',
  placement: { media: true, fill: true, place: 'center' },
  fields: [
    { key: 'src', label: 'Image', type: 'image' },
    { key: 'caption', label: 'Caption (empty: none)' },
  ],
  defaults: { src: '', caption: '', motion: { animation: 'image-reveal' } },
  render: (s, ctx, widget) =>
    html` <div class="imagewidget">
      <figure class="imagewidget__figure">
        ${s.src ? img(ctx, s.src, { sizes: sizes('100vw', '60vw'), attrs: widget.ed('src', 'image') }) : ''}
        ${s.caption ? html`<figcaption class="label muted">${esc(s.caption)}</figcaption>` : ''}
      </figure>
    </div>`,
};

export default image;
