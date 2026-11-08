/**
 * Bindings: a widget's setting can show an item's properties instead of its own value, as
 * parts (./parts.js has the format):
 *
 *   "title": "Models"                              custom: the widget's own value
 *   "title": [{ "property": "name" }]              the item's whole value (any property type:
 *                                                  a photo, a link, a list of photos), when
 *                                                  the types fit
 *   "title": [{ "property": "count" }, { "t": " photos" }]
 *                                                  text with properties (text settings only)
 *
 * The item: the first of the widget's source (./source.js: an item, the items of a list, the
 * ones From URL matches). A name that is no property of the item's schema but a source's id is
 * that source's list (its length as text). A name that is neither is an 'error'
 * (bindingProblems: Save refuses it, the build stops). A property the item has empty (missing,
 * null, '') leaves its part empty; every property part of a widget empty: the widget isn't on
 * the published page (./index.js). Values are escaped by the widgets as before: the resolver
 * only swaps values (resolveWidget, applied to every widget before it renders).
 *
 * Which settings can bind: every setting of a widget type (src/site/widgets/index.js
 * `settings`) and its config's links; a list of { src } binds to a photos property as a whole;
 * in a list of objects, each text subkey can be bound; the Text widget's lines hold property
 * runs (../text.js). BIND_TYPES (../property-types.js) says which property types fit each
 * setting type.
 */
import { schemaOf } from '../schemas.js';
import { contentPath, isTemplateId, pageFile, templateIdOf } from '../files.js';
import { isObject } from '../is.js';
import { eachWidget } from './ids.js';
import { MODES, sourceOf } from './source.js';
import { BIND_TYPES, TEXT_TYPES } from '../property-types.js';
import { flatWidgets, holdsCarousel, nestingProblems } from '../widgets/list/nested.js';
import { detailsOf, detailsWarnings } from '../widgets/list/details.js';
import {
  ITEMS,
  isPropertyPart,
  isParts,
  isWhole,
  partEmpty,
  partLabel,
  partText,
  scopeFor,
} from './parts.js';

/**
 * The bind type of a setting's definition: its type, 'link' for a config link,
 * 'photos' for a list of { src } objects; null when it can't bind as a whole (other lists).
 */
export function bindTypeOf(def, { config = false } = {}) {
  if (!def) return null;
  if (config) return def.type === 'link' ? 'link' : null;
  if (def.type === 'seg' || def.type === 'spot') return null; // a choice of looks: nothing to bind
  if (!def.list) return def.type || 'text';
  if (def.list === 'photo') return 'photos';
  return def.list.src === 'photo' ? 'photos' : null;
}

/** The property keys of a source (its schema), null without a source. */
export const keysOf = (ctx, source) =>
  source ? new Set((schemaOf(ctx, source)?.properties || []).map((f) => f.key)) : null;

const empty = (def) => (def?.list ? [] : def?.type === 'number' ? undefined : '');

/**
 * `value` of a setting (def: its registry definition) with the item's properties in it (scope:
 * { item, keys, sources }). placeholders (the editor's preview): an empty part of a text shows
 * {name}.
 */
export function resolve(value, { def, placeholders = false, ...scope } = {}) {
  const text = TEXT_TYPES.includes(def?.type || 'text') && !def?.list;
  if (isParts(value)) {
    if (isWhole(value) && !text) {
      const name = value[0].property;
      const v = partEmpty(value[0], scope) ? empty(def) : scopeFor(value[0], scope).item?.[name];
      if (v === undefined) return empty(def);
      // an item's photo paths in a list of { src } (e.g. the hero's placed photos)
      return Array.isArray(v) && isObject(def?.list) ? v.map((src) => ({ src })) : v;
    }
    return value
      .map((p) =>
        isPropertyPart(p) ? partText(p, scope) || (placeholders && text ? partLabel(p) : '') : p.t,
      )
      .join('');
  }
  if (Array.isArray(value) && isObject(def?.list))
    return value.map((entry) =>
      isObject(entry)
        ? Object.fromEntries(
            Object.entries(entry).map(([k, v]) => {
              const sub = def.list[k];
              const type = isObject(sub) ? sub.type : sub;
              return [k, resolve(v, { ...scope, def: { type }, placeholders })];
            }),
          )
        : entry,
    );
  return value;
}

