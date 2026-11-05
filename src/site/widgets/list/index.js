/**
 * The built-in List widget (list): a widget module like any custom one (../index.js has the
 * format; its look is ./style.scss, its behaviour ./client.js). It repeats an item template
 * once per item of its source; each copy fills from its own item.
 *
 *   { "type": "list", "heading": "People", "source": { "mode": "all", "from": "people" },
 *     "config": { "template": "preset:card", "arrangement": "grid", "columns": "3",
 *                 "gap": "m", "seeAll": true } }
 *
 * template     a preset (./presets.js): preset:card | preset:plain | preset:panel | preset:row
 * arrangement  Grid (columns). Carousel comes later (not offered yet).
 * columns      "1"–"6" (two on a tablet, one on a phone). Row preset defaults to "1", others "3".
 * gap          between the items: s | m | l
 * seeAll       a link to the source's page after the heading (when it has one)
 *
 * When a value is missing (every widget's Layout tab, config.missing: hide | show): item
 * widgets inherit this List's choice unless they set their own (../../layout/missing.js).
 *
 * {items} in the heading (or any part of its items) is the List's own items: a list, so a
 * part shows how many (the A1 rule: an item's own "items" property wins; ../../layout/parts.js).
 * No items: the List's empty state, never nothing.
 */
import { html, esc, editable, itemHref, warnOnce } from '../../helpers.js';
import { contentPath } from '../../files.js';
import { t } from '../../strings.js';
import { keysOf, resolveWidget } from '../../layout/bindings.js';
import { hideMissing, missingState } from '../../layout/missing.js';
import { partEmpty } from '../../layout/parts.js';
import { WIDGET_TYPES } from '../index.js';
import { sourcePage } from '../data.js';
import { PRESETS, factsRuns, presetOf, presetWidgets } from './presets.js';

const COLUMNS = ['1', '2', '3', '4', '5', '6'];
const GAPS = ['s', 'm', 'l'];

/** One widget of an item's template, filled from `item` (scope); '' when it is left out. */
function itemWidget(w, ctx, scope, { hide, api }) {
  const def = WIDGET_TYPES[w.type];
  const gone = missingState(ctx, w, def, scope, { hide });
  if (gone.skip) return { html: '', missing: gone.missing };
  const data = resolveWidget(w, def, { ...scope, placeholders: editable });
  const out = def.render(data, ctx, { ...api, scopeItems: scope.items, ed: () => '' });
  return {
    html: `<div class="li__w li__${w.role}"${gone.attr}>${out}</div>`,
    missing: gone.all ? gone.missing : [],
  };
}

/** A template widget for one item: its facts joined from the values it has, its item link. */
function forItem(w, scope, link, sep) {
  if (w.facts)
    return {
      ...w,
      body: [{ ...w.body[0], text: factsRuns(w.facts, (p) => partEmpty(p, scope), sep) }],
    };
  if (w.itemLink) return { ...w, config: { ...w.config, link } };
  return w;
}

