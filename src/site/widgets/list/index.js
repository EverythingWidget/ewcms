/**
 * The built-in List widget (list): a widget module like any custom one (../index.js has the
 * format; its look is ./style.scss, its behaviour ./client.js). It repeats an item template
 * once per item of its source; each copy fills from its own item.
 *
 *   { "type": "list", "heading": "People", "source": { "mode": "all", "from": "people" },
 *     "config": { "template": "preset:card", "arrangement": "grid", "columns": "3",
 *                 "gap": "m", "seeAll": true, "missing": "hide" } }
 *
 * template     a preset (./presets.js): preset:card | preset:plain | preset:panel | preset:row
 * arrangement  how the items are laid out: grid (columns) | rows (one a row)
 * columns      Grid's columns, "1"–"6" (two on a tablet, one on a phone)
 * gap          between the items: s | m | l
 * seeAll       a link to the source's page after the heading (when it has one)
 * missing      when a value is missing: hide (the item's widget whose every property part is
 *              empty is left out, the page's hide rule) | show (it stays, its values empty)
 *
 * {items} in the heading (or any part of its items) is the List's own items: a list, so a
 * part shows how many (the A1 rule: an item's own "items" property wins; ../../layout/parts.js).
 * No items: the List's empty state, never nothing.
 */
import { html, esc, editable, itemHref, warnOnce } from '../../helpers.js';
import { contentPath } from '../../files.js';
import { t } from '../../strings.js';
import { keysOf, missingOf, resolveWidget } from '../../layout/bindings.js';
import { WIDGET_TYPES } from '../index.js';
import { sourcePage } from '../data.js';
import { PRESETS, PRESET_IDS, presetWidgets } from './presets.js';

const COLUMNS = ['1', '2', '3', '4', '5', '6'];
const GAPS = ['s', 'm', 'l'];

/** One widget of an item's template, filled from `item` (scope); '' when it is left out. */
function itemWidget(w, ctx, scope, { hide, api }) {
  const def = WIDGET_TYPES[w.type];
  const gone = missingOf(w, def, scope);
  if (gone.all && hide && !editable) return { html: '', missing: gone.missing };
  const data = resolveWidget(w, def, { ...scope, placeholders: editable });
  const noValue =
    gone.all && editable
      ? ` data-no-value="${esc(`No value for ${gone.missing.map((n) => `{${n}}`).join(', ')}`)}"`
      : '';
  const out = def.render(data, ctx, { ...api, scopeItems: scope.items, ed: () => '' });
  return {
    html: `<div class="li__w li__${w.role}"${noValue}>${out}</div>`,
    missing: gone.all ? gone.missing : [],
  };
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
    { key: 'template', label: 'Preset', type: 'select', options: PRESETS.map(([v, l]) => [v, l]) },
    { key: 'seeAll', label: 'See all link', type: 'boolean' },
    {
      key: 'missing',
      label: 'When a value is missing',
      type: 'select',
      options: [
        ['hide', 'Hide'],
        ['show', 'Show empty'],
      ],
    },
    {
      key: 'arrangement',
      label: 'Arrangement',
      type: 'select',
      tab: 'layout',
      options: [
        ['grid', 'Grid'],
        ['rows', 'Rows'],
      ],
    },
    {
      key: 'columns',
      label: 'Columns (Grid)',
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
      missing: 'hide',
    },
    motion: { animation: 'grid-reveal' },
  },
  render: (s, ctx, widget) => {
    const c = s.config || {};
    const source = widget.source || ''; // None: no items
    const preset = PRESET_IDS.includes(c.template) ? c.template : 'preset:card';
    const arrangement = c.arrangement === 'rows' ? 'rows' : 'grid';
    const columns = COLUMNS.includes(String(c.columns)) ? String(c.columns) : '3';
    const gap = GAPS.includes(c.gap) ? c.gap : 'm';
    const hide = c.missing !== 'show';
    const items = widget.items || [];
    const keys = keysOf(ctx, source);
    const shape = preset.slice('preset:'.length);
    const href = source && c.seeAll ? sourcePage(ctx, source) : '';
    const missing = new Map(); // name -> how many items have no value for it
    const out = items.map((item, i) => {
      const at = widget.indexOf ? widget.indexOf(item) : i;
      const link = item?.id ? { item: { source, id: item.id } } : undefined;
      const scope = { item, keys, sources: ctx.sources, items };
      const api = { id: widget.id, file: widget.file, source, items: [item], item, index: at };
      const ws = presetWidgets(preset, ctx, source, { link, open: t(ctx, 'list.open') }).map((w) =>
        itemWidget(w, ctx, scope, { hide, api }),
      );
      ws.forEach((w) => w.missing.forEach((n) => missing.set(n, (missing.get(n) || 0) + 1)));
      const [first, ...rest] = ws.map((w) => w.html);
      const photoFirst = presetWidgets(preset, ctx, source)[0]?.role === 'photo';
      const inner = photoFirst
        ? `${first}<div class="li__text">${rest.join('')}</div>`
        : `<div class="li__text">${ws.map((w) => w.html).join('')}</div>`;
      const tag = shape === 'plain' || !link ? 'div' : 'a';
      const ref = tag === 'a' ? ` href="${esc(itemHref(ctx, source, item))}"` : '';
      return `<${tag} class="li li--${shape}"${ref} data-list-item data-anim-item>${inner}</${tag}>`;
    });
    if (!editable)
      for (const [name, n] of missing)
        warnOnce(
          `${contentPath(widget.file)}: List ${widget.id}: ${n} of ${items.length} items have no {${name}}: ${hide ? 'its widget is hidden there' : 'it shows empty'}`,
          'layout',
        );
    const head = s.heading
      ? html`<header class="section__head list__head">
          <h2 class="section__title" data-anim="section.title">${esc(s.heading)}</h2>
          ${href ? html`<a class="btn glass section__cta" href="${esc(href)}"><span>${esc(t(ctx, 'list.seeAll'))}</span> <span aria-hidden="true">→</span></a>` : ''}
        </header>`
      : '';
    const body = items.length
      ? `<div class="list__items list__items--${arrangement}" style="--list-cols:${columns}" data-cols="${columns}">${out.join('')}</div>`
      : `<p class="list__empty label muted" data-list-empty>${esc(t(ctx, 'list.empty'))}</p>`;
    return `<div class="list list--${shape} list--gap-${gap}" data-arrangement="${arrangement}">${head}${body}</div>`;
  },
};

export default list;