/**
 * Every property part of a widget: [{ path, part, type, whole }], path from the widget (['title'],
 * ['config', 'link'], ['meta', 0, 'value'], ['body', 1, 'text', 2] for a Text line's run),
 * type: the bind type of a whole value (bindTypeOf), 'text' for a part of a text.
 */
export function propertyPartsOf(widget, t) {
  const out = [];
  const add = (path, v, type) => {
    if (!isParts(v)) return;
    const whole = isWhole(v);
    v.forEach((part, k) => {
      if (isPropertyPart(part))
        out.push({ path: whole ? path : [...path, k], part, type: whole ? type : 'text', whole });
    });
  };
  for (const f of t?.settings || []) {
    const v = widget?.[f.key];
    // rich text (../text.js): its property runs show the item's properties as text
    if (f.type === 'rich' && Array.isArray(v)) {
      v.forEach((line, i) =>
        (Array.isArray(line?.text) ? line.text : []).forEach((r, k) => {
          if (isPropertyPart(r)) out.push({ path: [f.key, i, 'text', k], part: r, type: 'text' });
        }),
      );
      continue;
    }
    add([f.key], v, bindTypeOf(f));
    if (Array.isArray(v) && isObject(f.list))
      v.forEach((e, i) =>
        Object.entries(isObject(e) ? e : {}).forEach(([k, sv]) => {
          const sub = f.list[k];
          add([f.key, i, k], sv, (isObject(sub) ? sub.type : sub) || 'text');
        }),
      );
  }
  for (const c of t?.config || [])
    add(['config', c.key], widget?.config?.[c.key], bindTypeOf(c, { config: true }));
  return out;
}

/**
 * The names of a widget's property parts that are empty (missing, null, '': ./parts.js isEmpty;
 * scope: { item, keys, sources }): { parts, all, missing } (how many property parts it has,
 * whether all are empty, the empty names in order, each once). All empty: the widget isn't on
 * the published page; the editor dims it.
 */
export function missingOf(widget, t, scope) {
  const uses = propertyPartsOf(widget, t);
  const missing = [
    ...new Set(uses.filter((u) => partEmpty(u.part, scope)).map((u) => u.part.property)),
  ];
  return {
    parts: uses.length,
    all: uses.length > 0 && uses.every((u) => partEmpty(u.part, scope)),
    missing,
  };
}

/**
 * A widget with its settings' and config links' parts resolved (scope: { item, keys, sources }; the
 * widget as it is when nothing is bound, so widgets without bindings render exactly as before).
 */
export function resolveWidget(widget, t, { placeholders = false, ...scope }) {
  const values = [
    ...(t?.settings || []).map((f) => widget?.[f.key]),
    ...Object.values(widget?.config || {}),
  ];
  const has = values.some(
    (v) =>
      isParts(v) ||
      (Array.isArray(v) && v.some((e) => isObject(e) && Object.values(e).some(isParts))),
  );
  if (!has) return widget;
  const out = { ...widget };
  for (const f of t.settings || [])
    if (out[f.key] !== undefined && f.type !== 'rich')
      out[f.key] = resolve(out[f.key], { ...scope, def: f, placeholders });
  if (isObject(widget.config)) {
    out.config = { ...widget.config };
    for (const c of t.config || [])
      if (c.type === 'link' && out.config[c.key] !== undefined)
        out.config[c.key] = resolve(out.config[c.key], { ...scope, def: { type: 'link' } });
  }
  return out;
}

/**
 * Schema-aware checks of every page's widgets' sources and bindings (content:
 * contentFromFiles()): [{ level, message }]. 'error' (Save refuses, the build stops): a widget's
 * source that isn't a source, a property part whose name is neither a property of its source
 * nor a source (with or without a source), a whole value of a type that doesn't fit. 'warn': a
 * widget's item that isn't in its source. files: only pages of these files (all: null).
 */
