/**
 * The List widget's presets (./index.js): ready-made item templates, in code. A preset is a
 * vertical stack of ordinary widgets (Photo, Text, Button) whose values are parts
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

/**
 * The presets, in the picker's order. Each is data the List reads (no preset names in its
 * render): `roles` its widgets top to bottom (one the source has nothing for is left out),
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
  },
  {
    id: 'preset:plain',
    label: 'Plain',
    hint: 'Photo, title, text and a button; no box',
    roles: ['photo', 'title', 'body', 'button'],
    link: false,
    photoFirst: true,
  },
  {
    id: 'preset:panel',
    label: 'Panel',
    hint: 'A big photo, title and count over it',
    roles: ['photo', 'title', 'count'],
    link: true,
    photoFirst: true,
  },
  {
    id: 'preset:row',
    label: 'Row',
    hint: 'A small photo left, text right',
    roles: ['photo', 'title', 'facts'],
    link: true,
    photoFirst: true,
  },
];
export const PRESET_IDS = PRESETS.map((p) => p.id);

/** A preset by id (an unknown id: Card). */
export const presetOf = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];

/** The properties a preset fills, from the source's schema: { title, photo, facts, count, body }. */
export function namesOf(ctx, source) {
  const props = (source && schemaOf(ctx, source)?.properties) || [];
  const first = (type) => props.find((p) => p.type === type)?.key ?? null;
  const title = (source && schemaOf(ctx, source)?.title) || 'title';
  return {
    title,
    photo: first('photo'),
    facts: props.filter((p) => p.list && p.key !== title).map((p) => p.key),
    count: first('photos'),
    body: first('multiline'),
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
 * A preset's widgets for a source (ctx: the content), once per List. Each has its `role`
 * (style.scss .li__<role>); facts carry `facts` (their names, joined per item: factsRuns), the
 * button `itemLink` (its link is the item's page, set per item). Unknown id: Card's.
 */
export function presetWidgets(id, ctx, source, { open = 'View' } = {}) {
  const n = namesOf(ctx, source);
  const make = {
    photo: () => n.photo && { type: 'photo', role: 'photo', src: [prop(n.photo)] },
    title: () => textW('title', line('heading', [prop(n.title)])),
    facts: () =>
      n.facts.length && { ...textW('facts', line('label', factsRuns(n.facts))), facts: n.facts },
    count: () => n.count && textW('count', line('label', [prop(n.count)])),
    body: () => n.body && textW('body', line('paragraph', [prop(n.body)])),
    button: () => ({ type: 'button', role: 'button', label: open, itemLink: true, config: {} }),
  };
  return presetOf(id)
    .roles.map((r) => make[r]())
    .filter(Boolean);
}
