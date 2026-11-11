/**
 * Content checks, shared by the build, the dev server and the editor's Save (Node and browser).
 * Light on purpose: only the shapes the templates and the client rely on, so one bad value
 * gives a clear error naming the file instead of a broken site.
 *
 *   parseContent(text, file)   JSON.parse, with "content/<file>: invalid JSON … (line L, column C)"
 *   checkContent(file, data)   a list of problems ([] when fine), e.g. "footer must be an object"
 *
 * A source's items against its schema (required properties, types, photos) are checked by
 * checkItems (src/site/schemas.js): that needs the schema and the photos, not one file.
 */
import { detailsProblems, detailsWidgetProblems } from './widgets/list/details.js';
import { CAROUSEL_KEYS, carouselProblems } from './widgets/list/carousel.js';
import { AREA_KEYS, storesRows } from './layout/grid.js';
import { storedDefaults } from './defaults.js';
import {
  ANIMATIONS,
  NAV,
  PHOTOS,
  REDIRECTS,
  SITE,
  STRINGS,
  VERSION,
  isTemplate,
  isParamName,
  isSlug,
  pageIdOf,
  DOC_KINDS,
  docKindOf,
  schemaIdOf,
  sourceIdOf,
  contentPath,
  isTemplateId,
  templateIdOf,
} from './files.js';
import { CORE_STRINGS } from './strings.js';
import { checkSchema } from './schemas.js';
import { RETIRED_WIDGETS, WIDGET_TYPES } from './widgets/index.js';
import {
  COLS,
  HEIGHTS,
  MAX_MIN_ROWS,
  MCOLS,
  SIZES,
  WIDTHS,
  nameProblems,
  ratioOf,
} from './layout/index.js';
import { linkProblems } from './layout/links.js';
import { checkScale, checkTypography } from './layout/type.js';
import { checkPlacement } from './layout/place.js';
import { checkLayout } from './layout/contain.js';
import { isId } from './layout/ids.js';
import { linkProblem } from './hrefs.js';
import { checkMotion, defaultsProblems } from './layout/motion.js';
import { checkBackdrop } from './backdrop.js';
import { bindTypeOf } from './layout/bindings.js';
import { isPropertyPart, isParts, isWhole, NAME } from './layout/parts.js';
import { FORMAT_TYPES, storedAs } from './property-types.js';
import { isObject } from './is.js';
import { styleProblems } from './widgets/list/item-style.js';
import { innerSourceProblems } from './widgets/list/nested.js';
import { gapProblem } from './widgets/list/index.js';

const typeOf = (v) =>
  v === null
    ? 'null'
    : Array.isArray(v)
      ? 'an array'
      : typeof v === 'object'
        ? 'an object'
        : `a ${typeof v}`;

/** JSON.parse with the file and the line and column of the mistake in the error. */
export function parseContent(text, file) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const msg = err.message.replace(/\s*\(line \d+ column \d+\)$/, '');
    const at = /at position (\d+)/.exec(msg);
    let where = '';
    if (at) {
      const before = text.slice(0, Number(at[1])).split('\n');
      where = ` (line ${before.length}, column ${before.at(-1).length + 1})`;
    }
    throw new Error(
      `${contentPath(file)}: invalid JSON, ${msg.replace(/ at position \d+/, '')}${where}`,
      { cause: err },
    );
  }
}

/** Problems of keys that may be missing but must have this kind when present. */
function optional(data, kinds) {
  const out = [];
  for (const [key, kind] of Object.entries(kinds)) {
    const v = data[key];
    if (v === undefined) continue;
    const ok =
      kind === 'array' ? Array.isArray(v) : kind === 'object' ? isObject(v) : typeof v === kind;
    if (!ok)
      out.push(
        `"${key}" must be ${kind === 'array' || kind === 'object' ? `an ${kind}` : `a ${kind}`}, not ${typeOf(v)}`,
      );
  }
  return out;
}

const required = (data, keys, kind) =>
  keys
    .filter((k) => (kind === 'object' ? !isObject(data[k]) : typeof data[k] !== kind))
    .map((k) => `"${k}" must be ${kind === 'object' ? 'an object' : `a ${kind}`}`);

function checkSite(d) {
  return [
    ...required(d, ['name', 'url'], 'string'),
    ...optional(d, {
      title: 'string',
      titleTemplate: 'string',
      description: 'string',
      ogPhoto: 'string',
      lang: 'string',
      entityType: 'string',
      themeColor: 'string',
      timezone: 'string',
      social: 'array',
      forms: 'object',
    }),
    ...checkForms(d.forms),
    ...checkTypography(d.typography),
    ...checkLayout(d.layout),
    ...(d.robots === undefined || ['index', 'noindex'].includes(d.robots)
      ? []
      : ['"robots" must be "index" or "noindex"']),
  ];
}

/** site.json "forms": where contact forms send (src/site/widgets/form/index.js). */
function checkForms(f) {
  if (!isObject(f)) return [];
  const out = optional(f, { target: 'string', endpoint: 'string', turnstileSiteKey: 'string' });
  if (f.target !== undefined && !['function', 'endpoint', 'email'].includes(f.target))
    out.push('"target" must be "function", "endpoint" or "email"');
  if (f.endpoint && !/^https:\/\/\S+$/.test(f.endpoint))
    out.push('"endpoint" must be an https:// URL');
  return out.map((p) => `forms: ${p}`);
}

/**
 * nav.json: { header: [items] }, item { label, page | item | href, all?, items?, children? }.
 * Items can have one level of children. Whether a page exists needs the routes: the templates
 * warn about that (header.js linkOf).
 */
