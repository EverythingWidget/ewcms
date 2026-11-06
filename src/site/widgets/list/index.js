/**
 * The built-in List widget (list): a widget module like any custom one (../index.js has the
 * format; its look is ./style.scss, its behaviour ./client.js). It repeats an item template
 * once per item: of its source (From a source), or of config.items (Hand-made).
 *
 *   { "type": "list", "heading": "People", "source": { "mode": "all", "from": "people" },
 *     "config": { "template": "preset:card", "arrangement": "grid", "columns": "3",
 *                 "gap": "m", "seeAll": true } }
 *
 *   Hand-made (Photography-style panels by hand):
 *   { "type": "list", "config": { "handmade": true, "template": "preset:panel", "columns": "2",
 *       "items": [
 *         { "title": "People", "source": "people", "unit": "models" },
 *         { "title": "Places", "source": "places", "unit": "places" }
 *       ] } }
 *
 * template     a preset (./presets.js): preset:card | preset:plain | preset:panel | preset:row
 * handmade     true: items come from config.items (Hand-made); omit/false: from the source
 * items        hand-made entries [{ title, photo?, link?, source?, unit? }]; kept when switching
 *              back to From a source (and source is kept when switching to Hand-made)
 * arrangement  Grid (columns). Carousel comes later (not offered yet).
 * columns      "1"–"6" (two on a tablet, one on a phone). Row preset defaults to "1", others "3".
 * gap          between the items: s | m | l
 * properties   mapping { role: property } (title, photo, body): { "photo": "cover" }; a role
 *              left out shows the property of its own name (when its type fits), else nothing
 * seeAll       a link to the source's page after the heading (From a source only; ignored when handmade)
 *
 * When a value is missing (every widget's Content tab, config.missing: hide | show): item
 * widgets inherit this List's choice unless they set their own (../../layout/missing.js).
 *
 * {items} in the heading (or any part of its items) is the List's own items: a list, so a
 * part shows how many (the A1 rule: an item's own "items" property wins; ../../layout/parts.js).
 * No items: the List's empty state, never nothing.
 */
import { html, esc, editable, itemHref, warnOnce } from '../../helpers.js';
import { contentPath } from '../../files.js';
import { isObject } from '../../is.js';
import { t } from '../../strings.js';
import { keysOf, resolveWidget } from '../../layout/bindings.js';
import { hideMissing, missingState } from '../../layout/missing.js';
import { partEmpty } from '../../layout/parts.js';
import { WIDGET_TYPES } from '../index.js';
import { sourcePage } from '../data.js';
import { MAPPABLE, PRESETS, factsRuns, mappingRows, presetOf, presetWidgets } from './presets.js';
import { HANDMADE_ITEM, handmadeItemProblem, handmadeItemsOf, isHandmade } from './handmade.js';

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

/**
 * A template widget for one item: facts joined; item link; hand-made Panel count from the
 * pointed source + unit (absent when there is nothing to count).
 */
function forItem(w, scope, link, sep, { handmade = false, href = '' } = {}) {
  if (w.handmadeCount) {
    // the item's own count (resolveHandmadeItem: the pointed source's, "04"), then its unit
    const unit = scope.item?.unit;
    if (!scope.item?.count) return null; // no count overlay
    const runs = [{ property: 'count' }];
    if (unit) runs.push({ t: unit.startsWith(' ') ? unit : ` ${unit}` });
    return { type: 'text', role: 'count', body: [{ style: 'label', text: runs }] };
  }
  if (w.facts)
    return {
      ...w,
      body: [{ ...w.body[0], text: factsRuns(w.facts, (p) => partEmpty(p, scope), sep) }],
    };
  if (w.itemLink) {
    // hand-made: the button uses the resolved href (no source-item id)
    if (handmade && href) return { ...w, config: { ...w.config, link: { href } } };
    return { ...w, config: { ...w.config, link } };
  }
  return w;
}

