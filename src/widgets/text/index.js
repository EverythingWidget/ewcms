/**
 * The built-in Text widget (text): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, editable } from '../../render/helpers.js';
import { checkBody, lineText, renderBody } from '../../render/text.js';
import { knownName, partLabel, partText } from '../../render/layout/parts.js';
import { keysOf } from '../../render/layout/bindings.js';
import { hrefOf } from '../../render/hrefs.js';

/**
 * Text: lines in the site's text styles (a label, a title, paragraphs, ...), with bold,
 * italic, links and an item's properties in them (property parts: ../../layout/parts.js; a source's
 * name shows how many items it has) (../text.js has the body's shape).
 * Edited in the preview only (src/editor/rich.js). A title line animates as page.title, the lines after it (when the
 * widget has no motion of its own) as page.intro.
 */
export const text = {
  type: 'text',
  // added from the editor: Auto, as tall as what it holds; two thirds wide, so a heading or a
  // paragraph doesn't wrap at every word (F47; a third, 40, before)
  added: { size: 'auto', span: 80 },
  label: 'Text',
  icon: 'font',
  line: 'Titles, paragraphs, labels: any text',
  sketch: 'text',
  // always full width: no Fit / Fill, only where it sits top to bottom
  placement: { axes: 'v', box: false, place: 'top' },
  // its lines can each fill its width (Full-width line), its whole text scale down (Shrink to fit)
  fitWidth: true,
  scaleToFit: true,
  settings: [{ key: 'body', label: 'Text', type: 'rich' }],
  config: [],
  defaults: { body: [{ style: 'paragraph', text: [{ t: 'Some text.' }] }], config: {} },
  check: (widget) => (widget.body === undefined ? [] : checkBody(widget.body)),
  // the page's title (src/render/routes.js pageTitle): its first title line, when it has one (a
  // title with a property in it names the item, not the page: none)
  pageTitle: (widget) =>
    Array.isArray(widget.body) && widget.body.some((l) => l?.style === 'title')
      ? { title: lineText(widget.body, 'title') }
      : null,
  render: (s, ctx, widget) => {
    const body = Array.isArray(s.body) ? s.body : [];
    // the names its property runs can have (the editor marks the others: data-names for its
    // inline editor, src/editor/rich.js)
    const scope = {
      item: widget.item,
      sources: ctx.sources,
      keys: keysOf(ctx, widget.source),
      items: widget.scopeItems, // {items}: a list widget's own items (a List's item: its List's)
      parent: widget.parent, // an inner List's item: the outer item ({ of: "parent" } parts)
    };
    const known = editable ? (name) => knownName(name, scope) : null;
    const names = editable
      ? ` data-names="${[...new Set([...(scope.keys || []), ...Object.keys(widget.item || {}), ...(widget.scopeItems ? ['items'] : []), ...Object.keys(ctx.sources || {})])].join(' ')}"`
      : '';
    // an empty property: nothing on the site, its {name} (dimmed) in the editor
    const value = (r) => partText(r, scope) || (editable ? partLabel(r) : '');
    const firstTitle = body.findIndex((l) => l?.style === 'title');
    const own = typeof s.motion?.animation === 'string';
    const attrs = (i, style) =>
      style === 'title' && i === firstTitle
        ? ' data-anim="page.title"'
        : !own && firstTitle >= 0 && i > firstTitle
          ? ' data-anim="page.intro"'
          : '';
    return html`<div class="text">
      <div class="text__body" ${widget.ed('body', 'rich', { inline: true })}${names}>${renderBody(body, {
        value,
        known,
        href: (link) => hrefOf(ctx, link, 'a text link') || '#',
        attrs,
      })}</div>
    </div>`;
  },
};

export default text;