function checkNav(d) {
  const out = optional(d, { header: 'array' });
  if (d.footer !== undefined)
    out.push('"footer" is gone: the footer is settings/footer.json, sections like a page');
  const check = (item, where, { nest }) => {
    if (!isObject(item)) return out.push(`${where} must be an object`);
    const name = `${where}${typeof item.label === 'string' ? ` ("${item.label}")` : ''}`;
    const bad = (msg) => out.push(`${name}: ${msg}`);
    if (typeof item.label !== 'string') bad('needs a "label"');
    const link = linkProblem(item, ['label', 'all', 'items', 'children']);
    if (link) bad(link);
    out.push(...optional(item, { all: 'string', items: 'string' }).map((p) => `${name}: ${p}`));
    if (item.children === undefined) return;
    if (!nest) return bad('"children" go one level deep');
    if (!Array.isArray(item.children)) return bad('"children" must be a list');
    if (item.items !== undefined) bad('has "children" or "items", not both');
    item.children.forEach((c, j) => check(c, `${name} child ${j + 1}`, { nest: false }));
  };
  if (Array.isArray(d.header))
    d.header.forEach((item, i) => check(item, `header item ${i + 1}`, { nest: true }));
  return out;
}

/**
 * settings/redirects.json (src/site/redirects.js): a list of { from, to, status? }. Whether `to`
 * is a page needs the routes: the build warns about that.
 */
function checkRedirects(d) {
  if (!Array.isArray(d)) return [`"redirects" must be a list (a JSON array), not ${typeOf(d)}`];
  const out = [];
  const seen = new Set();
  d.forEach((r, i) => {
    const name = `redirect ${i + 1}`;
    if (!isObject(r)) return out.push(`${name} must be an object`);
    if (typeof r.from !== 'string' || !r.from.startsWith('/') || r.from.startsWith('//'))
      out.push(`${name}: "from" must be a path that starts with /`);
    else if (/\s/.test(r.from)) out.push(`${name}: "from" can't have spaces`);
    else if (seen.has(r.from)) out.push(`${name}: another redirect is from ${r.from}`);
    seen.add(r.from);
    if (typeof r.to !== 'string' || !/^(\/(?!\/)|https?:\/\/)\S*$/.test(r.to))
      out.push(`${name}: "to" must be a path that starts with / or an http(s) URL, without spaces`);
    if (r.status !== undefined && ![301, 302].includes(r.status))
      out.push(`${name}: "status" is 301 (moved for good, the default) or 302 (for now)`);
  });
  return out;
}

/** A page's search and share meta (src/site/seo.js). */
function checkMeta(meta) {
  if (!isObject(meta)) return [];
  return optional(meta, {
    title: 'string',
    description: 'string',
    photo: 'string',
    canonical: 'string',
    noindex: 'boolean',
  }).map((p) => `meta: ${p}`);
}

function checkAnimations(d) {
  const out = [
    ...required(d, ['animations', 'targets', 'transitions'], 'object'),
    ...optional(d, { interactions: 'object' }),
  ];
  out.push(...defaultsProblems(d.defaults));
  if (d.elements !== undefined)
    out.push(
      '"elements" must be left out: a widget\'s own element animations are its "motion.elements"',
    );
  for (const group of ['animations', 'targets'])
    for (const [k, v] of Object.entries(isObject(d[group]) ? d[group] : {}))
      if (!isObject(v)) out.push(`${group}["${k}"] must be an object`);
  return out;
}

/**
 * A document (src/site/files.js DOC_KINDS): "kind" as its file says, its sections, and what its
 * kind has: a page its id, meta, backdrop, transition and template; a part only sections.
 */
function checkDoc(file, d) {
  const kind = docKindOf(file);
  const out = optional(d, { sections: 'array' });
  if (d.kind !== kind)
    out.push(`"kind" must be "${kind}" (${DOC_KINDS.join(' or ')}: this file's)`);
  if (kind === 'part') {
    for (const k of Object.keys(d))
      if (k !== 'kind' && k !== 'sections')
        out.push(`"${k}" must be left out: a part has only "sections"`);
    return [...out, ...checkSections(d.sections)];
  }
  out.push(...optional(d, { meta: 'object' }), ...checkMeta(d.meta), ...checkBackdrop(d.backdrop));
  // its stable id: what links point at (its folder, the URL, can change)
  if (!isId(d.id, 'pg')) out.push('"id" must be a page id like "pg-k3x9"');
  // the grid is always COLS (120) columns: not stored
  if (d.grid !== undefined) out.push(`"grid" must be left out: the page grid is always ${COLS}`);
  // its page transition: none (the site's curtain) or { curtain: "off" } (no curtain)
  const t = d.transition;
  if (t !== undefined && !(isObject(t) && t.curtain === 'off' && Object.keys(t).length === 1))
    out.push('"transition" must be { "curtain": "off" } or left out (the site\'s curtain)');
  // a [param] page: its main widget decides which pages exist (layout/source.js)
  const template = isTemplate(pageIdOf(file));
  if (d.template !== undefined)
    out.push('"template" is gone: a [param] page\'s main widget decides its pages ("main")');
  if (d.main !== undefined && !template) out.push('"main" is only for [param] pages');
  else if (d.main !== undefined && !isId(d.main, 'w'))
    out.push('"main" must be the id of one of its widgets ("w-7qpa")');
  // its folder's URL opens its first sub page instead (routes.js)
  if (d.ownPage !== undefined && d.ownPage !== false)
    out.push('"ownPage" must be false (the folder opens its first sub page) or left out');
  if (d.ownPage !== undefined && (template || ['home', '404'].includes(pageIdOf(file))))
    out.push('"ownPage" is only for a folder\'s own page (not home, 404 or a [param] page)');
  return [...out, ...checkSections(d.sections)];
}

