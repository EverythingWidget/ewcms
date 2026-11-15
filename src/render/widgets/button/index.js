/**
 * The built-in Button widget (button): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, extAttrs } from '../../helpers.js';
import { hrefOf } from '../../hrefs.js';

/**
 * A button linking somewhere (config.link: a page, an item or a URL; src/render/hrefs.js). Its
 * label is edited in its settings popup only (no widget.ed: never inline in the preview; only a Text
 * widget's content is).
 */
export const button = {
  type: 'button',
  // added from the editor: Auto, as tall as what it holds
  added: { size: 'auto', lang: { nl: { label: 'Knop' } } },
  label: 'Button',
  icon: 'arrow-right',
  line: 'A link to a page or a site',
  sketch: 'button',
  // its content box (the button): Fit hugs its label, Fill fills the widget; placed in it
  placement: { axes: 'both', box: true, place: 'left top' },
  settings: [{ key: 'label', label: 'Label' }],
  config: [{ key: 'link', label: 'Link', type: 'link' }],
  defaults: {
    label: 'Button',
    config: { link: { href: '' } },
    motion: { animation: 'fade-in' },
  },
  render: (s, ctx) => {
    const href = hrefOf(ctx, s.config?.link, 'a button');
    const label = html`<span>${esc(s.label)}</span> <span aria-hidden="true">→</span>`;
    return html` <div class="buttonwidget">
      ${href
        ? html`<a class="btn glass" href="${esc(href)}"${extAttrs(href)}>${label}</a>`
        : html`<span class="btn glass">${label}</span>`}
    </div>`;
  },
};

export default button;
