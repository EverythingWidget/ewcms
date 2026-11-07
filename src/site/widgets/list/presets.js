/**
 * The List widget's presets (./index.js): ready-made item templates, in code. A preset is a
 * column of ordinary widgets (Photo, Text, Button) whose values are parts
 * (../../layout/parts.js), so each copy fills from its own item. Which property each role
 * shows is the List's property mapping (config.properties, one row per role in the Content
 * tab), else the property of the role's own name when it has a type the role takes:
 *
 *   title   the schema's declared title property ("title" when it names none; text, words,
 *           multi-line or number)
 *   photo   "photo" (a photo)
 *   body    "body" (multi-line)
 *   facts   the properties it shows under an item's title in its lists (`list: true`)
 *   count   a plain bound count: {photos} (a list, so a part shows its length); not mapped
 *
 * Nothing is guessed (no "first photo property"): a role with neither is left out until it is
 * mapped. `role` names each widget's place in the preset's look (style.scss: .li__<role>).
 *
 *   Card   photo on top, title, facts (Album cards, the places' cards)
 *   Plain  photo, title, body, a button to the item's page; no box
 *   Panel  a big photo, title and count over it (photo tiles, Photo panels)
 *   Row    a small photo left, title and facts right (Project list)
 */
import { schemaOf } from '../../schemas.js';
import { isObject } from '../../is.js';

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
];
export const PRESET_IDS = PRESETS.map((p) => p.id);

/** A preset by id (an unknown id: Card). */
export const presetOf = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];

/** Hand-made List items (no List-level source): title, photo, and Panel's count. */
export const HANDMADE_NAMES = Object.freeze({
  title: 'title',
  photo: 'photo',
  facts: [],
  count: 'count',
  body: null,
});

/** The plain bound count a source's Panel shows: {photos}. */
export const COUNT_PROPERTY = 'photos';

/**
 * Property mapping (config.properties, e.g. { "photo": "cover" }): the roles a List maps to one
 * of its source's properties, and the property types each takes. Facts are the schema's `list`
 * properties and the count is {photos}: neither is mapped.
 */
export const MAPPABLE = Object.freeze({
  title: ['text', 'words', 'multiline', 'number'],
  photo: ['photo'],
  body: ['multiline'],
});
const ROLE_LABELS = { title: 'Title', photo: 'Photo', body: 'Text' };

/** A source's properties ([] for none / no source). */
const propsOf = (ctx, source) => (source && schemaOf(ctx, source)?.properties) || [];
const fits = (role, p) => !!p && MAPPABLE[role].includes(p.type);

/**
 * config.properties kept to what it can mean for this source: known roles naming a property of
 * the source of a type that role takes (anything else is ignored: the automatic choice applies).
 */
export function mappingOf(ctx, source, properties) {
  if (!isObject(properties)) return {};
  const props = propsOf(ctx, source);
  const out = {};
  for (const [role, key] of Object.entries(properties))
    if (
      MAPPABLE[role] &&
      typeof key === 'string' &&
      fits(
        role,
        props.find((x) => x.key === key),
      )
    )
      out[role] = key;
  return out;
}

/**
 * Each role's automatic choice, else null: Title the schema's declared title property, the
 * others the property of the role's own name; either only when its type fits the role.
 */
function autoOf(ctx, source) {
  const props = propsOf(ctx, source);
  const own = (role) =>
    role === 'title' ? (source && schemaOf(ctx, source)?.title) || 'title' : role;
  return Object.fromEntries(
    Object.keys(MAPPABLE).map((role) => {
      const key = own(role);
      return [
        role,
        fits(
          role,
          props.find((p) => p.key === key),
        )
          ? key
          : null,
      ];
    }),
  );
}

/**
 * The properties a preset fills: the automatic choices, then the mapping (config.properties)
 * over them; HANDMADE_NAMES when `handmade` (its item shape is fixed: no mapping).
 */
export function namesOf(ctx, source, { handmade = false, properties } = {}) {
  if (handmade) return { ...HANDMADE_NAMES };
  const props = propsOf(ctx, source);
  const n = { ...autoOf(ctx, source), ...mappingOf(ctx, source, properties) };
  return {
    ...n,
    facts: props.filter((p) => p.list && p.key !== n.title).map((p) => p.key),
    count: props.some((p) => p.key === COUNT_PROPERTY) ? COUNT_PROPERTY : null,
  };
}

