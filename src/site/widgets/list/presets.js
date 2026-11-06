/**
 * The List widget's presets (./index.js): ready-made item templates, in code. A preset is a
 * column of ordinary widgets (Photo, Text, Button) whose values are parts
 * (../../layout/parts.js), so each copy fills from its own item. Which property each part
 * names comes from the source's schema (Property mapping, later, will let a List change them):
 *
 *   title   the schema's title property ("title" when it names none)
 *   photo   its first photo property (cover, photo)
 *   facts   the properties it shows under an item's title in its lists (`list: true`)
 *   count   its first photos property: a list, so a part shows its length
 *   body    its first multi-line property
 *
 * A widget the source has nothing for is left out (a source without a photo property: no
 * photo). `role` names each widget's place in the preset's look (style.scss: .li__<role>).
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

/**
 * Property mapping (config.properties, e.g. { "photo": "cover" }): the roles a List can map to
 * one of its source's properties, and the property types each takes. Facts are the schema's
 * `list` properties (not mapped).
 */
export const MAPPABLE = Object.freeze({
  title: ['text', 'words', 'multiline', 'number'],
  photo: ['photo'],
  count: ['photos'],
  body: ['multiline'],
});

/** A source's properties ([] for none / no source). */
const propsOf = (ctx, source) => (source && schemaOf(ctx, source)?.properties) || [];

/**
 * config.properties kept to what it can mean for this source: known roles naming a property of
 * the source of a type that role takes (anything else is ignored, so the defaults apply).
 */
export function mappingOf(ctx, source, properties) {
  if (!isObject(properties)) return {};
  const props = propsOf(ctx, source);
  const out = {};
  for (const [role, key] of Object.entries(properties)) {
    const p = MAPPABLE[role] && typeof key === 'string' && props.find((x) => x.key === key);
    if (p && MAPPABLE[role].includes(p.type)) out[role] = key;
  }
  return out;
}

/** Each role's default: the schema's title property, its first photo / photos / long text. */
function defaultsOf(ctx, source) {
  const props = propsOf(ctx, source);
  const first = (type) => props.find((p) => p.type === type)?.key ?? null;
  const title = (source && schemaOf(ctx, source)?.title) || 'title';
  return { title, photo: first('photo'), count: first('photos'), body: first('multiline') };
}

/**
 * The properties a preset fills: the source's schema defaults, then its mapping
 * (config.properties) over them; HANDMADE_NAMES when `handmade` (its item shape is fixed: no
 * mapping).
 */
export function namesOf(ctx, source, { handmade = false, properties } = {}) {
  if (handmade) return { ...HANDMADE_NAMES };
  const props = propsOf(ctx, source);
  const n = { ...defaultsOf(ctx, source), ...mappingOf(ctx, source, properties) };
  return {
    ...n,
    facts: props.filter((p) => p.list && p.key !== n.title).map((p) => p.key),
  };
}

/**
 * The Content tab's mapping rows for a preset on a source ("Template needs photo" → a property):
 * one per mappable role the preset uses, in its order: { role, label, value, options, show }.
 * show: the source lacks the role's default (none of that type, or the title property isn't
 * one of its properties) or it is mapped (so it can be changed back). value: the mapped
 * property ('' when unmapped); options [[key, label]]: the source's properties of a type the
 * role takes.
 */
export function mappingRows(ctx, source, presetId, properties) {
  if (!source) return [];
  const props = propsOf(ctx, source);
  const defaults = defaultsOf(ctx, source);
  const mapped = mappingOf(ctx, source, properties);
  return presetOf(presetId)
    .roles.filter((r) => MAPPABLE[r])
    .map((role) => {
      const d = defaults[role];
      const lacks = !d || !props.some((p) => p.key === d);
      const value = mapped[role] || '';
      return {
        role,
        label: `Template needs ${role}`,
        value,
        options: props
          .filter((p) => MAPPABLE[role].includes(p.type))
          .map((p) => [p.key, p.label || p.key]),
        show: lacks || !!value,
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
