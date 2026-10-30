/**
 * The built-in Album cards widget (albums): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html } from '../../helpers.js';
import { albumCard } from '../../templates/partials.js';

/**
 * Album cards of its source's items (a list widget: all of them, or the ones From URL
 * matches), each linking to its page; config.layout landscape for wide photos.
 */
export const albums = {
  type: 'albums',
  // added from the editor: Auto, as tall as what it holds
  added: { size: 'auto' },
  list: true,
  label: 'Album cards',
  icon: 'images',
  line: 'A card per album, to its page',
  sketch: 'albums',
  config: [
    {
      key: 'layout',
      label: 'Layout',
      type: 'select',
      options: [
        ['portrait', 'Portrait'],
        ['landscape', 'Landscape'],
      ],
    },
  ],
  defaults: {
    source: { mode: 'all', from: 'people' },
    config: { layout: 'portrait' },
    motion: { anim: 'grid-reveal' },
  },
  render: (s, ctx, widget) => {
    const source = widget.source || ''; // None: no cards
    const landscape = s.config?.layout === 'landscape';
    return html` <div class="agrid${landscape ? ' agrid--landscape' : ''}">
      ${widget.items.map((p) => albumCard(ctx, source, p, { landscape, index: widget.indexOf(p) }))}
    </div>`;
  },
};

export default albums;