export const list = {
  type: 'list',
  // added from the editor: Auto, as tall as what it holds
  added: { size: 'auto' },
  list: true,
  // Content tab: From a source | Hand-made (ListLead.svelte); items at config.items
  handmade: true,
  // widgetItems (../../layout/source.js): hand-made items instead of the source's
  items: (ctx, widget) => (isHandmade(widget) ? handmadeItemsOf(ctx, widget) : undefined),
  // Property mapping (config.properties): the Content tab's rows for this List (none when
  // hand-made: its item shape is fixed)
  mapping: (ctx, widget) =>
    widget?.config?.handmade === true
      ? []
      : mappingRows(
          ctx,
          widget?.source?.from || '',
          widget?.config?.template,
          widget?.config?.properties,
        ),
  label: 'List',
  icon: 'table-list',
  line: 'An item per entry of a source, or items you add by hand, in a look you pick',
  sketch: 'list',
  settings: [{ key: 'heading', label: 'Heading (empty: none)' }],
  config: [
    // handmade + items: Content tab via ListLead (not the generic settings loop)
    { key: 'handmade', type: 'boolean' },
    {
      key: 'items',
      label: 'Items',
      list: {
        source: { type: 'source', label: 'Source' },
        title: { type: 'text', label: 'Title', width: 'half' },
        unit: { type: 'text', label: 'Unit (after the count)', width: 'half' },
        photo: { type: 'photo', label: 'Photo' },
        link: { type: 'link', label: 'Link' },
      },
      item: { ...HANDMADE_ITEM },
    },
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
  // arrangement "rows" is gone; hand-made items shape
  check: (widget) => {
    const out = [];
    if (widget.config?.arrangement === 'rows')
      out.push(
        'config.arrangement "rows" is gone: write "columns": "1" (Arrangement is only Grid; Carousel comes later)',
      );
    if (
      widget.config?.handmade !== undefined &&
      widget.config.handmade !== true &&
      widget.config.handmade !== false
    )
      out.push('config.handmade must be true (Hand-made) or left out (From a source)');
    const props = widget.config?.properties;
    if (props !== undefined) {
      if (!isObject(props)) out.push('config.properties must be an object: { "photo": "cover" }');
      else
        for (const [role, key] of Object.entries(props)) {
          if (!MAPPABLE[role])
            out.push(
              `config.properties has no "${role}" (it maps ${Object.keys(MAPPABLE).join(', ')})`,
            );
          else if (typeof key !== 'string' || !key)
            out.push(`config.properties.${role} must be a property name`);
        }
    }
    const items = widget.config?.items;
    if (items !== undefined) {
      if (!Array.isArray(items)) out.push('config.items must be a list');
      else
        items.forEach((it, i) => {
          const p = handmadeItemProblem(it, `config.items.${i}`);
          if (p) out.push(p);
        });
    }
    return out;
  },
  render: (s, ctx, widget) => {
    // `s` is the content widget (resolveWidget); `widget` is the render api (id, items, …)
    const c = s.config || {};
    const handmade = c.handmade === true;
    const source = handmade ? '' : widget.source || ''; // None / handmade: no source list
    const preset = presetOf(c.template);
    const columns = COLUMNS.includes(String(c.columns)) ? String(c.columns) : preset.columns || '3';
    const gap = GAPS.includes(c.gap) ? c.gap : 'm';
    // this List's choice; each item widget may override (hideMissing on its own config)
    const listHide = hideMissing(c);
    // items from layout (widgetItems: source list or resolved config.items)
    const items = widget.items || [];
    const keys = handmade
      ? new Set(['title', 'photo', 'unit', 'count', 'source'])
      : keysOf(ctx, source);
    const shape = preset.id.slice('preset:'.length);
    const sep = t(ctx, 'list.sep');
    // the template, once per List: its widgets, and whether its photo sits apart from the text
    const template = presetWidgets(preset.id, ctx, source, {
      open: t(ctx, 'list.open'),
      handmade,
      properties: c.properties,
    });
    const photoFirst = preset.photoFirst && template[0]?.role === 'photo';
    // See all: only From a source (hand-made has no single source page)
    const href = !handmade && source && c.seeAll ? sourcePage(ctx, source) : '';
    const missing = new Map(); // name -> how many items have no value for it
    const out = items.map((item, i) => {
      const at = widget.indexOf ? widget.indexOf(item) : i;
      const itemHrefLink = !handmade && item?.id ? { item: { source, id: item.id } } : undefined;
      const handmadeHref = handmade ? item.href || '' : '';
      const scope = { item, keys, sources: ctx.sources, items };
      const api = {
        id: widget.id,
        file: widget.file,
        source,
        items: [item],
        item,
        index: at,
      };
      const ws = template.map((w) => {
        const filled = forItem(w, scope, itemHrefLink, sep, { handmade, href: handmadeHref });
        if (!filled) return { html: '', missing: [] };
        // item widgets inherit the List's missing choice unless they set their own
        const hide = filled.config?.missing !== undefined ? hideMissing(filled.config) : listHide;
        return itemWidget(filled, ctx, scope, { hide, api });
      });
      ws.forEach((w) => w.missing.forEach((n) => missing.set(n, (missing.get(n) || 0) + 1)));
      const parts = ws.map((w) => w.html);
      const [first, ...rest] = parts;
      const inner = photoFirst
        ? `${first}<div class="li__text">${rest.join('')}</div>`
        : `<div class="li__text">${parts.join('')}</div>`;
      const url = handmade ? handmadeHref : itemHrefLink ? itemHref(ctx, source, item) : '';
      const tag = preset.link && url ? 'a' : 'div';
      const ref = tag === 'a' ? ` href="${esc(url)}"` : '';
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