/** A document's sections: each one, their names, links and ids. */
function checkSections(sections) {
  const out = [];
  if (!Array.isArray(sections)) return out;
  out.push(...sections.flatMap(checkSection));
  // names: their anchors (ids) unique on the page, and ids at all
  nameProblems(sections).forEach((p, at) => p && out.push(`section ${at + 1}: "name" ${p}`));
  // links: within their section, to a widget that is there, no loops (layout/links.js)
  const all = new Set(
    sections.flatMap((s) =>
      Array.isArray(s?.widgets) ? s.widgets.map((widget) => widget?.id) : [],
    ),
  );
  sections.forEach((s, at) => {
    if (!Array.isArray(s?.widgets)) return;
    out.push(...linkProblems(s.widgets, all).map((p) => `section ${at + 1}: ${p}`));
  });
  const seen = new Set();
  for (const id of sections.flatMap((s) => [
    s?.id,
    ...(s?.widgets || []).map((widget) => widget?.id),
  ]))
    if (typeof id === 'string' && seen.has(id)) out.push(`the id "${id}" is used twice`);
    else seen.add(id);
  return out;
}

const CONFIG_TYPES = { boolean: 'boolean', number: 'number' }; // the other config types are strings
const whole = (v, min) => Number.isInteger(v) && v >= min;

/**
 * A grid area { col, span, row, rows? } of a widget (its base, or its phone area); rows: does
 * the widget store its rows (size aspect / rows: required; auto: left out).
 */
function checkArea(p, key, cols = COLS, rows = true, defaults = false) {
  const out = [];
  for (const k of ['col', 'span', 'row'])
    if (!(defaults && p[k] === undefined) && !whole(p[k], 1))
      out.push(`"${key}.${k}" must be a whole number from 1`);
  if (rows && !whole(p.rows, 1)) out.push(`"${key}.rows" must be a whole number from 1`);
  if (!rows && p.rows !== undefined)
    out.push(`"${key}.rows" must be left out: an auto widget's rows are measured on the page`);
  const col = p.col ?? 1;
  if (!out.length && p.span !== undefined && col + p.span - 1 > cols)
    out.push(`"${key}" must end by column ${cols} (col ${col} + span ${p.span})`);
  return out;
}

/**
 * A widget's "layout": { base: { col, span, row, rows?, link? }, phone?: the same keys
 * on the phone grid, or null (hidden on phones) }. Links are checked with their section.
 */
function checkWidgetLayout(widget) {
  const out = [];
  for (const k of ['pos', 'phone', 'link', 'mobile'])
    if (widget[k] !== undefined)
      out.push(`"${k}" must be left out: it is in "layout" ({ base, phone })`);
  const l = widget.layout;
  if (l === undefined) return out; // full width at row 1
  if (!isObject(l) || Object.keys(l).some((k) => k !== 'base' && k !== 'phone'))
    return [...out, '"layout" must be an object { base, phone? }'];
  const rows = storesRows(widget);
  const part = (o, key, cols, whole) => {
    if (!isObject(o)) return [`"${key}" must be an object { col, span, row, rows?, link? }`];
    const res = [];
    const extra = Object.keys(o).filter((k) => !AREA_KEYS.includes(k) && k !== 'link');
    if (extra.length) res.push(`"${key}.${extra[0]}" must be left out (area and link only)`);
    if (whole || AREA_KEYS.some((k) => o[k] !== undefined))
      res.push(...checkArea(o, key, cols, rows, whole));
    return res;
  };
  out.push(...part(l.base, 'layout.base', COLS, true));
  if (l.phone !== undefined && l.phone !== null)
    out.push(...part(l.phone, 'layout.phone', MCOLS, false));
  return out;
}

const isRatio = (v) => typeof v === 'string' && ratioOf(v) !== null;

/** One page section: its layout, then each widget. */
function checkSection(s, at) {
  const where = `section ${at + 1}`;
  if (!isObject(s)) return [`${where} must be an object`];
  const out = [];
  const bad = (key, want) => out.push(`${where}: "${key}" must be ${want}`);
  if (!isId(s.id, 's')) bad('id', 'a section id like "s-k3x9"');
  if (s.height !== undefined && !HEIGHTS.includes(s.height))
    bad('height', `one of ${HEIGHTS.join(', ')}`);
  // custom: its minimum rows (only there)
  const min = s.rows?.min;
  if (s.rows !== undefined && (!isObject(s.rows) || Object.keys(s.rows).some((k) => k !== 'min')))
    bad('rows', "an object { min } (a custom height's rows)");
  else if (s.height === 'custom' && !whole(min, 1))
    bad('rows.min', 'a whole number of rows from 1 (a custom height)');
  else if (min !== undefined && !(whole(min, 1) && min <= MAX_MIN_ROWS))
    bad('rows.min', `a whole number of rows from 1 to ${MAX_MIN_ROWS}`);
  else if (s.rows !== undefined && s.height !== 'custom')
    bad('rows', 'left out unless the height is custom');
  // phones: a height of its own and, custom there, its rows
  if (s.phone !== undefined) {
    const { rows, height, ...rest } = isObject(s.phone) ? s.phone : { x: 1 };
    const minRows = rows?.min;
    const phone = HEIGHTS.includes(height) ? height : s.height;
    if (
      !isObject(s.phone) ||
      Object.keys(rest).length ||
      (rows !== undefined && (!isObject(rows) || Object.keys(rows).some((k) => k !== 'min')))
    )
      bad('phone', "an object { height, rows: { min } } (the phone's height and rows)");
    else if (height !== undefined && !HEIGHTS.includes(height))
      bad('phone.height', `one of ${HEIGHTS.join(', ')}`);
    else if (height === 'custom' && s.height !== 'custom' && minRows === undefined)
      bad('phone.rows.min', 'a whole number of rows from 1 (a custom phone height)');
    else if (minRows !== undefined && phone !== 'custom')
      bad('phone.rows', 'left out unless the phone height is custom');
    else if (minRows !== undefined && !(whole(minRows, 1) && minRows <= MAX_MIN_ROWS))
      bad('phone.rows.min', `a whole number of rows from 1 to ${MAX_MIN_ROWS}`);
  }
  if (s.width !== undefined && !WIDTHS.includes(s.width)) bad('width', WIDTHS.join(' or '));
  if (s.enabled !== undefined && typeof s.enabled !== 'boolean') bad('enabled', 'true or false');
  if (!Array.isArray(s.widgets)) return [...out, `${where}: "widgets" must be a list`];
  return [
    ...out,
    ...s.widgets.flatMap((widget, j) => checkWidget(widget, `${where}, widget ${j + 1}`)),
  ];
}

