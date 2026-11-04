/**
 * Bindings: a widget's field can show an item's values instead of its own, as parts
 * (./parts.js has the format):
 *
 *   "title": "Models"                              custom: the widget's own value
 *   "title": [{ "field": "name" }]                 the item's whole value (any field type: a
 *                                                  photo, a link, a list of photos), when the
 *                                                  types fit
 *   "title": [{ "field": "count" }, { "t": " photos" }]
 *                                                  text with fields (text fields only)
 *
 * The item: the first of the widget's source (./source.js: an item, the items of a list, the
 * ones From URL matches). A name that is no field of the item but a source's id is that
 * source's list (its length as text). A name that is neither is an 'error' (bindingProblems:
 * Save refuses it, the build stops); a field the item has empty is missing (its part empty;
 * every field part missing: the widget isn't rendered, ./index.js). Values are escaped by the
 * widgets as before: the resolver only swaps values (resolveWidget, applied to every widget
 * before it renders).
 *
 * Which fields can bind: every field of a widget type (src/site/widgets/index.js) and its
 * config's text fields (links); a list of { src } binds to a photos field as a whole; in a list
 * of objects, each text subkey can be bound; the Text widget's lines hold field runs (../text.js).
 * BIND_TYPES (../field-types.js) says which source field types fit each widget field type.
 */
import { schemaOf } from '../schemas.js';
import { contentPath, pageFile } from '../files.js';
import { isObject } from '../is.js';
import { eachWidget } from './ids.js';
import { MODES, sourceOf } from './source.js';
import { BIND_TYPES, TEXT_TYPES } from '../field-types.js';
import { isFieldPart, isParts, isWhole, partMissing, partText } from './parts.js';

/**
 * The bind type of a field definition: its type, 'link' for a config link field,
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

/** The field keys of a source (its schema), null without a source. */
export const keysOf = (ctx, source) =>
  source ? new Set((schemaOf(ctx, source)?.fields || []).map((f) => f.key)) : null;

const empty = (def) => (def?.list ? [] : def?.type === 'number' ? undefined : '');

/**
 * `value` of a field (def: its registry definition) with the item's values in it (scope: { item,
 * sources }). placeholders (the editor's preview): a missing part of a text shows {name}.
 */
export function resolve(value, { def, placeholders = false, ...scope } = {}) {
  const text = TEXT_TYPES.includes(def?.type || 'text') && !def?.list;
  if (isParts(value)) {
    if (isWhole(value) && !text) {
      const name = value[0].field;
      const v = partMissing(value[0], scope) ? empty(def) : scope.item?.[name];
      if (v === undefined) return empty(def);
      // an item's photo paths in a list of { src } (e.g. the hero's placed photos)
      return Array.isArray(v) && isObject(def?.list) ? v.map((src) => ({ src })) : v;
    }
    return value
      .map((p) =>
        isFieldPart(p) ? partText(p, scope) || (placeholders && text ? `{${p.field}}` : '') : p.t,
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
 * Every field part of a widget: [{ path, part, type }], path from the widget (['title'],
 * ['config', 'link'], ['meta', 0, 'value'], ['body', 1, 'text', 2] for a Text line's run),
 * type: the bind type of a whole value (bindTypeOf), 'text' for a part of a text.
 */
export function fieldPartsOf(widget, t) {
  const out = [];
  const add = (path, v, type) => {
    if (!isParts(v)) return;
    const whole = isWhole(v);
    v.forEach((part, k) => {
      if (isFieldPart(part))
        out.push({ path: whole ? path : [...path, k], part, type: whole ? type : 'text', whole });
    });
  };
  for (const f of t?.fields || []) {
    const v = widget?.[f.key];
    // rich text (../text.js): its field runs show the item's fields as text
    if (f.type === 'rich' && Array.isArray(v)) {
      v.forEach((line, i) =>
        (Array.isArray(line?.text) ? line.text : []).forEach((r, k) => {
          if (isFieldPart(r)) out.push({ path: [f.key, i, 'text', k], part: r, type: 'text' });
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
 * The names a widget's field parts miss (scope: { item, sources }): { parts, missing } (how
 * many field parts it has, the missing names in order, each once). Every part missing: the
 * widget isn't rendered on the site.
 */
export function missingOf(widget, t, scope) {
  const uses = fieldPartsOf(widget, t);
  const missing = [
    ...new Set(uses.filter((u) => partMissing(u.part, scope)).map((u) => u.part.field)),
  ];
  return {
    parts: uses.length,
    all: uses.length > 0 && uses.every((u) => partMissing(u.part, scope)),
    missing,
  };
}

/**
 * A widget with its fields' and config links' parts resolved (scope: { item, sources }; the
 * widget as it is when nothing is bound, so widgets without bindings render exactly as before).
 */
export function resolveWidget(widget, t, { placeholders = false, ...scope }) {
  const values = [
    ...(t?.fields || []).map((f) => widget?.[f.key]),
    ...Object.values(widget?.config || {}),
  ];
  const has = values.some(
    (v) =>
      isParts(v) ||
      (Array.isArray(v) && v.some((e) => isObject(e) && Object.values(e).some(isParts))),
  );
  if (!has) return widget;
  const out = { ...widget };
  for (const f of t.fields || [])
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
 * source that isn't a source, a field part whose name is neither a field of its source nor a
 * source (with or without a source), a whole value of a type that doesn't fit. 'warn': a
 * widget's item that isn't in its source. files: only pages of these files (all: null).
 */
export function bindingProblems(content, { types, files = null }) {
  const out = [];
  for (const [id, page] of Object.entries(content?.pages || {})) {
    const file = pageFile(id);
    if (files && !files.has(file)) continue;
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
          problem('warn', `source: "${s.id}" is not in ${s.from}: its bound fields are empty`);
      }
      const uses = fieldPartsOf(widget, t);
      const fields = s ? schemaOf(content, s.from)?.fields || [] : [];
      for (const u of uses) {
        const name = u.path.join('.');
        const key = u.part.field;
        const f = fields.find((x) => x.key === key);
        // not a field of its item: a source's list (its length: text only), else unknown
        if (!f) {
          if (!Array.isArray(content.sources?.[key]))
            problem(
              'error',
              s
                ? `${name}: ${s.from} has no field "${key}" (and there is no source "${key}")`
                : `${name}: "${key}" is not a source (and the widget has no source for its fields: pick one in its Content tab)`,
            );
          else if (u.type !== 'text' && !TEXT_TYPES.includes(u.type))
            problem('error', `${name}: the source ${key} (a list) only fits a text field`);
        } else if (u.whole && !(BIND_TYPES[u.type] || []).includes(f.type))
          problem(
            'error',
            `${name}: ${s.from}.${key} (${f.type}) doesn't fit a ${u.type || 'list'} field`,
          );
      }
    }
  }
  return out;
}
