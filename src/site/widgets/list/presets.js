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

/** The presets, in the picker's order: [id, label, hint]. */
export const PRESETS = [
  ['preset:card', 'Card', 'Photo on top, title and facts'],
  ['preset:plain', 'Plain', 'Photo, title, text and a button; no box'],
  ['preset:panel', 'Panel', 'A big photo, title and count over it'],
  ['preset:row', 'Row', 'A small photo left, text right'],
];
export const PRESET_IDS = PRESETS.map(([id]) => id);

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

const prop = (property, format) => (format ? { property, format } : { property });
const line = (style, runs) => ({ style, text: runs });
const textW = (role, ...body) => ({ type: 'text', role, body });
// the facts on one line: "Model · Amsterdam"; a missing one takes its " · " with it
const factsRuns = (facts) => facts.map((k, i) => prop(k, i ? ' · {value}' : undefined));

/**
 * A preset's widgets for a source (ctx: the content; link: the item's page, as a link setting,
 * for Plain's button). Unknown id: Card's.
 */
export function presetWidgets(id, ctx, source, { link, open = 'View' } = {}) {
  const n = namesOf(ctx, source);
  const photo = n.photo && { type: 'photo', role: 'photo', src: [prop(n.photo)] };
  const title = textW('title', line('heading', [prop(n.title)]));
  const facts = n.facts.length && textW('facts', line('label', factsRuns(n.facts)));
  const count = n.count && textW('count', line('label', [prop(n.count)]));
  const body = n.body && textW('body', line('paragraph', [prop(n.body)]));
  const button = { type: 'button', role: 'button', label: open, config: { link } };
  const shapes = {
    'preset:card': [photo, title, facts],
    'preset:plain': [photo, title, body, button],
    'preset:panel': [photo, title, count],
    'preset:row': [photo, title, facts],
  };
  return (shapes[id] || shapes['preset:card']).filter(Boolean);
}