/** A widget's "source" (layout/source.js) against its type: list widgets All, others Item. */
function sourceProblems(src, t) {
  const SHAPE =
    '"source" must be { "mode": "item", "from", "id" }, { "mode": "all", "from" } or { "mode": "url", "from", "where" }';
  if (!isObject(src) || !isSlug(src.from)) return [SHAPE];
  const keys = { item: ['id'], all: [], url: ['where'] }[src.mode];
  if (!keys) return [SHAPE];
  if (Object.keys(src).some((k) => !['mode', 'from', ...keys].includes(k))) return [SHAPE];
  if (src.mode === 'all' && !t.list)
    return ['"source": "all" is for list widgets (Item: one item)'];
  if (src.mode === 'item' && t.list) return ['"source": "item" is for one item (a list: "all")'];
  if (src.mode === 'item' && !isId(src.id, 'p'))
    return ['"source.id" must be an item id ("p-k3x9")'];
  if (src.mode !== 'url') return [];
  const w = src.where;
  const oldRule = Array.isArray(w?.rules) && w.rules.find((r) => isObject(r) && 'field' in r);
  if (oldRule)
    return [
      `"source.where": write "property" now: { "param": ${JSON.stringify(oldRule.param)}, "property": ${JSON.stringify(oldRule.field)} } (not "field")`,
    ];
  const rule = (r) =>
    isObject(r) &&
    isParamName(r.param) &&
    typeof r.property === 'string' &&
    /^[\w-]+$/.test(r.property) &&
    Object.keys(r).length === 2;
  if (!isObject(w) || w.op !== 'and' || !Array.isArray(w.rules) || !w.rules.every(rule))
    return ['"source.where" must be { "op": "and", "rules": [{ "param", "property" }] }'];
  const params = w.rules.map((r) => r.param);
  if (new Set(params).size !== params.length) return ['"source.where": one rule per param'];
  return [];
}

