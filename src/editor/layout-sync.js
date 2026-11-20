/**
 * The page's sections in the preview, kept in step with its file while editing, without a
 * reload. The page's <main> names its file (data-page-file); every section element its id
 * (data-sec) and every widget element its id (data-widget): src/render/layout/index.js.
 *
 * On each change of the file, syncLayout applies what the preview can show by itself: the
 * sections' name (their id), height, width, rows and on/off (their classes and CSS variables) and the
 * widgets' places, sizes, links, text scale, phone areas, layers, on/off and motion (data-motion,
 * src/render/layout/motion.js: those widgets' animations play again). What needs the site's templates (a section added or
 * copied, a widget's content or config changed after a structure edit, a section whose index
 * moved, so its editor markers point elsewhere) it reports: the editor fetches those
 * sections' HTML from the dev server (POST /__editor/render) and swaps them in (swapSections).
 */
import {
  widgetClass,
  widgetLinks,
  widgetVars,
  sectionAnchor,
  sectionClass,
  sectionVars,
} from '../render/layout/index.js';
import { kindOf } from '../widgets/index.js';
import { templateFile } from '../render/files.js';
import { set } from './lib/pointer.js';
import { gapOf } from '../widgets/list/index.js';

/**
 * A widget's motion attributes as the site renders them:
 * [data-motion, data-motion-options, data-anim-elements].
 */
function motionOf(widget) {
  const m = widget?.motion;
  if (!m || typeof m !== 'object') return [null, null, null];
  const { animation, elements, ...timing } = m;
  const own = elements && typeof elements === 'object' ? JSON.stringify(elements) : null;
  if (typeof animation !== 'string') return [null, null, own];
  return [animation, Object.keys(timing).length ? JSON.stringify(timing) : null, own];
}

/** Set (or remove) an attribute; true when it changed. */
function setAttr(node, name, value) {
  if (node.getAttribute(name) === value) return false;
  if (value === null) node.removeAttribute(name);
  else node.setAttribute(name, value);
  return true;
}

/** The preview's page view (<main>), and its footer (footer.json's sections). */
export const pageView = (doc) => doc?.querySelector('[data-router-view]') || null;
export const footerOf = (doc) => doc?.querySelector('[data-footer]') || null;

/** The page file of the page in the preview ("pages/about/index.json"), or ''. */
export const previewFile = (doc) => pageView(doc)?.dataset.pageFile || '';

/**
 * The file the editor edits for `target` (ui.target): a page picked, the page's own
 * (target.file, main.js pickTarget: the panel shows it at once, the preview catches up),
 * else the page's in the preview; the footer's for the Footer, an item template's own
 * (content/templates/t-….json: one section, so its widgets are at /sections/0/widgets as a
 * page's), '' for the Header (no sections; or no preview yet).
 */
export const targetFile = (target, doc) =>
  target?.kind === 'page'
    ? target.file || previewFile(doc)
    : target?.kind === 'item-template'
      ? templateFile(target.id)
      : target?.id === 'footer'
        ? footerOf(doc)?.dataset.pageFile || ''
        : '';

/**
 * Open one site part in the preview ('header' | 'footer', or none: ''), lock the other: open,
 * its texts (and the footer's sections and widgets) can be hovered and picked and the page's
 * can't (preview-runtime.js INJECTED_CSS: data-ed-open); locked, a click on it opens it.
 */
export function setPartOpen(doc, id) {
  doc?.querySelector('[data-header]')?.toggleAttribute('data-ed-open', id === 'header');
  footerOf(doc)?.toggleAttribute('data-ed-open', id === 'footer');
}

/** The elements whose sections follow a file: the page's view and the footer. */
export const syncRoots = (doc) => [pageView(doc), footerOf(doc)].filter(Boolean);

// What each section element was rendered from: its index and its widgets' content (kindOf).
const rendered = new WeakMap();
const keyOf = (s, at) =>
  JSON.stringify([at, (s?.widgets || []).map((widget) => [widget?.id, kindOf(widget)])]);

/** The view's section elements by id. */
const sectionsIn = (view) =>
  new Map([...view.querySelectorAll('[data-sec]')].map((el) => [el.dataset.sec, el]));

/** After the page is rendered (a navigation, a reload): its sections show the store's file. */
export function markRendered(doc, store, view = pageView(doc)) {
  const sections = store.current[view?.dataset.pageFile]?.sections;
  if (!view || !Array.isArray(sections)) return;
  const els = sectionsIn(view);
  sections.forEach((s, at) => {
    const el = els.get(s?.id);
    if (el) rendered.set(el, keyOf(s, at));
  });
}