export function bindingProblems(content, { types, files = null }) {
  const out = [];
  for (const [id, page] of Object.entries(content?.pages || {})) {
    const file = pageFile(id);
    if (files && !files.has(file)) continue;
    const deep = { n: 0 }; // deep-linked Lists on this page (one at most)
    for (const [widget, , at, j] of eachWidget(page?.sections)) {
      const t = types[widget?.type];
      if (!t || !isObject(widget)) continue;
      const where = `${contentPath(file)} (sections/${at}/widgets/${j})`;
      const problem = (level, msg) => out.push({ level, message: `${where}: ${msg}` });
      const s = sourceOf(widget);
      if (widget.source !== undefined && !s) {
        problem(
          'error',
          `source: { "mode": ${MODES.map((m) => `"${m}"`).join(' | ')}, "from": "<source>" }`,
        );
        continue;
      }
      if (s) {
        const list = content.sources?.[s.from];
        if (!Array.isArray(list)) {
          problem('error', `source: "${s.from}" is not a source`);
          continue;
        }
        if (s.mode === 'item' && !list.some((it) => it?.id === s.id))
          problem('warn', `source: "${s.id}" is not in ${s.from}: its bound settings are empty`);
      }
      if (widget.type === 'list') carouselChecks(content, widget, problem, deep);
      const uses = propertyPartsOf(widget, t);
      const props = s ? schemaOf(content, s.from)?.properties || [] : [];
      for (const u of uses) {
        const name = u.path.join('.');
        const key = u.part.property;
        const f = props.find((x) => x.key === key);
        // not a property of its item: a source's list (its length: text only), else unknown
        // {items}: a list widget's own items (./parts.js), a list: text only
        if (!f && key === ITEMS && t.list) {
          if (u.type !== 'text' && !TEXT_TYPES.includes(u.type))
            problem('error', `${name}: {items} (a list) only fits a text setting`);
        } else if (!f) {
          if (!Array.isArray(content.sources?.[key]))
            problem(
              'error',
              s
                ? `${name}: ${s.from} has no property "${key}" (and there is no source "${key}")`
                : `${name}: "${key}" is not a source (and the widget has no source for its properties: pick one in its Content tab)`,
            );
          else if (u.type !== 'text' && !TEXT_TYPES.includes(u.type))
            problem('error', `${name}: the source ${key} (a list) only fits a text setting`);
        } else if (u.whole && !(BIND_TYPES[u.type] || []).includes(f.type))
          problem(
            'error',
            `${name}: ${s.from}.${key} (${f.type}) doesn't fit a ${u.type || 'list'} setting`,
          );
      }
    }
  }
  // nested Lists (widgets/list/nested.js): loops and a third level, across the templates
  if (!files || [...files].some((f) => templateIdOf(f))) {
    out.push(...nestingProblems(content?.templates), ...detailsWarnings(content?.templates));
    for (const [id, tpl] of Object.entries(content?.templates || {}))
      for (const w of flatWidgets(tpl))
        if (w?.type === 'list')
          carouselChecks(content, w, (level, msg) =>
            out.push({ level, message: `templates/${id}.json: ${msg}` }),
          );
  }
  return out;
}

/** A List shown as a carousel (widgets/list/carousel.js): what its template allows. */
function carouselChecks(content, widget, problem, deep = null) {
  const c = widget.config;
  if (c?.arrangement !== 'carousel') return;
  if (deep && c.deepLink === true && ++deep.n === 2)
    problem(
      'error',
      'deepLink: one List per page opens a slide from #n (another one already does)',
    );
  const tpl = isTemplateId(c.template) ? content?.templates?.[c.template] : null;
  if (!tpl) return;
  if (detailsOf(tpl))
    problem(
      'error',
      `config.template: a carousel can't use items that open (${tpl.label || c.template} opens)`,
    );
  if (holdsCarousel(tpl))
    problem(
      'error',
      `config.template: no carousel inside a carousel (${tpl.label || c.template} holds one)`,
    );
  if ((c.thumbnails ?? 'photos') === 'photos' && !flatWidgets(tpl).some((w) => w?.type === 'photo'))
    problem(
      'warn',
      `thumbnails: "photos" but ${tpl.label || c.template} has no photo: its thumbnails show numbers`,
    );
}