/** One widget: its place, then its content against its type in the registry. */
function checkWidget(widget, where) {
  if (!isObject(widget)) return [`${where} must be an object`];
  if (typeof widget.type !== 'string') return [`${where} needs a "type"`];
  if (RETIRED_WIDGETS[widget.type]) return [`${where}: ${RETIRED_WIDGETS[widget.type]}`];
  const t = WIDGET_TYPES[widget.type];
  const name = t ? `${where} (${t.label})` : where;
  const out = [];
  const bad = (key, want) => out.push(`${name}: "${key}" must be ${want}`);
  if (!isId(widget.id, 'w')) bad('id', 'a widget id like "w-7qpa"');
  out.push(...checkWidgetLayout(widget).map((p) => `${name}: ${p}`));
  if (widget.size !== undefined && !SIZES.includes(widget.size)) bad('size', SIZES.join(', '));
  if (widget.type === 'hero' && Array.isArray(widget.photos))
    widget.photos.forEach((p, i) => {
      const ph = p?.phone;
      if (ph === undefined || ph === null) return;
      if (!isObject(ph) || Object.keys(ph).some((k) => !['x', 'y', 'w'].includes(k)))
        bad(`photos.${i}.phone`, 'null (hidden on phones) or { x?, y?, w? }');
      else
        for (const [k, v] of Object.entries(ph))
          if (typeof v !== 'number') bad(`photos.${i}.phone.${k}`, 'a number');
    });
  if ((widget.size === 'aspect' || widget.aspect !== undefined) && !isRatio(widget.aspect))
    bad('aspect', 'a ratio like "4:5"');
  if (widget.layer !== undefined && !Number.isInteger(widget.layer)) bad('layer', 'a whole number');
  if (widget.z !== undefined) out.push(`${name}: "z" is "layer" now (its Layer)`);
  out.push(...checkScale(widget).map((p) => `${name}: ${p}`));
  out.push(...checkPlacement(widget).map((p) => `${name}: ${p}`));
  if (widget.motion !== undefined)
    out.push(...checkMotion(widget.motion).map((p) => `${name}: ${p}`));
  if (!t) return out; // an unknown type only warns (render)
  if (widget.item !== undefined) bad('item', 'left out: its "source" says which item');
  if (widget.source !== undefined)
    out.push(...sourceProblems(widget.source, t).map((p) => `${name}: ${p}`));
  // a value can show the item's properties, as parts (../layout/parts.js): [{ t } | { property, format? }]
  const partsShape = (key, v, type) => {
    v.forEach((p, k) => {
      const extra = Object.keys(p).filter((x) =>
        isPropertyPart(p) ? x !== 'property' && x !== 'format' : x !== 't',
      );
      if (extra.length || (isPropertyPart(p) && !NAME.test(p.property)))
        bad(
          `${key}.${k}`,
          '{ "t": "<text>" } or { "property": "<name>", "format"?: "… {value} …" }',
        );
      else if (
        p.format !== undefined &&
        !(typeof p.format === 'string' && p.format.includes('{value}'))
      )
        bad(`${key}.${k}.format`, 'a text with {value} in it');
    });
    if (!type) bad(key, "a list of its own (it can't show an item's properties)");
    else if (!isWhole(v) && !FORMAT_TYPES.includes(type))
      bad(
        key,
        'one property ([{ "property": "<name>" }]): only a text can mix text and properties',
      );
  };
  // the old { "bind": "<name>", "format" } (before parts) and parts' old { "field" }: the
  // new shape instead
  const oldBind = (v, key) => {
    if (isObject(v) && typeof v.bind === 'string') {
      bad(
        key,
        `parts now: [{ "property": "${v.bind}"${v.format ? `, "format": ${JSON.stringify(v.format)}` : ''} }] (not { "bind" })`,
      );
      return true;
    }
    const oldPart =
      Array.isArray(v) && v.find((p) => isObject(p) && typeof p.field === 'string' && !('t' in p));
    if (oldPart) {
      bad(key, `[{ "property": "${oldPart.field}" }] now (not { "field" })`);
      return true;
    }
    if (Array.isArray(v))
      v.forEach(
        (e, i) =>
          isObject(e) && Object.entries(e).forEach(([k, x]) => oldBind(x, `${key}.${i}.${k}`)),
      );
    return false;
  };
  const old = new Set([
    ...(t.settings || []).filter((f) => oldBind(widget[f.key], f.key)).map((f) => f.key),
    ...(t.config || [])
      .filter((c) => oldBind(widget.config?.[c.key], `config.${c.key}`))
      .map((c) => `config.${c.key}`),
  ]);
  for (const c of t.config || []) {
    const v = widget.config?.[c.key];
    if (isParts(v)) partsShape(`config.${c.key}`, v, bindTypeOf(c, { config: true }));
  }
  for (const f of t.settings || []) {
    const v = widget[f.key];
    if (v === undefined || old.has(f.key)) continue;
    if (isParts(v)) {
      partsShape(f.key, v, bindTypeOf(f));
      continue;
    }
    if (Array.isArray(v) && isObject(f.list))
      v.forEach((e, i) =>
        Object.entries(isObject(e) ? e : {}).forEach(([k, sv]) => {
          const sub = f.list[k];
          const type = (isObject(sub) ? sub.type : sub) || 'text';
          if (isParts(sv))
            partsShape(`${f.key}.${i}.${k}`, sv, FORMAT_TYPES.includes(type) ? type : null);
          else if (type === 'link' && sv !== undefined && linkProblem(sv))
            bad(`${f.key}.${i}.${k}`, linkProblem(sv));
        }),
      );
    if (f.type === 'rich') continue; // a Text widget's body: its type's check (../text.js)
    if (!f.list) {
      if (typeof v !== storedAs(f.type)) bad(f.key, `a ${storedAs(f.type)}`);
    } else if (!Array.isArray(v)) bad(f.key, 'a list');
    else if (
      typeof f.list === 'string' ? !v.every((x) => typeof x === 'string') : !v.every(isObject)
    )
      bad(f.key, typeof f.list === 'string' ? 'a list of strings' : 'a list of objects');
  }
  if (t.check) out.push(...t.check(widget).map((p) => `${name}: ${p}`));
  if (widget.config === undefined) return out;
  if (!isObject(widget.config)) return [...out, `${name}: "config" must be an object`];
  const { enabled, missing } = widget.config;
  if (enabled !== undefined && typeof enabled !== 'boolean') bad('config.enabled', 'true or false');
  // every widget: Hide (default) | Show empty (./layout/missing.js); omitted means Hide
  if (missing !== undefined && missing !== 'hide' && missing !== 'show')
    bad('config.missing', '"hide" or "show"');
  const np = needsProblem(widget.config.needs);
  if (np) bad('config.needs', np);
  for (const c of t.config || []) {
    // its phone value (per layout: the editor's phone view), under its own key
    const pv = c.phone ? widget.config[c.phone.key] : undefined;
    if (pv !== undefined && !c.phone.options.some(([o]) => o === pv))
      bad(`config.${c.phone.key}`, `one of ${c.phone.options.map(([o]) => o).join(', ')}`);
    const v = widget.config[c.key];
    // list.check already names the replacement for arrangement "rows"
    if (c.key === 'arrangement' && v === 'rows') continue;
    if (v === undefined || (c.empty && v === '') || isParts(v) || old.has(`config.${c.key}`))
      continue;
    // a list in config (List hand-made items): shape is the type's check(), not a string
    if (c.list) continue;
    if (c.type === 'link') {
      const p = linkProblem(v);
      if (p) bad(`config.${c.key}`, p);
      continue;
    }
    if (typeof v !== (CONFIG_TYPES[c.type] || 'string'))
      bad(`config.${c.key}`, `a ${CONFIG_TYPES[c.type] || 'string'}`);
    // `also`: values a setting takes besides its options (a List's site templates, "t-…")
    else if (c.options && !c.options.some(([o]) => o === v) && !c.also?.(v))
      bad(`config.${c.key}`, `one of ${c.options.map(([o]) => o).join(', ')}`);
  }
  return out;
}

/**
 * photos.json, the one photo library: { alt?, credit?: { name, url?, source?, license? },
 * focal?: { x, y } (0–100, where to keep in view when cropped), and for R2 photos
 * srcset: [{ key, w }], width, height, ... } per photo. Content refers to photos by path only.
 */
