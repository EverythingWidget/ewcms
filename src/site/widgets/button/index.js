/**
 * The built-in Button widget (button): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, extAttrs } from '../../helpers.js';
import { hrefOf } from '../../hrefs.js';

/**
 * A button linking somewhere (config.link: a page, an item or a URL; src/site/hrefs.js). Its
 * label is edited in its settings popup only (no widget.ed: never inline in the preview; only a Text
 * widget's content is).
 */
export const button = {
  type: 'button',
  // added from the editor: Auto, as tall as what it holds
  added: { size: 'auto' },
  label: 'Button',
  icon: 'arrow-right',
  line: 'A link to a page or a site',
  sketch: 'button',
  // its content box (the button): Fit hugs its label, Fill fills the widget; placed in it
  placement: { axes: 'both', box: true, place: 'left top' },
  fields: [{ key: 'label', label: 'Label' }],
  config: [{ key: 'link', label: 'Link', type: 'link' }],
  defaults: {
    label: 'Get in touch',
    config: { link: { href: '/about/' } },
    motion: { animation: 'fade-in' },
  },
  render: (s, ctx) => {
    const href = hrefOf(ctx, s.config?.link, 'a button') || '/';
    return html` <div class="buttonwidget">
      <a class="btn glass" href="${esc(href)}"${extAttrs(href)}><span>${esc(s.label)}</span> <span aria-hidden="true">→</span></a>
    </div>`;
  },
};

export default button;