export const list = {
  type: 'list',
  // added from the editor: Auto, as tall as what it holds
  added: { size: 'auto' },
  list: true,
  label: 'List',
  icon: 'table-list',
  line: 'An item per entry of a source, in a look you pick',
  sketch: 'list',
  settings: [{ key: 'heading', label: 'Heading (empty: none)' }],
  config: [
    {
      key: 'template',
      label: 'Preset',
      type: 'select',
      options: PRESETS.map((p) => [p.id, p.label]),
    },
    { key: 'seeAll', label: 'See all link', type: 'boolean' },
    {
      key: 'arrangement',
      label: 'Arrangement',
      type: 'select',
      tab: 'layout',
      // Carousel comes later: not offered yet (disabled would need Field support for a third
      // option state; Grid is the only choice until then)
      options: [['grid', 'Grid']],
    },
    {
      key: 'columns',
      label: 'Columns',
      type: 'select',
      tab: 'layout',
      width: 'half',
      options: COLUMNS.map((n) => [n, n]),
    },
    {
      key: 'gap',
      label: 'Gap',
      type: 'select',
      tab: 'layout',
      width: 'half',
      options: [
        ['s', 'S'],
        ['m', 'M'],
        ['l', 'L'],
      ],
    },
  ],
  defaults: {
    heading: '',
    source: { mode: 'all', from: 'people' },
    config: {
      template: 'preset:card',
      arrangement: 'grid',
      columns: '3',
      gap: 'm',
      seeAll: false,
    },
    motion: { animation: 'grid-reveal' },
  },
  // arrangement "rows" is gone: one column is columns "1" (pre-v1: change by hand)
  check: (widget) =>
    widget.config?.arrangement === 'rows'
      ? [
          'config.arrangement "rows" is gone: write "columns": "1" (Arrangement is only Grid; Carousel comes later)',
        ]
      : [],
  render: (s, ctx, widget) => {
    const c = s.config || {};
    const source = widget.source || ''; // None: no items
    const preset = presetOf(c.template);
    const columns = COLUMNS.includes(String(c.columns)) ? String(c.columns) : preset.columns || '3';
    const gap = GAPS.includes(c.gap) ? c.gap : 'm';
    // this List's choice; each item widget may override (hideMissing on its own config)
    const listHide = hideMissing(c);
    const items = widget.items || [];
    const keys = keysOf(ctx, source);
    const shape = preset.id.slice('preset:'.length);
    const sep = t(ctx, 'list.sep');
    // the template, once per List: its widgets, and whether its photo sits apart from the text
    const template = presetWidgets(preset.id, ctx, source, { open: t(ctx, 'list.open') });
    const photoFirst = preset.photoFirst && template[0]?.role === 'photo';
    const href = source && c.seeAll ? sourcePage(ctx, source) : '';
    const missing = new Map(); // name -> how many items have no value for it
    const out = items.map((item, i) => {
      const at = widget.indexOf ? widget.indexOf(item) : i;
      const link = item?.id ? { item: { source, id: item.id } } : undefined;
      const scope = { item, keys, sources: ctx.sources, items };
      const api = { id: widget.id, file: widget.file, source, items: [item], item, index: at };
      const ws = template.map((w) => {
        const filled = forItem(w, scope, link, sep);
        // item widgets inherit the List's missing choice unless they set their own
        const hide = filled.config?.missing !== undefined ? hideMissing(filled.config) : listHide;
        return itemWidget(filled, ctx, scope, { hide, api });
      });
      ws.forEach((w) => w.missing.forEach((n) => missing.set(n, (missing.get(n) || 0) + 1)));
      const [first, ...rest] = ws.map((w) => w.html);
      const inner = photoFirst
        ? `${first}<div class="li__text">${rest.join('')}</div>`
        : `<div class="li__text">${ws.map((w) => w.html).join('')}</div>`;
      const tag = preset.link && link ? 'a' : 'div';
      const ref = tag === 'a' ? ` href="${esc(itemHref(ctx, source, item))}"` : '';
      return `<${tag} class="li li--${shape}"${ref} data-list-item data-anim-item>${inner}</${tag}>`;
    });
    if (!editable)
      for (const [name, n] of missing)
        warnOnce(
          `${contentPath(widget.file)}: List ${widget.id}: ${n} of ${items.length} items have no {${name}}: ${listHide ? 'its widget is hidden there' : 'it shows empty'}`,
          'layout',
        );
    const head = s.heading
      ? html`<header class="section__head list__head">
          <h2 class="section__title" data-anim="section.title">${esc(s.heading)}</h2>
          ${href ? html`<a class="btn glass section__cta" href="${esc(href)}"><span>${esc(t(ctx, 'list.seeAll'))}</span> <span aria-hidden="true">→</span></a>` : ''}
        </header>`
      : '';
    const body = items.length
      ? `<div class="list__items list__items--grid" style="--list-cols:${columns}" data-cols="${columns}">${out.join('')}</div>`
      : `<p class="list__empty label muted" data-list-empty>${esc(t(ctx, 'list.empty'))}</p>`;
    return `<div class="list list--${shape} list--gap-${gap}" data-arrangement="grid" data-cols="${columns}">${head}${body}</div>`;
  },
};

export default list;
