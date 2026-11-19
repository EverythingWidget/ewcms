/**
 * The List widget's presets (./index.js): ready-made item templates, in code. A preset is a
 * column of ordinary widgets (Photo, Text, Button) whose values are parts
 * (../../layout/parts.js), so each copy fills from its own item. Each role shows the source's
 * property of the role's own name, when it has a type the role takes (a source naming it
 * otherwise, "cover" for a photo, gets a copy of the template that says {cover}: Duplicate):
 *
 *   title   the schema's declared title property ("title" when it names none; text, words,
 *           multi-line or number)
 *   photo   "photo" (a photo)
 *   body    "body" (multi-line)
 *   facts   the properties it shows under an item's title in its lists (`list: true`)
 *   count   a plain bound count: {photos} (a list, so a part shows its length)
 *
 * Nothing is guessed (no "first photo property"): a role with neither is left out.
 * `role` names each widget's place in the preset's look (style.scss: .li__<role>).
 *
 *   Card   photo on top, title, facts (the old Album cards, the places' cards)
 *   Plain  photo, title, body, a button to the item's page; no box
 *   Panel  a big photo, title and count over it (photo tiles, Photo panels)
 *   Row    a small photo left, title and facts right (project rows)
 *   Photo  a photo only: no text, no box (a photo grid, an inner List of an item's photos)
 */
import { gridStyle, itemSection, stackToGrid } from './item-grid.js';
import { newId } from '../../render/layout/ids.js';
import { schemaOf } from '../../render/schemas.js';
import { isObject } from '../../render/is.js';
import { presetStyle } from './item-style.js';

/**
 * The presets, in the picker's order. Each is data the List reads (no preset names in its
 * render): `roles` its widgets as a column (top to bottom) (one the source has nothing for is left out),
 * `link` whether the whole item is a link to the item's page (Plain has its own button
 * instead), `photoFirst` whether its photo sits apart from the text after it (.li__text).
 */
export const PRESETS = [
  {
    id: 'preset:card',
    label: 'Card',
    hint: 'Photo on top, title and facts',
    roles: ['photo', 'title', 'facts'],
    link: true,
    photoFirst: true,
    columns: '3',
  },
  {
    id: 'preset:plain',
    label: 'Plain',
    hint: 'Photo, title, text and a button; no box',
    roles: ['photo', 'title', 'body', 'button'],
    link: false,
    photoFirst: true,
    columns: '3',
  },
  {
    id: 'preset:panel',
    label: 'Panel',
    hint: 'A big photo, title and count over it',
    roles: ['photo', 'title', 'count'],
    link: true,
    photoFirst: true,
    columns: '3',
  },
  {
    id: 'preset:row',
    label: 'Row',
    hint: 'A small photo left, text right',
    roles: ['photo', 'title', 'facts'],
    link: true,
    photoFirst: true,
    columns: '1',
  },
  {
    id: 'preset:photo',
    label: 'Photo',
    hint: 'A photo only; no text, no box',
    roles: ['photo'],
    link: false,
    photoFirst: true,
    columns: '4',
  },
];
export const PRESET_IDS = PRESETS.map((p) => p.id);

/** A preset by id (an unknown id: Card). */
export const presetOf = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];

/** Custom List items (no List-level source): title, photo, and Panel's count. */
export const CUSTOM_NAMES = Object.freeze({
  title: 'title',
  photo: 'photo',
  facts: [],
  count: 'count',
  body: null,
});

/** The plain bound count a source's Panel shows: {photos}. */
export const COUNT_PROPERTY = 'photos';

/** The property types each named role takes (facts and the count are their own). */
const ROLE_TYPES = Object.freeze({
  title: ['text', 'words', 'multiline', 'number'],
  photo: ['photo'],
  body: ['multiline'],
});

/** A source's properties ([] for none / no source). */
const propsOf = (ctx, source) => (source && schemaOf(ctx, source)?.properties) || [];

/**
 * The properties a preset fills: each role the property of its own name (Title the schema's
 * declared title property) when its type fits, else null; CUSTOM_NAMES when `custom`.
 */
export function namesOf(ctx, source, { custom = false } = {}) {
  if (custom) return { ...CUSTOM_NAMES };
  const props = propsOf(ctx, source);
  const own = (role) =>
    role === 'title' ? (source && schemaOf(ctx, source)?.title) || 'title' : role;
  const n = Object.fromEntries(
    Object.entries(ROLE_TYPES).map(([role, types]) => {
      const p = props.find((x) => x.key === own(role));
      return [role, p && types.includes(p.type) ? p.key : null];
    }),
  );
  return {
    ...n,
    facts: props.filter((p) => p.list && p.key !== n.title).map((p) => p.key),
    count: props.some((p) => p.key === COUNT_PROPERTY) ? COUNT_PROPERTY : null,
  };
}

const prop = (property) => ({ property });
const line = (style, runs) => ({ style, text: runs });
const textW = (role, ...body) => ({ type: 'text', role, body });

/**
 * The facts' runs for one item: the properties that have a value, joined by `sep` ("Model ·
 * Amsterdam"; a missing one takes no separator with it, first or not). None has a value: all
 * of them, no separator, so the hide rule sees the widget as empty and names them.
 */
export function factsRuns(facts, isEmpty = () => false, sep = ' · ') {
  const shown = facts.filter((k) => !isEmpty(prop(k)));
  if (!shown.length) return facts.map(prop);
  return shown.flatMap((k, i) => (i ? [{ t: sep }, prop(k)] : [prop(k)]));
}

