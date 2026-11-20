/**
 * The built-in Button widget (button): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, extAttrs } from '../../render/helpers.js';
import { hrefOf } from '../../render/hrefs.js';

/**
 * A button linking somewhere (config.link: a page, an item or a URL; src/render/hrefs.js). Its
 * label is edited in its settings popup only (never inline in the preview: only a Text widget's
 * content is); its widget.ed marks the label so the editor's preview shows it as it is typed.
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
  // (an emptied label keeps its element: the editor writes it in place)
  settings: [{ key: 'label', label: 'Label', blank: 'keep' }],
  config: [
    { key: 'link', label: 'Link', type: 'link' },
    // a label longer than the widget is wide: cut at its edge (Clip, unset) or broken onto more
    // lines, the pill taller (Wrap: buttonwidget--wrap, src/client/styles/_layout.scss)
    {
      key: 'textOverflow',
      label: 'Text',
      type: 'seg',
      tab: 'layout',
      default: 'clip',
      options: [
        ['wrap', 'Wrap'],
        ['clip', 'Clip'],
      ],
      // the editor toggles it in place, as render() writes it
      live: { on: '.buttonwidget', class: 'buttonwidget--wrap', when: 'wrap' },
    },
  ],
  defaults: {
    label: 'Button',
    config: { link: { href: '' } },
    motion: { animation: 'fade-in' },
  },
  render: (s, ctx, widget) => {
    const href = hrefOf(ctx, s.config?.link, 'a button');
    const label = html`<span${widget?.ed('label') ?? ''}>${esc(s.label)}</span> <span aria-hidden="true">→</span>`;
    const wrap = s.config?.textOverflow === 'wrap' ? ' buttonwidget--wrap' : '';
    return html` <div class="buttonwidget${wrap}">
      ${href
        ? html`<a class="btn glass" href="${esc(href)}"${extAttrs(href)}>${label}</a>`
        : html`<span class="btn glass">${label}</span>`}
    </div>`;
  },
};

export default button;