function checkPhotos(d) {
  return Object.entries(d).flatMap(([k, v]) => {
    if (!isObject(v)) return [`photo "${k}" must be an object`];
    const out = optional(v, { alt: 'string', srcset: 'array' }).map((p) => `photo "${k}": ${p}`);
    if (
      v.credit !== undefined &&
      !(
        isObject(v.credit) &&
        typeof v.credit.name === 'string' &&
        v.credit.name &&
        ['url', 'source', 'license'].every(
          (x) => v.credit[x] === undefined || typeof v.credit[x] === 'string',
        )
      )
    )
      out.push(`photo "${k}": "credit" must be { "name", "url"?, "source"?, "license"? } (texts)`);
    const pct = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
    if (v.focal !== undefined && !(isObject(v.focal) && pct(v.focal.x) && pct(v.focal.y)))
      out.push(`photo "${k}": "focal" must be { "x", "y" } (0 to 100)`);
    if (Array.isArray(v.srcset) && !v.srcset.every((s) => isObject(s) && typeof s.key === 'string'))
      out.push(`photo "${k}": every size in "srcset" needs a "key"`);
    return out;
  });
}

/**
 * Problems with one content file's data, [] when it's fine. file: "settings/site.json", …
 * Every file is an object with "version": 1 (VERSION, src/site/files.js) first; a source's
 * list is its "items", redirects.json's "redirects", photos.json's map "photos".
 */
export function checkContent(file, data) {
  if (!isObject(data)) return [`must be an object, not ${typeOf(data)}`];
  if (data.version !== VERSION) return [`"version" must be ${VERSION} (the content's shape)`];
  const notes = commentKeys(data);
  if (notes.length)
    return notes.map((k) => `"${k}": no comments in content (the README documents the shape)`);
  const defaults = storedDefaults(file, data);
  if (defaults.length) return defaults;
  const { version: _v, ...d } = data; // eslint-disable-line no-unused-vars
  if (sourceIdOf(file)) {
    if (d.items === undefined) return ['"items" is missing (a list, a JSON array)'];
    if (!Array.isArray(d.items))
      return [`"items" must be a list (a JSON array), not ${typeOf(d.items)}`];
    return d.items.flatMap((item, i) =>
      isObject(item) ? [] : [`item ${i + 1} must be an object`],
    );
  }
  if (schemaIdOf(file)) return checkSchema(d);
  if (file === REDIRECTS) return checkRedirects(d.redirects);
  if (file === SITE) return checkSite(d);
  if (file === ANIMATIONS) return checkAnimations(d);
  if (file === NAV) return checkNav(d);
  if (file === STRINGS)
    return [
      // the groups of UI text (src/site/strings.js CORE_STRINGS): objects of strings
      ...optional(d, Object.fromEntries(Object.keys(CORE_STRINGS).map((g) => [g, 'object']))),
      ...(d.footer !== undefined
        ? ['"footer" is gone: the footer is settings/footer.json, sections like a page']
        : []),
    ];
  if (file === PHOTOS)
    return isObject(d.photos) ? checkPhotos(d.photos) : ['"photos" must be an object'];
  if (docKindOf(file)) return checkDoc(file, d);
  if (templateIdOf(file)) return checkItemTemplate(d);
  return [];
}

/** Presets a template can come from (src/site/widgets/list/presets.js PRESETS ids). */
const PRESET_FROM = ['preset:card', 'preset:plain', 'preset:panel', 'preset:row', 'preset:photo'];
const ROLE = /^[a-z][a-z0-9-]*$/;

/**
 * An item template (content/templates/t-….json):
 *   { kind: "template", name, basedOn?, clickable?, preview?: { from?, columns? }, style?,
 *     sections: [ { id, height?, rows?, widgets: [...] } ] }
 * name: its name in a List's Template picker; clickable: false, the item is no link to its
 * page (left out: true); preview: the template editor's sample item (from: the source it
 * comes from) and the columns of the List it is previewed in (1–6); style: the item style
 * (widgets/list/item-style.js). Exactly one section (widgets/list/item-grid.js): its widgets
 * on the page grid, as a page section's, their values {property} parts; its height "fit" (left
 * out) or "custom" with rows.min. No "source" on a widget but an inner List's (the List gives
 * each copy its item).
 */
export function checkItemTemplate(d) {
  const out = [];
  if (d.kind !== 'template') out.push('"kind" must be "template"');
  if (typeof d.name !== 'string' || !d.name.trim())
    out.push('"name" must be a text (its name in the List\'s Template picker)');
  if (d.basedOn !== undefined && !PRESET_FROM.includes(d.basedOn) && !isTemplateId(d.basedOn))
    out.push(`"basedOn" must be a preset (${PRESET_FROM.join(', ')}) or a template id ("t-…")`);
  if (d.clickable !== undefined && typeof d.clickable !== 'boolean')
    out.push('"clickable" must be true or false');
  out.push(...previewProblems(d.preview));
  // retired by the template grid (step I): what replaced each
  for (const [k, msg] of Object.entries(RETIRED_TEMPLATE_KEYS))
    if (d[k] !== undefined) out.push(`"${k}" is gone: ${msg}`);
  if (isObject(d.style))
    for (const [k, msg] of Object.entries(RETIRED_STYLE_KEYS))
      if (d.style[k] !== undefined) out.push(`"style.${k}" is gone: ${msg}`);
  out.push(
    ...styleProblems(
      isObject(d.style)
        ? Object.fromEntries(Object.entries(d.style).filter(([k]) => !RETIRED_STYLE_KEYS[k]))
        : d.style,
    ),
  );
  const known = [
    'kind',
    'name',
    'basedOn',
    'clickable',
    'preview',
    ...Object.keys(RETIRED_TEMPLATE_KEYS),
    'style',
    'sections',
  ];
  for (const k of Object.keys(d))
    if (!known.includes(k)) out.push(`"${k}" is not a template key (${known.join(', ')})`);
  if (!Array.isArray(d.sections) || d.sections.length !== 1 || !isObject(d.sections[0])) {
    out.push('"sections" must be a list of exactly one section ({ id, widgets })');
    return out;
  }
  const s = d.sections[0];
  out.push(...itemSectionProblems(s));
  if (!Array.isArray(s.widgets) || !s.widgets.length) {
    out.push('sections.0.widgets must be a list of widgets');
    return out;
  }
  s.widgets.forEach((w, i) => out.push(...checkTemplateWidget(w, `sections.0.widgets.${i}`)));
  // the grid (widgets/list/item-grid.js): ids unique, links to a widget of the template, no loops
  const ws = s.widgets.filter(isObject);
  out.push(...linkProblems(ws));
  const seen = new Set([s.id]);
  for (const w of ws)
    if (typeof w.id === 'string' && seen.has(w.id)) out.push(`the id "${w.id}" is used twice`);
    else seen.add(w.id);
  out.push(...detailsProblems(d));
  return out;
}

