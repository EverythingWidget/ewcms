/**
 * The built-in List widget (list): a widget module like any custom one (../index.js has the
 * format; its look is ./style.scss, its behaviour ./client.js). It repeats an item template
 * once per item: of its source (From a source), or of config.items (Hand-made).
 *
 *   { "type": "list", "heading": "People", "source": { "mode": "all", "from": "people" },
 *     "config": { "template": "preset:card", "arrangement": "grid", "columns": "3",
 *                 "gap": 2, "seeAll": true } }
 *
 *   Hand-made (Photography-style panels by hand):
 *   { "type": "list", "config": { "handmade": true, "template": "preset:panel", "columns": "2",
 *       "items": [
 *         { "title": "People", "source": "people", "unit": "models" },
 *         { "title": "Places", "source": "places", "unit": "places" }
 *       ] } }
 *
 * template     a preset (./presets.js): preset:card | preset:plain | preset:panel | preset:row | preset:photo,
 *              or a site template "t-…" (content/templates/t-….json: Duplicate preset makes one)
 * handmade     true: items come from config.items (Hand-made); omit/false: from the source
 * items        hand-made entries [{ title, photo?, link?, source?, unit? }]; kept when switching
 *              back to From a source (and source is kept when switching to Hand-made)
 * arrangement  Grid | Carousel (Layout tab: a button group).
 * columns      "1"–"6" (two on a tablet, one on a phone). Row preset defaults to "1", others "3".
 * gap          between the items: a whole number of the page's cells (the grid the List sits
 *              on: --cell), 0 (default) the items side by side; the space inside an item is its
 *              template's
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
import {
  html,
  esc,
  editable,
  itemHref,
  pad,
  warnOnce,
  creditOf,
  creditText,
} from '../../helpers.js';
import { contentPath } from '../../files.js';
import { isObject } from '../../is.js';
import { t } from '../../strings.js';
import { keysOf, resolveWidget } from '../../layout/bindings.js';
import { hideMissing, missingState } from '../../layout/missing.js';
import { partEmpty } from '../../layout/parts.js';
import { WIDGET_TYPES } from '../index.js';
import { sourcePage } from '../data.js';
import {
  MAPPABLE,
  PRESETS,
  PRESET_IDS,
  factsRuns,
  mappingRows,
  presetWidgets,
  presetOf,
  templateOf,
} from './presets.js';
import { isTemplateId } from '../../files.js';
import { HANDMADE_ITEM, handmadeItemProblem, handmadeItemsOf, isHandmade } from './handmade.js';
import { presetStyle, styleMarkup } from './item-style.js';
import { itemGridHtml } from './item-grid-render.js';
import { itemSection, itemWidgets } from './item-grid.js';
import { detailsOf, nameOf, opensHtml, toggleHtml } from './details.js';
import { innerItems, innerKeys } from './nested.js';
import { CAROUSEL, carouselHtml, carouselOf, carouselProblems } from './carousel.js';

// the Carousel settings' rows (Layout tab): always shown, disabled unless Carousel
const onlyCarousel = (config) => config?.arrangement !== 'carousel';
const CAROUSEL_ROWS = [
  { key: 'counter', label: 'Counter', type: 'boolean' },
  {
    key: 'thumbnails',
    label: 'Thumbnails',
    type: 'select',
    options: [
      ['photos', 'Photos'],
      ['numbers', 'Numbers'],
      ['none', 'None'],
    ],
  },
  { key: 'arrows', label: 'Arrows', type: 'boolean' },
  { key: 'credit', label: 'Credit', type: 'boolean' },
  {
    key: 'slideRatio',
    label: 'Slide ratio',
    type: 'select',
    options: CAROUSEL.slideRatio.map((r) => [r, r === 'auto' ? 'Auto (tallest photo)' : r]),
  },
  { key: 'alsoGrid', label: 'Also as a grid', type: 'boolean' },
  { key: 'deepLink', label: 'Open slide from #n', type: 'boolean' },
].map((r) => ({ ...r, tab: 'layout', disabledWhen: onlyCarousel }));

const COLUMNS = ['1', '2', '3', '4', '5', '6'];
/** The most cells between a List's items (config.gap). */
export const MAX_GAP = 24;
/** A List's gap in cells (config.gap): a whole number from 0, else 0. */
export const gapOf = (c) => (Number.isInteger(c?.gap) && c.gap >= 0 ? Math.min(c.gap, MAX_GAP) : 0);
/** What is wrong with a List's config.gap, '' when nothing (left out: 0). */
export const gapProblem = (gap) =>
  gap === undefined || (Number.isInteger(gap) && gap >= 0 && gap <= MAX_GAP)
    ? ''
    : `config.gap must be a whole number of cells from 0 to ${MAX_GAP} (0: the items side by side)`;
