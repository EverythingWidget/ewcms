/**
 * Quote: a pull quote with its author, the example of a site's own widget (README "Custom
 * widgets"). Its look: style.scss; on the page, client.js marks it seen once it scrolls in.
 */
import { html, esc, lines } from 'ewcms/widget-api';

export default {
  type: 'quote',
  label: 'Quote',
  icon: 'quote-left',
  line: 'A pull quote and who said it',
  fields: [
    { key: 'quote', label: 'Quote', type: 'multiline' },
    { key: 'author', label: 'Author', width: 'half' },
    { key: 'role', label: 'Role', width: 'half' },
  ],
  config: [
    {
      key: 'size',
      label: 'Size',
      type: 'select',
      options: [
        ['', 'Normal'],
        ['large', 'Large'],
      ],
    },
  ],
  defaults: { quote: 'Something worth repeating.', author: 'Someone', role: '', config: {} },
  check: (w) =>
    String(w.quote || '').length > 400 ? ['"quote" is longer than 400 characters'] : [],
  render: (data, ctx, widget) =>
    html`<figure class="quote${data.config?.size === 'large' ? ' quote--large' : ''}">
      <blockquote class="quote__text" ${widget.ed('quote', 'multiline')}>
        ${lines(data.quote)}
      </blockquote>
      <figcaption class="quote__by">
        <span ${widget.ed('author')}>${esc(data.author)}</span
        >${data.role ? html`, <span ${widget.ed('role')}>${esc(data.role)}</span>` : ''}
      </figcaption>
    </figure>`,
};