// A widget's own keys that aren't texts it shows (kindOf leaves out the first ones; its config
// and id change markup, not a text)
const NOT_TEXT = new Set([
  'layout',
  'layer',
  'size',
  'aspect',
  'motion',
  'scale',
  'config',
  'id',
  'type',
]);
// the [data-edit] types a value is written into as the render writes it (preview-runtime.js
// patchText: 'words' split into its words, the hero's --hero-word with them). Not 'rich' (a Text
// widget's body: the dev server renders it) or 'photo' (its srcset, size and alt are the render's)
const PATCHED = new Set(['text', 'multiline', 'number', 'words']);
const isText = (v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
const blank = (v) => typeof v === 'string' && v.trim() === '';
// the widgets that show a blank text as it is, their element kept (an emptied one is patched in
// too). Others may leave the element out or show a default instead (a Form: its title, intro,
// a field's name for its label, "Send"): rendered
const KEEPS_BLANK = new Set(['hero', 'button']);
// a widget's config value typed that the preview shows as a CSS variable on one element of it
// (a List's Space between items: --list-gap on its grid, left out at 0), the render's own way
const CONFIG_VARS = {
  list: { gap: { on: '.list__items--grid', name: '--list-gap', value: (c) => gapOf(c) || '' } },
};

/** The plan for a typed config value shown as a CSS variable (CONFIG_VARS), else null. */
function configPlan(node, widget, rest) {
  const key = /^\/config\/([^/]+)$/.exec(rest)?.[1];
  const v = key && CONFIG_VARS[widget.type]?.[key];
  if (!v) return null;
  // its own element, not a nested List's
  const els = [...node.querySelectorAll(v.on)].filter(
    (el) => !el.parentElement?.closest(v.on) || !node.contains(el.parentElement.closest(v.on)),
  );
  if (els.length !== 1) return null;
  const value = String(v.value(widget.config));
  return () => {
    if (value) els[0].style.setProperty(v.name, value);
    else els[0].style.removeProperty(v.name);
  };
}

/**
 * A text typed in a widget's field, put into its elements instead of rendering its section
 * again: `edits` ([{ file, ptr, before, after }], the store's) each a text of a widget of
 * `root`'s file (the page's view, or the footer) that its widget shows in [data-edit] elements
 * of a plain type (PATCHED), or a config value it shows as a CSS variable (CONFIG_VARS). An
 * emptied text only for the widgets that keep its element (KEEPS_BLANK). Only when all of
 * them are: each element gets its value (write(el, value); a CSS variable: then layout()) and
 * the section counts as rendered from the file as it is now (syncLayout won't render it).
 * Anything else (a link, other config, a value with properties, layout, a Text's body, a
 * photo, an element not found, a section already waiting for its render) changes nothing
 * here: false, the section renders as before (G13).
 */
export function patchTexts(root, store, edits, write, { layout } = {}) {
  const file = root?.dataset.pageFile;
  const sections = store.current[file]?.sections;
  if (!file || !Array.isArray(sections) || !edits?.length) return false;
  if (edits.some((c) => c.file !== file)) return false;
  const els = sectionsIn(root);
  const plan = [];
  let moved = false;
  const touched = new Map(); // section index -> its edits
  for (const c of edits) {
    const m = /^\/sections\/(\d+)\/widgets\/(\d+)\/([^/]+)/.exec(c.ptr);
    if (!m) return false;
    const at = Number(m[1]);
    const s = sections[at];
    const widget = s?.widgets?.[Number(m[2])];
    const sec = els.get(s?.id);
    const node = sec && widget && sec.querySelector(`[data-widget="${widget.id}"]`);
    if (!node || node.closest('[data-sec]') !== sec) return false;
    if (m[3] === 'config') {
      const step = configPlan(node, widget, c.ptr.slice(m[0].length - '/config'.length));
      if (!step) return false;
      plan.push(step);
      moved = true;
    } else {
      if (NOT_TEXT.has(m[3]) || !isText(c.after)) return false;
      if (blank(c.after) && !KEEPS_BLANK.has(widget.type)) return false;
      const edit = `${file}#${c.ptr}`;
      const targets = [...node.querySelectorAll('[data-edit]')].filter(
        (el) => el.dataset.edit === edit,
      );
      if (!targets.length || targets.some((el) => !PATCHED.has(el.dataset.editType || 'text')))
        return false;
      plan.push(() => targets.forEach((el) => write(el, c.after)));
    }
    if (!touched.has(at)) touched.set(at, []);
    touched.get(at).push(c);
  }
  // each section showed these values before (else it waits for a render already: it gets it)
  for (const [at, list] of touched) {
    const was = structuredClone(sections[at]);
    for (const c of [...list].reverse()) set(was, c.ptr.replace(/^\/sections\/\d+/, ''), c.before);
    if (rendered.get(els.get(sections[at].id)) !== keyOf(was, at)) return false;
  }
  for (const step of plan) step();
  for (const at of touched.keys()) rendered.set(els.get(sections[at].id), keyOf(sections[at], at));
  if (moved) layout?.();
  return true;
}

/**
 * Apply a section's layout (and its widgets') to its element. True when a widget's animated
 * elements changed: the view needs mounting again. Widgets whose motion changed are added to
 * `moved` (their animation plays again).
 */
function applyLayout(el, s, moved = [], touched = { layout: false }) {
  // (only what differs is written: a name typed changes the id alone, nothing to lay out)
  const was = el.className + '|' + el.style.cssText + el.hidden;
  el.className = sectionClass(s);
  // its anchor: its name's slug (a name changed: the id with it)
  const anchor = sectionAnchor(s);
  if (anchor) el.id = anchor;
  else el.removeAttribute('id');
  // (the cell and rows the site's rows.js worked out stay until it flows the section again)
  const kept = ['--cell', '--frows', '--ffill']
    .map((v) => [v, el.style.getPropertyValue(v)])
    .filter(([, x]) => x)
    .map(([v, x]) => `;${v}:${x}`)
    .join('');
  el.style.cssText = sectionVars(s) + kept;
  el.hidden = s.enabled === false;
  if (el.className + '|' + el.style.cssText + el.hidden !== was) touched.layout = true;
  let remount = false;
  for (const widget of s.widgets || []) {
    // (its own widget, not one of a nested section's)
    const node = el.querySelector(`[data-widget="${widget?.id}"]`);
    if (!node || node.closest('[data-sec]') !== el) continue;
    const cls = widgetClass(widget);
    const wasNode = node.className + '|' + node.style.cssText + node.hidden;
    node.className = cls;
    const kept = ['--fr', '--frs', '--tks', '--tkw']
      .map((v) => [v, node.style.getPropertyValue(v)])
      .filter(([, x]) => x)
      .map(([v, x]) => `;${v}:${x}`)
      .join('');
    node.style.cssText = widgetVars(widget, s.widgets) + kept;
    node.hidden = widget.config?.enabled === false;
    if (node.className + '|' + node.style.cssText + node.hidden !== wasNode) touched.layout = true;
    for (const [name, value] of Object.entries(widgetLinks(widget, s.widgets)))
      if (setAttr(node, name, value)) touched.layout = true;
    const [animation, options, elements] = motionOf(widget);
    // its elements' animations are mounted with the view's: mount again
    if (setAttr(node, 'data-anim-elements', elements)) remount = true;
    const a = setAttr(node, 'data-motion', animation);
    if (setAttr(node, 'data-motion-options', options) || a) moved.push(node);
  }
  return remount;
}

/**
 * Sync the preview's sections (`root`'s: the page's view, or the footer) with the store's file: order, layout, removed sections.
 * Returns the ids of the sections to render again (`structure`: also those whose content
 * or config changed, keyOf; otherwise only missing ones), with
 * `remount` set when a widget's animated elements changed (the view's modules need mounting again), `motion`: the
 * widget elements whose motion changed, and `layout`: whether anything the rows and scroll
 * triggers measure changed (a name alone changes the id only).
 */
export function syncLayout(doc, store, { structure = false, root = pageView(doc) } = {}) {
  const view = root;
  const sections = store.current[view?.dataset.pageFile]?.sections;
  // nothing to sync (a page the store has no file of: the template editor's preview)
  if (!view || !Array.isArray(sections)) return Object.assign([], { motion: [] });
  const els = sectionsIn(view);
  const ids = new Set(sections.map((s) => s?.id));
  for (const [id, el] of els) if (!ids.has(id)) el.remove();

  // Order: only touch the DOM when it differs (new sections come with their render).
  const order = sections.map((s) => els.get(s?.id)).filter(Boolean);
  const now = [...view.querySelectorAll(':scope > [data-sec]')];
  let moved = false;
  for (const id of els.keys()) if (!ids.has(id)) moved = true;
  if (order.some((el, k) => now[k] !== el)) {
    moved = true;
    const anchor = now.at(-1)?.nextSibling ?? null;
    for (const el of order) view.insertBefore(el, anchor);
  }

  const stale = [];
  stale.motion = [];
  const touched = { layout: false };
  sections.forEach((s, at) => {
    const el = els.get(s?.id);
    if (el && applyLayout(el, s, stale.motion, touched)) stale.remount = true;
    if (!el || (structure && rendered.get(el) !== keyOf(s, at))) stale.push(s.id);
  });
  // the layout changed (classes, CSS variables, links, on/off, order, a section gone): the
  // rows and the scroll triggers need working out again
  stale.layout = touched.layout || moved || stale.remount || stale.motion.length > 0;
  return stale;
}

/**
 * The preview's scroll kept while sections are swapped (swapSections) and flowed again
 * (remountView): call it before, and the returned function after. A section swapped in has its
 * stored rows until the page flows it (src/client/modules/rows.js), and the element the browser
 * anchored the scroll to (CSS scroll anchoring) is gone with the old one: the page jumped
 * (to the top, or by a section's difference), so the next click hit another widget. Held here:
 * the page's height (a min-height on <html>), no scroll anchoring, and the scroll put back.
 */
export function holdScroll(doc) {
  const html = doc?.documentElement;
  const win = doc?.defaultView;
  if (!html || !win) return () => {};
  const y = win.scrollY;
  const was = { minHeight: html.style.minHeight, anchor: html.style.overflowAnchor };
  html.style.overflowAnchor = 'none';
  html.style.minHeight = `${html.scrollHeight}px`;
  return () => {
    html.style.minHeight = was.minHeight;
    if (win.scrollY !== y) win.scrollTo(0, y);
    html.style.overflowAnchor = was.anchor;
  };
}

/**
 * Only widget `id` of its rendered section (html: { sectionId: markup }) put in place of the one
 * shown, the rest of the section left as it is: a Text edit's end (Esc, a click away) shows the
 * text as the site renders it without the section, its photos and animations, being swapped and
 * played again (G3). False (nothing done) unless exactly its section was rendered and both have
 * the widget.
 */
export function swapWidget(doc, store, html, view, id) {
  const ids = Object.keys(html);
  const sections = store.current[view?.dataset.pageFile]?.sections;
  if (ids.length !== 1 || !id || !Array.isArray(sections)) return false;
  const at = sections.findIndex((s) => s?.id === ids[0]);
  const sec = sectionsIn(view).get(ids[0]);
  const sel = `[data-widget="${CSS.escape(id)}"]`;
  const old = sec?.querySelector(sel);
  if (at < 0 || !old) return false;
  const tpl = doc.createElement('template');
  tpl.innerHTML = html[ids[0]];
  const next = tpl.content.firstElementChild?.querySelector(sel);
  if (!next) return false;
  // the rows the flow gave it (rows.js) kept until it flows again
  for (const k of ['--fr', '--frs']) {
    const v = old.style.getPropertyValue(k);
    if (v) next.style.setProperty(k, v);
  }
  old.replaceWith(next);
  rendered.set(sec, keyOf(sections[at], at));
  return true;
}

/**
 * Put freshly rendered sections ({ id: html }) into the preview, in the file's order (a page
 * that is no file, the template editor's preview: each in place of the one it renders again).
 */
export function swapSections(doc, store, html, view = pageView(doc)) {
  const els = sectionsIn(view);
  const sections = store.current[view?.dataset.pageFile]?.sections;
  if (!Array.isArray(sections)) {
    for (const [id, markup] of Object.entries(html)) {
      const tpl = doc.createElement('template');
      tpl.innerHTML = markup;
      const next = tpl.content.firstElementChild;
      if (next) els.get(id)?.replaceWith(next);
    }
    return;
  }
  let prev = null;
  sections.forEach((s, at) => {
    let el = els.get(s.id);
    if (html[s.id] !== undefined) {
      const tpl = doc.createElement('template');
      tpl.innerHTML = html[s.id];
      const next = tpl.content.firstElementChild;
      if (el) el.replaceWith(next);
      else if (prev) prev.after(next);
      else view.prepend(next);
      el = next;
      rendered.set(el, keyOf(s, at));
    }
    if (el) prev = el;
  });
}
