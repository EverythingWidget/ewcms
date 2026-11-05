/**
 * The built-in Text widget (text): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, editable } from '../../helpers.js';
import { checkBody, renderBody } from '../../text.js';
import { knownName, partText } from '../../layout/parts.js';
import { keysOf } from '../../layout/bindings.js';
import { hrefOf } from '../../hrefs.js';

/**
 * Text: lines in the site's text styles (a label, a title, paragraphs, ...), with bold,
 * italic, links and an item's properties in them (property parts: ../../layout/parts.js; a source's
 * name shows how many items it has) (../text.js has the body's shape).
 * Edited in the preview only (src/editor/rich.js). A title line animates as page.title, the lines after it (when the
 * widget has no motion of its own) as page.intro.
 */
export const text = {
  type: 'text',
  // added from the editor: Auto, as tall as what it holds
  added: { size: 'auto' },
  label: 'Text',
  icon: 'font',
  line: 'Titles, paragraphs, labels: any text',
  sketch: 'text',
  // always full width: no Fit / Fill, only where it sits top to bottom
  placement: { axes: 'v', box: false, place: 'top' },
  // its lines can each fill its width (Fit width), its whole text scale down (Scale to fit)
  fitWidth: true,
  scaleToFit: true,
  settings: [{ key: 'body', label: 'Text', type: 'rich' }],
  config: [],
  defaults: { body: [{ style: 'paragraph', text: [{ t: 'Some text.' }] }], config: {} },
  check: (widget) => (widget.body === undefined ? [] : checkBody(widget.body)),
  render: (s, ctx, widget) => {
    const body = Array.isArray(s.body) ? s.body : [];
    // the names its property runs can have (the editor marks the others: data-names for its
    // inline editor, src/editor/rich.js)
    const scope = {
      item: widget.item,
      sources: ctx.sources,
      keys: keysOf(ctx, widget.source),
      items: widget.scopeItems, // {items}: a list widget's own items (a List's item: its List's)
    };
    const known = editable ? (name) => knownName(name, scope) : null;
    const names = editable
      ? ` data-names="${[...new Set([...(scope.keys || []), ...Object.keys(widget.item || {}), ...(widget.scopeItems ? ['items'] : []), ...Object.keys(ctx.sources || {})])].join(' ')}"`
      : '';
    // an empty property: nothing on the site, its {name} (dimmed) in the editor
    const value = (r) => partText(r, scope) || (editable ? `{${r.property}}` : '');
    const firstTitle = body.findIndex((l) => l?.style === 'title');
    const own = typeof s.motion?.animation === 'string';
    const attrs = (i, style) =>
      style === 'title' && i === firstTitle
        ? ' data-anim="page.title"'
        : !own && firstTitle >= 0 && i > firstTitle
          ? ' data-anim="page.intro"'
          : '';
    return html`<div class="text">
      <div class="text__body" ${widget.ed('body', 'rich')}${names}>${renderBody(body, {
        value,
        known,
        href: (link) => hrefOf(ctx, link, 'a text link') || '#',
        attrs,
      })}</div>
    </div>`;
  },
};

export default text;