/**
 * A joined line's runs for one item (a template widget's "join"), keeping what was typed
 * around its properties (F40: " · €" before a price): the text between two properties is
 * their separator (none typed: `join`); the text before a property goes with it, so one
 * without a value takes its separator along (the first shown one: none before it). Text before the first or after
 * the last property stays (whitespace alone is dropped). None has a value: the properties
 * alone (as factsRuns), so the hide rule sees the line as empty.
 */
export function joinedRuns(runs, isEmpty = () => false, join = ' · ') {
  const props = [];
  const between = []; // between[i]: the text runs before props[i]
  let pending = [];
  for (const r of runs || []) {
    if (r?.property) {
      between.push(pending);
      props.push(r);
      pending = [];
    } else if (r) pending.push(r);
  }
  const lead = between[0] || [];
  const tail = pending;
  const shown = props.map((p, i) => [p, i]).filter(([p]) => !isEmpty(p));
  if (!shown.length) return props.map((p) => ({ ...p }));
  const sepBefore = (i) => (between[i]?.length ? between[i] : [{ t: join }]);
  const blank = (rs) => rs.every((r) => typeof r.t === 'string' && !r.t.trim());
  const out = blank(lead) ? [] : [...lead];
  shown.forEach(([p, i], k) => {
    if (k) out.push(...sepBefore(i)); // the text typed before it goes with it ("€" with the price)
    out.push(p);
  });
  if (!blank(tail)) out.push(...tail);
  return out;
}

/**
 * A preset's widgets for a source (ctx: the content), once per List. Each has its `role`
 * (style.scss .li__<role>); facts carry `facts` (their names, joined per item: factsRuns), the
 * button `itemLink` (its link is the item's page, set per item). Unknown id: Card's.
 */
export function presetWidgets(id, ctx, source, { open = 'View', custom = false } = {}) {
  const n = namesOf(ctx, source, { custom });
  const make = {
    photo: () => n.photo && { type: 'photo', role: 'photo', src: [prop(n.photo)] },
    title: () => textW('title', line('heading', [prop(n.title)])),
    facts: () =>
      n.facts.length && { ...textW('facts', line('label', factsRuns(n.facts))), facts: n.facts },
    // custom: per-item count from the pointed source + unit (forItem in ./index.js); marker
    // a plain bound count ({photos}); custom: the item's count + unit (forItem, ./index.js)
    count: () =>
      n.count &&
      (custom
        ? { ...textW('count', line('label', [prop(n.count)])), customCount: true }
        : textW('count', line('label', [prop(n.count)]))),
    body: () => n.body && textW('body', line('paragraph', [prop(n.body)])),
    button: () => ({ type: 'button', role: 'button', label: open, itemLink: true, config: {} }),
  };
  return presetOf(id)
    .roles.map((r) => make[r]())
    .filter(Boolean);
}

/**
 * A preset (or a site template) copied into a new item template (content/templates/t-….json):
 * its widgets as plain widgets with {property} parts, for the List's source as it shows now
 * (facts joined with `sep`, a custom Panel's count as {count} {unit}). `basedOn`
 * keeps where it came from; clickable is the preset's link. A template's own section is
 * copied as they are.
 */
export function cloneTemplate(
  ctx,
  source,
  id,
  { custom = false, open = 'View', sep = ' · ', label } = {},
) {
  const own = templateOf(ctx, id);
  if (own) {
    const from = own.preview?.from || (!custom && source) || '';
    const preview = {
      ...(from ? { from } : {}),
      ...(own.preview?.columns ? { columns: own.preview.columns } : {}),
    };
    return {
      version: 1,
      kind: 'template',
      name: label || `${own.name || id} copy`,
      basedOn: id,
      clickable: own.clickable !== false,
      ...(Object.keys(preview).length ? { preview } : {}),
      ...(isObject(own.style) && Object.keys(own.style).length
        ? { style: structuredClone(own.style) }
        : {}),
      sections: [{ ...structuredClone(itemSection(own) || {}), id: newId('s') }],
    };
  }
  const preset = presetOf(id);
  const taken = new Set();
  const widgets = presetWidgets(preset.id, ctx, source, { open, custom }).map((w) => {
    const { facts, customCount, ...rest } = w;
    if (facts)
      // join: the separator goes only between the facts that have a value (forItem, ./index.js)
      return {
        ...rest,
        join: sep,
        body: [{ ...rest.body[0], text: factsRuns(facts, () => false, sep) }],
      };
    if (customCount)
      return {
        ...rest,
        body: [{ style: 'label', text: [prop('count'), { t: ' ' }, prop('unit')] }],
      };
    return rest;
  });
  return {
    version: 1,
    kind: 'template',
    name: label || `${preset.label} copy`,
    basedOn: preset.id,
    clickable: preset.link,
    ...(!custom && source ? { preview: { from: source } } : {}),
    style: gridStyle(presetStyle(preset.id)),
    // the preset's stack on the template grid (./item-grid.js): its one section
    sections: [
      {
        id: newId('s', taken),
        widgets: stackToGrid(widgets, presetStyle(preset.id), () => newId('w', taken)),
      },
    ],
  };
}

/** A site template by id (config.template "t-…"), null when it isn't one or is missing. */
export const templateOf = (ctx, id) =>
  (typeof id === 'string' && id.startsWith('t-') && ctx?.templates?.[id]) || null;
