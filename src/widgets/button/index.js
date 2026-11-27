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
  // the Add widget modal's drawing of it (WidgetsModal.svelte): grey shapes, classes there
  drawing: ['pill'],
  // in an item template (the Template editor): When a value is missing, its label (its
  // setting's inTemplate), whether it opens the item's page (a template's only), and its link
  // (its config entry's inTemplate)
  inTemplate: {
    missing: true,
    fields: [
      {
        key: 'itemLink',
        label: 'Opens the item’s page',
        type: 'boolean',
        value: (w) => w.itemLink === true,
        write: (v) => (v ? true : undefined),
      },
    ],
  },
  // its content box (the button): Fit hugs its label, Fill fills the widget; placed in it
  placement: { axes: 'both', box: true, place: 'left top' },
  // (an emptied label keeps its element: the editor writes it in place)
  settings: [{ key: 'label', label: 'Label', blank: 'keep', inTemplate: { binds: true } }],
  config: [
    {
      key: 'link',
      label: 'Link',
      type: 'link',
      // in a template: a parts field (a property: {url}), off when it opens the item's page
      inTemplate: {
        binds: true,
        value: (w) => (Array.isArray(w.config?.link) ? w.config.link : []),
        write: (v) => {
          const runs = Array.isArray(v) ? v : typeof v === 'string' && v ? [{ t: v }] : [];
          return runs.length ? runs : undefined;
        },
        structure: true,
        disabled: (w) => w.itemLink === true,
        help: (w) => (w.itemLink === true ? 'It opens the item’s page' : 'A property: {url}'),
      },
    },
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
      inPlace: { on: '.buttonwidget', class: 'buttonwidget--wrap', when: 'wrap' },
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
      ${
        href
          ? html`<a class="btn glass" href="${esc(href)}" ${extAttrs(href)}>${label}</a>`
          : html`<span class="btn glass">${label}</span>`
      }
    </div>`;
  },
};

export default button;