/** The most columns a template is previewed in (a List's most). */
const PREVIEW_COLUMNS = 6;

/** A template's "preview": { from?: a source, columns?: 1–6 } (the template editor's only). */
function previewProblems(p) {
  if (p === undefined) return [];
  if (!isObject(p)) return ['"preview" must be an object { from?, columns? }'];
  const out = [];
  for (const k of Object.keys(p))
    if (k !== 'from' && k !== 'columns')
      out.push(`"preview.${k}" is not a preview key (from, columns)`);
  if (p.from !== undefined && (typeof p.from !== 'string' || !ROLE.test(p.from)))
    out.push('"preview.from" must be a source name (the source its sample item comes from)');
  if (
    p.columns !== undefined &&
    !(Number.isInteger(p.columns) && p.columns >= 1 && p.columns <= PREVIEW_COLUMNS)
  )
    out.push(`"preview.columns" must be a whole number from 1 to ${PREVIEW_COLUMNS}`);
  return out;
}

/**
 * A template's one section: an id, its height "fit" (left out) or "custom" with rows.min (an
 * item at least that tall); none of a page section's screen heights, width, on/off or phone
 * height (the List places and sizes the item).
 */
function itemSectionProblems(s) {
  const out = [];
  const at = 'sections.0';
  if (!isId(s.id, 's')) out.push(`${at}.id must be a section id like "s-k3x9"`);
  for (const k of Object.keys(s))
    if (!['id', 'height', 'rows', 'widgets'].includes(k))
      out.push(
        `${at}.${k}: a template's section has only id, height ("fit" or "custom"), rows and widgets (the List places and sizes the item)`,
      );
  if (s.height !== undefined && s.height !== 'fit' && s.height !== 'custom')
    out.push(`${at}.height must be "fit" or "custom" (an item has no screen height)`);
  const min = s.rows?.min;
  if (s.rows !== undefined && (!isObject(s.rows) || Object.keys(s.rows).some((k) => k !== 'min')))
    out.push(`${at}.rows must be an object { min } (a custom height's rows)`);
  else if (s.height === 'custom' && !(whole(min, 1) && min <= MAX_MIN_ROWS))
    out.push(`${at}.rows.min must be a whole number of rows from 1 to ${MAX_MIN_ROWS}`);
  else if (s.rows !== undefined && s.height !== 'custom')
    out.push(`${at}.rows: left out unless the height is "custom"`);
  return out;
}

/** config.needs (./layout/missing.js): a list of property names; null when fine. */
function needsProblem(v) {
  if (v === undefined) return null;
  if (!Array.isArray(v) || !v.every((k) => typeof k === 'string' && NAME.test(k)))
    return 'a list of property names (["placeholder"])';
  return null;
}

/** A template widget's When a value is missing (left out = Inherit) and config.needs. */
function missingProblems(w, at) {
  const out = [];
  if (!isObject(w.config)) return out;
  const { missing, needs } = w.config;
  if (missing !== undefined && missing !== 'hide' && missing !== 'show')
    out.push(`${at}.config.missing must be "hide" or "show" (left out: Inherit)`);
  const np = needsProblem(needs);
  if (np) out.push(`${at}.config.needs must be ${np}`);
  return out;
}

/** A template button's link: bound parts, or a fixed link; a property inside "href" is refused. */
function templateLinkProblems(w, at) {
  const link = isObject(w.config) ? w.config.link : undefined;
  if (w.type !== 'button' || link === undefined || isParts(link)) return [];
  if (isObject(link) && (isParts(link.href) || isObject(link.href)))
    return [
      `${at}.config.link: a property goes in the link itself: write "link": [{ "property": "url" }], not { "href": … }`,
    ];
  const p = linkProblem(link);
  return p ? [`${at}.config.link must be ${p}`] : [];
}

/** Template keys retired by the template grid (step I), and what replaced each. */
const RETIRED_TEMPLATE_KEYS = {
  opens:
    'a "details" widget (Summary and details) on the template: its "config.template" holds the details, "config.several" is "opens.several"',
  photoFirst: 'the photo\'s place is its own "layout" on the template\'s grid',
};
/** Item style keys the template grid took over. */
const RETIRED_STYLE_KEYS = {
  padding: "the space inside an item is the template's grid: place the widgets where they go",
  spacing: 'the space between widgets is their rows on the template\'s grid (or a link\'s "gap")',
  photoRatio: 'the photo widget\'s own size: "size": "aspect" with "aspect": "4:5"',
  photoFit: 'the photo widget\'s own fit ("box")',
  photoPlacement: 'the photo widget\'s "layout" (above, beside: where you place it)',
  textOverPhoto: 'place the text over the photo on the grid (a higher "layer")',
  align: "each text widget's own alignment",
  titleSize: "the title text widget's own style",
};