/**
 * The Content tab's mapping rows for a preset on a source: one per mappable role the preset
 * uses, in its order, always shown: { role, label, value, auto, options, none }. value: the
 * property it shows (the mapping, else the automatic choice; '' for none); auto: the automatic
 * choice; options [[key, label]]: the source's properties of a type the role takes; none: the
 * row's text when there are no options ("No photo property in People").
 */
export function mappingRows(ctx, source, presetId, properties) {
  if (!source) return [];
  const props = propsOf(ctx, source);
  const auto = autoOf(ctx, source);
  const mapped = mappingOf(ctx, source, properties);
  const name = schemaOf(ctx, source)?.label || source;
  return presetOf(presetId)
    .roles.filter((r) => MAPPABLE[r])
    .map((role) => {
      const options = props.filter((p) => fits(role, p)).map((p) => [p.key, p.label || p.key]);
      return {
        role,
        label: ROLE_LABELS[role],
        value: mapped[role] || auto[role] || '',
        auto: auto[role] || '',
        options,
        none: options.length ? '' : `No ${role} property in ${name}`,
      };
    });
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
 * A preset's widgets for a source (ctx: the content), once per List. Each has its `role`
 * (style.scss .li__<role>); facts carry `facts` (their names, joined per item: factsRuns), the
 * button `itemLink` (its link is the item's page, set per item). Unknown id: Card's.
 */
export function presetWidgets(
  id,
  ctx,
  source,
  { open = 'View', handmade = false, properties } = {},
) {
  const n = namesOf(ctx, source, { handmade, properties });
  const make = {
    photo: () => n.photo && { type: 'photo', role: 'photo', src: [prop(n.photo)] },
    title: () => textW('title', line('heading', [prop(n.title)])),
    facts: () =>
      n.facts.length && { ...textW('facts', line('label', factsRuns(n.facts))), facts: n.facts },
    // handmade: per-item count from the pointed source + unit (forItem in ./index.js); marker
    // a plain bound count ({photos}); hand-made: the item's count + unit (forItem, ./index.js)
    count: () =>
      n.count &&
      (handmade
        ? { ...textW('count', line('label', [prop(n.count)])), handmadeCount: true }
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
 * its widgets as plain widgets with {property} parts, for the List's source as it shows now (its
 * mapping applied, facts joined with `sep`, a hand-made Panel's count as {count} {unit}). `from`
 * keeps where it came from; link and photoFirst are the preset's. A template's own widgets are
 * copied as they are.
 */
export function cloneTemplate(
  ctx,
  source,
  id,
  { handmade = false, properties, open = 'View', sep = ' · ', label } = {},
) {
  const own = templateOf(ctx, id);
  if (own)
    return {
      version: 1,
      kind: 'template',
      label: label || `${own.label || id} copy`,
      from: id,
      link: own.link !== false,
      photoFirst: own.photoFirst !== false,
      widgets: structuredClone(own.widgets),
    };
  const preset = presetOf(id);
  const widgets = presetWidgets(preset.id, ctx, source, { open, handmade, properties }).map((w) => {
    const { facts, handmadeCount, ...rest } = w;
    if (facts)
      return { ...rest, body: [{ ...rest.body[0], text: factsRuns(facts, () => false, sep) }] };
    if (handmadeCount)
      return {
        ...rest,
        body: [{ style: 'label', text: [prop('count'), { t: ' ' }, prop('unit')] }],
      };
    return rest;
  });
  return {
    version: 1,
    kind: 'template',
    label: label || `${preset.label} copy`,
    from: preset.id,
    link: preset.link,
    photoFirst: preset.photoFirst,
    widgets,
  };
}

/** A site template by id (config.template "t-…"), null when it isn't one or is missing. */
export const templateOf = (ctx, id) =>
  (typeof id === 'string' && id.startsWith('t-') && ctx?.templates?.[id]) || null;

/**
 * The preset whose look (li--<shape>, columns) a template has: its `from`, followed through
 * templates; Card when it names none.
 */
export function shapeOf(ctx, id, seen = new Set()) {
  const own = templateOf(ctx, id);
  if (!own) return presetOf(id);
  if (seen.has(id)) return PRESETS[0];
  seen.add(id);
  return shapeOf(ctx, own.from, seen);
}