/** A phone's columns (config.phoneColumns; left out: 1). */
const PHONE_COLUMNS = ['1', '2', '3'];

/** One widget of an item's template, filled from `item` (scope); '' when it is left out. */
function itemWidget(w, ctx, scope, { hide, api, cls = '' }) {
  const def = WIDGET_TYPES[w.type];
  // Summary and details: its +/× (./details.js)
  if (w.type === 'details') return { html: toggleHtml(w), missing: [] };
  if (w.type === 'list') {
    // an inner List (./nested.js): its items from this item; a third level never renders
    if (api.depth >= 2) {
      warnOnce(
        `${contentPath(api.file)}: List ${api.id}: a list inside a list's template can't hold another list (two levels at most)`,
        'layout',
      );
      return { html: '', missing: [] };
    }
    const { source, items } = innerItems(ctx, w.source, scope.item);
    const out = def.render(w, ctx, {
      id: `${api.id}-${w.role || 'list'}`,
      file: api.file,
      source,
      items,
      item: items[0] ?? null,
      index: 0,
      indexOf: (it) => items.indexOf(it),
      parent: scope.item,
      keys: innerKeys(w.source),
      depth: 2,
      ed: () => '',
    });
    return {
      html: `<div class="li__w li__inner${w.role ? ` li__${w.role}` : ''}">${out}</div>`,
      missing: [],
    };
  }
  const gone = missingState(ctx, w, def, scope, { hide });
  if (gone.skip) return { html: '', missing: gone.missing };
  const data = resolveWidget(w, def, { ...scope, placeholders: editable });
  const out = def.render(data, ctx, { ...api, scopeItems: scope.items, ed: () => '' });
  return {
    html: `<div class="li__w${w.role ? ` li__${w.role}` : ''}${cls}"${gone.attr}>${out}</div>`,
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
  // a template's joined line ("join": " · "): its properties with a value, the join between
  // them only (an empty one takes no separator with it)
  if (typeof w.join === 'string' && w.body?.[0]) {
    const names = (w.body[0].text || []).filter((r) => r?.property).map((r) => r.property);
    const { join, ...rest } = w;
    return {
      ...rest,
      body: [
        { ...w.body[0], text: factsRuns(names, (p) => partEmpty(p, scope), join) },
        ...w.body.slice(1),
      ],
    };
  }
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
  // (a site template names its properties itself: no rows)
  mapping: (ctx, widget) =>
    widget?.config?.handmade === true || isTemplateId(widget?.config?.template)
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
      label: 'Template',
      type: 'select',
      // the Content tab's template picker (ListLead.svelte): presets, then the site's templates
      lead: true,
      // besides the presets: a site template (content/templates/t-….json)
      also: isTemplateId,
      options: PRESETS.map((p) => [p.id, p.label]),
    },
    { key: 'seeAll', label: 'See all link', type: 'boolean' },
    {
      key: 'arrangement',
      label: 'Arrangement',
      type: 'seg',
      tab: 'layout',
      default: 'grid',
      options: [
        ['grid', 'Grid'],
        ['carousel', 'Carousel'],
      ],
    },
    {
      key: 'columns',
      label: 'Columns',
      type: 'select',
      tab: 'layout',
      width: 'half',
      options: COLUMNS.map((n) => [n, n]),
      // per layout (the editor's phone view): its phone value under its own key
      phone: {
        key: 'phoneColumns',
        label: 'Phone columns',
        options: PHONE_COLUMNS.map((n) => [n, n]),
        default: '1',
      },
    },
    {
      key: 'gap',
      label: 'Space between items',
      type: 'number',
      tab: 'layout',
      width: 'half',
      // a whole number of the page's cells (0: side by side; WidgetLayout.svelte)
      min: 0,
      max: MAX_GAP,
    },
    ...CAROUSEL_ROWS,
  ],
  defaults: {
    heading: '',
    source: { mode: 'all', from: 'people' },
    config: {
      template: 'preset:card',
      arrangement: 'grid',
      columns: '3',
      seeAll: false,
    },
    motion: { animation: 'grid-reveal' },
  },
  // arrangement "rows" is gone; hand-made items shape
  check: (widget) => {
    const out = [];
    if (widget.config?.arrangement === 'rows')
      out.push(
        'config.arrangement "rows" is gone: write "columns": "1" (Arrangement: "grid" or "carousel")',
      );
    out.push(...carouselProblems(widget.config));
    const gp = gapProblem(widget.config?.gap);
    if (gp) out.push(gp);
    if (
      widget.config?.handmade !== undefined &&
      widget.config.handmade !== true &&
      widget.config.handmade !== false
    )
      out.push('config.handmade must be true (Hand-made) or left out (From a source)');
    const tpl = widget.config?.template;
    if (tpl !== undefined && !PRESET_IDS.includes(tpl) && !isTemplateId(tpl))
      out.push(
        `config.template must be a preset (${PRESET_IDS.join(', ')}) or a site template ("t-" and 4–12 letters or digits, content/templates)`,
      );
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
    // config.template: a preset ("preset:card"), or a site template ("t-…", content/templates)
    const own = templateOf(ctx, c.template);
    if (isTemplateId(c.template) && !own)
      warnOnce(
        `${contentPath(widget.file)}: List ${widget.id}: template "${c.template}" is missing (content/templates/${c.template}.json): it shows Card`,
        'layout',
      );
    // a template's look is its own style alone ("basedOn" is only a note); the columns'
    // default and the item class are Card's then
    const preset = presetOf(own ? 'preset:card' : c.template);
    const columns = COLUMNS.includes(String(c.columns)) ? String(c.columns) : preset.columns || '3';
    const gap = gapOf(c);
    const phoneCols = PHONE_COLUMNS.includes(String(c.phoneColumns)) ? String(c.phoneColumns) : '';
    // this List's choice; each item widget may override (hideMissing on its own config)
    const listHide = hideMissing(c);
    // items from layout (widgetItems: source list or resolved config.items)
    const items = widget.items || [];
    // {number}: every item's place in the List as shown ("01", "02" … "100"; an item's own
    // "number" property wins)
    const keys = new Set([
      ...(handmade
        ? ['title', 'photo', 'unit', 'count', 'source']
        : widget.keys || keysOf(ctx, source) || []),
      'number',
      'back',
      'credit',
      'creditUrl',
    ]);
    // {back}: the page around this one (a [param] page's), else the page of all of the source
    const back = ctx.route?.parent ?? (source ? sourcePage(ctx, source) : '') ?? '';
    const shape = own ? 'template' : preset.id.slice('preset:'.length);
    const sep = t(ctx, 'list.sep');
    // the template, once per List: its widgets (a site template's: its one section's), and
    // whether its photo sits apart from the text
    const template = own
      ? structuredClone(itemWidgets(own))
      : presetWidgets(preset.id, ctx, source, {
          open: t(ctx, 'list.open'),
          // an inner List on a property ({ photo, title, index } items): named as hand-made
          handmade: handmade || !!widget.keys,
          properties: c.properties,
        });
    // the photo an item shows: its template's first photo's property (its {credit} is that one's)
    const photoKey = template.find((w) => w?.type === 'photo')?.src?.[0]?.property || 'photo';
    const photoOfItem = (o) => (typeof o?.[photoKey] === 'string' ? o[photoKey] : undefined);
    const creditsOf = (o) => {
      const p = photoOfItem(o);
      if (!p) return {};
      const cr = creditOf(ctx, p);
      return { credit: creditText(cr), creditUrl: cr?.source || '' };
    };
    // Summary and details (./details.js): the template is the summary, the "details" widget
    // names the details' template (not in an inner List)
    const dw = own && (widget.depth || 1) < 2 ? detailsOf(own) : null;
    const detTpl = dw ? templateOf(ctx, dw.config?.template) : null;
    const opens = !!detTpl;
    const several = opens && dw.config?.several === true;
    const detailsTpl = opens ? structuredClone(itemWidgets(detTpl)) : [];
    const link = opens ? false : own ? own.clickable !== false : preset.link;
    // the item style (./item-style.js): the template's own, else the preset's
    const look = styleMarkup(own ? own.style : presetStyle(preset.id));
    const liClass = ['li', `li--${shape}`, ...look.cls].join(' ');
    const liStyle = look.vars ? ` style="${esc(look.vars)}"` : '';
    const photoFirst = !opens && !own && preset.photoFirst && template[0]?.type === 'photo';
    // See all: only From a source (hand-made has no single source page)
    const href = !handmade && source && c.seeAll ? sourcePage(ctx, source) : '';
    const siteTemplate = !!own; // (`own` below is each item's own properties)
    // its one section (./item-grid.js): an item's height (fit, or custom: at least its rows)
    const itemSec = own ? itemSection(own) : null;
    const detailsSec = detTpl ? itemSection(detTpl) : null;
    const missing = new Map(); // name -> how many items have no value for it
    const out = items.map((item, i) => {
      const at = widget.indexOf ? widget.indexOf(item) : i;
      const itemHrefLink = !handmade && item?.id ? { item: { source, id: item.id } } : undefined;
      const handmadeHref = handmade ? item.href || '' : '';
      // parent: an inner List's outer item ({ of: "parent" } parts, ./nested.js)
      const own = isObject(item) ? item : {};
      // {number}, {back}, a photo's {credit} / {creditUrl}: an item's own property wins
      const numbered = { number: pad(i + 1), back: back || '', ...creditsOf(own), ...own };
      const scope = { item: numbered, keys, sources: ctx.sources, items, parent: widget.parent };
      const api = {
        id: widget.id,
        file: widget.file,
        source,
        items: [numbered],
        item: numbered,
        index: at,
        parent: widget.parent,
        depth: widget.depth || 1,
      };
      const one = (w, cls = '') => {
        const filled = forItem(w, scope, itemHrefLink, sep, { handmade, href: handmadeHref });
        if (!filled) return { html: '', missing: [] };
        // item widgets inherit the List's missing choice unless they set their own
        const hide = filled.config?.missing !== undefined ? hideMissing(filled.config) : listHide;
        return itemWidget(filled, ctx, scope, { hide, api, cls });
      };
      const ws = [...template, ...detailsTpl].map((w) => one(w));
      ws.forEach((w) => w.missing.forEach((n) => missing.set(n, (missing.get(n) || 0) + 1)));
      const all = ws.map((w) => w.html);
      const parts = all.slice(0, template.length);
      const [first, ...rest] = parts;
      // "open": "first" (and the editor, so its details can be edited): the first item open
      const open = opens && i === 0 && (editable || dw.config?.open === 'first');
      // a site template: the item is a grid of its own, as a page's section (./item-grid.js)
      const inner = opens
        ? opensHtml(
            `${widget.id}-${i + 1}`,
            itemGridHtml(template, parts, itemSec),
            itemGridHtml(detailsTpl, all.slice(template.length), detailsSec),
            open,
            nameOf(dw.config?.screenReaderName, numbered),
          )
        : siteTemplate
          ? itemGridHtml(template, parts, itemSec)
          : photoFirst
            ? `${first}<div class="li__text">${rest.join('')}</div>`
            : `<div class="li__text">${parts.join('')}</div>`;
      const url = handmade ? handmadeHref : itemHrefLink ? itemHref(ctx, source, item) : '';
      const tag = link && url ? 'a' : 'div';
      const ref = tag === 'a' ? ` href="${esc(url)}"` : '';
      const opensAttr = opens
        ? ` data-opens${open ? ' data-open' : ''}${item?.slug ? ` data-slug="${esc(item.slug)}"` : ''}`
        : '';
      return `<${tag} class="${liClass}${opens ? ' li--opens' : ''}"${liStyle}${ref}${opensAttr} data-list-item data-anim-item>${inner}</${tag}>`;
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
    const gridHtml = `<div class="list__items list__items--grid" style="--list-cols:${columns}${gap ? `;--list-gap:${gap}` : ''}${phoneCols ? `;--list-mcols:${phoneCols}` : ''}" data-cols="${columns}"${opens ? ` data-opens="${several ? 'several' : 'one'}"` : ''}>${out.join('')}</div>`;
    const carousel = c.arrangement === 'carousel' && items.length && !opens;
    if (c.arrangement === 'carousel' && opens)
      warnOnce(
        `${contentPath(widget.file)}: List ${widget.id}: a template whose items open can't be a carousel: it shows as a grid`,
        'layout',
      );
    const set = carouselOf(c);
    const body = !items.length
      ? `<p class="list__empty label muted" data-list-empty>${esc(t(ctx, 'list.empty'))}</p>`
      : carousel
        ? carouselHtml(ctx, {
            id: widget.id,
            label: s.heading || t(ctx, 'carousel.carousel'),
            slides: out,
            items: items.map((it) => {
              const o = isObject(it) ? it : {};
              const own = { ...creditsOf(o), ...o };
              return { photo: photoOfItem(o), credit: own.credit, creditUrl: own.creditUrl };
            }),
            grid: set.alsoGrid ? gridHtml : '',
            set,
            t: (k, v) => t(ctx, k, v),
          })
        : gridHtml;
    return `<div class="list list--${shape}" data-arrangement="${carousel ? 'carousel' : 'grid'}" data-cols="${columns}">${head}${body}</div>`;
  },
};

export default list;