/** One widget of an item template at `at`: its problems. */
function checkTemplateWidget(w, at) {
  const out = [];
  if (!isObject(w)) return [`${at} must be an object`];
  if (w.type === 'sideBySide')
    return [
      `${at}: Side by side is gone: place its widgets next to each other on the template's grid (each its own "layout")`,
    ];
  if (w.type === 'toggle')
    return [
      `${at}: the toggle is gone: a "details" widget (Summary and details) shows the +/× where it sits`,
    ];
  if (w.details !== undefined)
    out.push(
      `${at}.details is gone: the details are a template of their own, named by a "details" widget's "config.template"`,
    );
  if (w.type === 'details') {
    out.push(...detailsWidgetProblems(w, at));
    if (!isId(w.id, 'w')) out.push(`${at}: "id" must be a widget id like "w-7qpa"`);
    out.push(...checkWidgetLayout(w).map((p) => `${at}: ${p}`));
    // its place has a height as any widget's (Rows: an item at least that tall)
    if (w.size !== undefined && !SIZES.includes(w.size))
      out.push(`${at}.size must be ${SIZES.join(', ')}`);
    if ((w.size === 'aspect' || w.aspect !== undefined) && !isRatio(w.aspect))
      out.push(`${at}.aspect must be a ratio like "4:5"`);
    const extra = Object.keys(w).filter(
      (k) => !['id', 'type', 'role', 'layout', 'layer', 'size', 'aspect', 'config'].includes(k),
    );
    if (extra.length)
      out.push(
        `${at}: Summary and details has only id, type, role, layout, layer, size, aspect and config (not ${extra.join(', ')})`,
      );
    return out;
  }
  if (RETIRED_WIDGETS[w.type]) return [`${at}: ${RETIRED_WIDGETS[w.type]}`];
  if (!WIDGET_TYPES[w.type])
    return [
      `${at}: "${w.type}" is not a widget type (${Object.keys(WIDGET_TYPES)
        .filter((t) => t !== 'list')
        .join(', ')}, details)`,
    ];
  if (w.type === 'list') {
    // an inner List (two levels: widgets/list/nested.js; loops and depth: bindingProblems)
    out.push(...innerSourceProblems(w.source, at));
    const tp = w.config?.template;
    if (tp !== undefined && !PRESET_FROM.includes(tp) && !isTemplateId(tp))
      out.push(`${at}.config.template must be a preset or a template id ("t-…")`);
    const allowed = [
      'template',
      'columns',
      'phoneColumns',
      'gap',
      'properties',
      'arrangement',
      ...CAROUSEL_KEYS,
    ];
    for (const k of Object.keys(w.config || {}))
      if (!allowed.includes(k))
        out.push(
          `${at}.config.${k} is not an inner List setting (template, columns, gap, arrangement and the carousel's)`,
        );
    out.push(...carouselProblems(w.config, `${at}.config`));
    const gp = gapProblem(w.config?.gap);
    if (gp) out.push(`${at}.${gp}`);
  } else if (w.source !== undefined)
    out.push(`${at}: no "source" in a template: the List gives each copy its item`);
  // on the grid, as a page's widget (layout, size, aspect, layer)
  if (!isId(w.id, 'w')) out.push(`${at}: "id" must be a widget id like "w-7qpa"`);
  if (w.z !== undefined) out.push(`${at}: "z" is "layer" now (its Layer)`);
  if (w.layer !== undefined && !Number.isInteger(w.layer))
    out.push(`${at}.layer must be a whole number`);
  out.push(...checkWidgetLayout(w).map((p) => `${at}: ${p}`));
  if (w.size !== undefined && !SIZES.includes(w.size))
    out.push(`${at}.size must be ${SIZES.join(', ')}`);
  if ((w.size === 'aspect' || w.aspect !== undefined) && !isRatio(w.aspect))
    out.push(`${at}.aspect must be a ratio like "4:5"`);
  if (w.role !== undefined && (typeof w.role !== 'string' || !ROLE.test(w.role)))
    out.push(`${at}.role must be a name in lowercase letters, digits and "-"`);
  if (w.join !== undefined && (w.type !== 'text' || typeof w.join !== 'string'))
    out.push(`${at}.join: only a text's, a text (its first line's properties joined by it)`);
  if (w.itemLink !== undefined && (w.type !== 'button' || w.itemLink !== true))
    out.push(`${at}.itemLink: only a button's, true (it opens the item's page)`);
  out.push(...missingProblems(w, at), ...templateLinkProblems(w, at));
  if (w.grow !== undefined)
    out.push(
      `${at}.grow is gone (Fill the space): give the widget the columns it fills (its "layout")`,
    );
  if (w.type === 'photo' && w.config?.width !== undefined)
    out.push(`${at}.config.width is gone (Photo width): give the photo its columns (its "layout")`);
  return out;
}

/** Keys starting with "_" (comments), anywhere in the data: their paths. */
function commentKeys(v, at = '') {
  if (Array.isArray(v)) return v.flatMap((x, i) => commentKeys(x, `${at}${at ? '.' : ''}${i}`));
  if (!isObject(v)) return [];
  return Object.entries(v).flatMap(([k, x]) => {
    const p = `${at}${at ? '.' : ''}${k}`;
    return k.startsWith('_') ? [p] : commentKeys(x, p);
  });
}

/** Throws "content/<file>: <problems>" when the data doesn't fit. */
export function assertContent(file, data) {
  const problems = checkContent(file, data);
  if (problems.length) throw new Error(`${contentPath(file)}: ${problems.join('; ')}`);
}
