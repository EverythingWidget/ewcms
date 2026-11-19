/**
 * The layout overlay, drawn in the preview over the page (in its own Shadow DOM, so neither
 * the site's styles nor the editor's reach it):
 *
 *   Grid      the square cells (120 columns, the phone grid's 60, and its rows, all one
 *             --cell: src/render/layout/flow.js) of the selected widget's section only, while a
 *             widget is selected (and so while it is dragged or resized) or an empty
 *             section's settings pop-up is open (ui.section), from the section's own computed grid: faint white lines, every 5th a little stronger. Nothing
 *             selected: no grid
 *   Arrange   arrange clicks (ui.svelte.js previewClicks: Pages, not a page's Element motion tab): a click picks a widget (the widget inspector opens),
 *             a click on empty space (no widget, handle, circle or link line) or Esc (keys.js)
 *             drops the selection (the panel shows the sections again),
 *             a drag moves it and the handles on its edges and corners resize it. A press
 *             on its body hides the handles and the toolbar until release (a resize from a
 *             handle keeps them); a double click edits a text in place (preview-edit.js), the
 *             page's own clicks are off. A drag snaps to the cells and shows its area live
 *             (the widget's CSS variables, and the
 *             widgets that follow it move along); on release it is one edit, one undo step
 *             (onplace), which also stores where the section's other widgets are now (their
 *             real rows). A linked widget dragged up or down keeps its link: its gap changes.
 *             Esc cancels. Below 760px (the phone preview) a drag edits the widget's phone
 *             area, on the phone grid of 60 columns (widgets without one stack full width in
 *             reading order: that is where the drag starts; the first phone edit gives the
 *             section's widgets those places as their own). An aspect or auto widget's rows
 *             follow its width: only its sides resize (an Aspect corner keeps its ratio).
 *   Links     the selected widget only shows a filled circle above its top edge (drag it) and
 *             an empty one below its bottom edge (a drop target only; a hovered widget shows
 *             none: select it first). Hovering the filled circle shows the widgets it may link
 *             to: their empty circles and a dim frame. Dragging a widget's top circle onto another widget's
 *             bottom circle (in its section; widgets that would make a loop show none) links
 *             it: it follows that widget, keeping where it is (the gap: the rows between them
 *             now, negative when they overlap); dropped anywhere else, a linked widget is free
 *             again (onlink). A line joins every leader's bottom to its followers' tops; a
 *             click on one selects that link, Delete or Backspace removes it. The phone
 *             preview shows and edits the phone links. No page text is selected
 *             while a circle is dragged (user-select off on the page until it ends).
 *   Rows      a Custom height section shows a line on its bottom edge (the hovered section's,
 *             or the selected widget's): dragged up or down it sets the section's rows, in
 *             whole cells, never fewer than its content needs, the count shown live; on
 *             release one undo step (onrows). On the phone preview it sets the section's own
 *             phone rows (phone.rows.min; without them: half the desktop rows, rounded up).
 *             A widget dragged or resized past a Custom section's bottom: on release its rows
 *             become the content's (onplace's rows), so moving it back up leaves empty rows.
 *
 * A widget is where the site's rows.js put it (--fr / --frs: a linked widget below its leader,
 * auto and aspect widgets the rows they need), so a drag starts from there; while it runs the
 * page holds its rows (data-flow-hold on <html>).
 *
 * The overlay follows the page with a frame loop while it shows something; it reads `ui`
 * (clicks(), widget, link) every frame, and the section metrics once per drag, so the grid
 * doesn't move under the pointer while the page reflows.
 */
import { COLS, MCOLS, makesLoop, ratioOf, sizeOf } from '../render/layout/index.js';

/** An Auto widget's height dragged by fewer rows than this: a stray drag, nothing changes. */
const STRAY_ROWS = 2;
import { templateHit } from './lib/template-hit.js';
import { aspectRows, resolveRows } from '../render/layout/flow.js';
import {
  flowAreas,
  linesOf,
  linkOfEl as linkAttr,
  nearest,
  boxOf,
  rectOf,
  tracksOf,
} from '../render/layout/geometry.js';
import { PHONE_MAX } from '../render/layout/grid.js';
import { clampDelta, hits, selectedIds, toggle } from './multi-select.js';
import { createOverlayRows } from './overlay-rows.js';
import { reveal } from './reveal.js';
import { T } from './ui-tokens.js';
import { hotWidget, peekSection, selectLink, setAnchor } from './svelte/ui.svelte.js';
import { shownPlace, tagHtml } from './widget-tag.js';

const PHONE_W = PHONE_MAX;
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
/** How far a link circle sits outside its widget's edge, px (clear of the n / s handles). */
const DOT = 12;
/** How near the pointer must come to a bottom circle to drop a link on it, px. */
const REACH = 24;
const SVG = 'http://www.w3.org/2000/svg';
/** The room a section's name tag needs above its top edge, px; less: the tag goes inside. */
const TAG_ROOM = 24;

const STYLE = `
:host { all: initial; }
.layer { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; font: 500 ${T.fsXs}/1 ${T.font}; }
.grid { position: absolute; box-sizing: border-box; }
.cells { position: absolute; background-image: linear-gradient(to right, rgb(255 255 255 / .12) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / .12) 1px, transparent 1px), linear-gradient(to right, rgb(255 255 255 / .06) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / .06) 1px, transparent 1px); box-shadow: inset -1px -1px 0 rgb(255 255 255 / .12); }
.box { position: absolute; box-sizing: border-box; border-radius: ${T.radiusXs}; }
.marquee { position: absolute; box-sizing: border-box; border: 1px solid ${T.accent}; background: rgb(${T.accentRgb} / .12); }
.block { position: absolute; background: rgb(0 0 0 / .5); pointer-events: auto; cursor: not-allowed; }
.hover { border: 1px dashed ${T.white}; opacity: .7; }
.peek { border-radius: 0; border: 1px solid ${T.peekLine}; }
.peek .tag { position: absolute; left: -1px; bottom: 100%; margin-bottom: 4px; padding: 4px 8px; border-radius: ${T.radiusSm}; background: rgb(255 255 255 / .9); color: ${T.black}; white-space: nowrap; }
.peek.is-inside .tag { left: 4px; top: 4px; bottom: auto; margin: 0; }
.sel { border: 2px solid ${T.accent}; }
.sel.is-dragging { background: ${T.accent}; background: rgb(${T.accentRgb} / .08); }
.label { display: none; position: absolute; right: 0; bottom: 100%; margin-bottom: 8px; padding: 4px 8px; border-radius: ${T.radiusSm}; background: ${T.accent}; color: ${T.black}; font: 500 12px/1 ${T.font}; white-space: nowrap; }
.label .auto { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 16px; margin: -4px 4px -4px -4px; vertical-align: middle; border-radius: ${T.radiusXs}; color: color-mix(in srgb, ${T.black} 45%, ${T.accent}); pointer-events: auto; cursor: pointer; }
.label .auto svg { position: static; width: 8px; height: 12px; fill: currentColor; }
.label .auto:hover { background: rgb(0 0 0 / .14); color: ${T.black}; }
.label .auto.is-on { background: ${T.black}; color: ${T.accent}; }
.label .ch { margin: 0 -4px; padding: 0 4px; border-radius: ${T.radiusXs}; background: ${T.black}; color: ${T.accent}; font-weight: inherit; }
.handle { position: absolute; width: 12px; height: 12px; translate: -50% -50%; box-sizing: border-box; border: 2px solid ${T.accent}; border-radius: ${T.radiusXs}; background: ${T.black}; pointer-events: auto; }
.handle[data-h='n'], .handle[data-h='s'] { left: 50%; cursor: ns-resize; }
.handle[data-h='e'], .handle[data-h='w'] { top: 50%; cursor: ew-resize; }
.handle[data-h='n'], .handle[data-h='ne'], .handle[data-h='nw'] { top: 0; }
.handle[data-h='s'], .handle[data-h='se'], .handle[data-h='sw'] { top: 100%; }
.handle[data-h='w'], .handle[data-h='nw'], .handle[data-h='sw'] { left: 0; }
.handle[data-h='e'], .handle[data-h='ne'], .handle[data-h='se'] { left: 100%; }
.handle[data-h='ne'], .handle[data-h='sw'] { cursor: nesw-resize; }
.handle[data-h='nw'], .handle[data-h='se'] { cursor: nwse-resize; }
/* the whole left / right edge resizes too (a tall widget's middle handle can be off screen) */
.edge { position: absolute; top: 0; bottom: 0; width: 12px; translate: -50% 0; pointer-events: auto; cursor: ew-resize; }
.edge[data-h='w'] { left: 0; }
.edge[data-h='e'] { left: 100%; }
/* its text edited: the frame only, so the handles and edges don't cover its words (F109) */
.sel.is-editing .handle, .sel.is-editing .edge { display: none; }
.sel.is-free.is-phone .handle:not([data-h='e']):not([data-h='w']) { display: none; }
/* Auto (its height follows its content): only its sides resize; its top or bottom edge dragged
   gives it rows (Size Rows, the toggle off) */
.sel.is-auto .handle:not([data-h='e']):not([data-h='w']) { display: none; }
/* inside its box only: a widget right under or over it (a tight stack) stays clickable there */
.edge[data-h='n'], .edge[data-h='s'] { display: none; left: 0; right: 0; top: 0; bottom: auto; width: auto; height: 8px; translate: 0; cursor: ns-resize; }
.edge[data-h='s'] { top: 100%; translate: 0 -100%; }
.sel.is-auto:not(.is-phone) .edge[data-h='n'], .sel.is-auto:not(.is-phone) .edge[data-h='s'] { display: block; }
/* a move (the body pressed or dragged, not a resize): handles and edges hidden in place */
.sel.is-moving .handle, .sel.is-moving .edge { visibility: hidden; pointer-events: none; }
.dot { position: absolute; left: 50%; width: 12px; height: 12px; translate: -50% -50%; box-sizing: border-box; border: 2px solid ${T.accent}; border-radius: 50%; background: ${T.black}; pointer-events: auto; }
.dot[data-dot='top'] { top: -${DOT}px; background: ${T.accent}; cursor: grab; }
.dot[data-dot='top']:hover { box-shadow: 0 0 0 4px rgb(${T.accentRgb} / .35); }
.dot[data-dot='bottom'] { top: calc(100% + ${DOT}px); cursor: default; pointer-events: none; }
.sel.is-dragging .dot, .is-linking .box .dot { display: none; }
/* the widget's section card hovered: its section only (no grid, links or targets) */
.is-peeking .grids, .is-peeking .links, .is-peeking .targets { display: none; }
.target { position: absolute; width: 12px; height: 12px; translate: -50% -50%; box-sizing: border-box; border: 2px solid rgb(255 255 255 / .7); border-radius: 50%; background: ${T.black}; }
.target.is-near { width: 16px; height: 16px; border-color: ${T.accent}; background: ${T.accent}; box-shadow: 0 0 0 4px rgb(${T.accentRgb} / .35); }
.tframe { position: absolute; box-sizing: border-box; border: 1px solid rgb(255 255 255 / .25); border-radius: ${T.radiusXs}; }
.tframe.is-near { border: 2px solid ${T.accent}; }
.secrow { position: absolute; height: 12px; translate: 0 -50%; pointer-events: auto; cursor: row-resize; }
.secrow::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 0; border-top: 2px solid rgb(255 255 255 / .75); translate: 0 -50%; box-shadow: 0 0 0 1px rgb(0 0 0 / .35); }
.secrow::after { content: ''; position: absolute; left: 50%; top: 50%; width: 36px; height: 8px; translate: -50% -50%; box-sizing: border-box; border-radius: ${T.radiusSm}; background: ${T.white}; box-shadow: 0 0 0 1px rgb(0 0 0 / .45); }
.secrow:hover::before, .secrow.is-dragging::before { border-top-color: ${T.white}; }
.secrow .count { position: absolute; left: calc(50% + 28px); bottom: 100%; margin-bottom: 4px; padding: 4px 8px; border-radius: ${T.radiusSm}; background: ${T.white}; color: ${T.black}; white-space: nowrap; }
.secrow:not(.is-dragging) .count { display: none; }
svg { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.link { fill: none; stroke: ${T.accent}; stroke-width: 2; }
.link.is-sel { stroke: ${T.white}; stroke-width: 3; }
.link.is-temp { stroke-dasharray: 4 4; }
.hit { fill: none; stroke: transparent; stroke-width: 14; pointer-events: stroke; cursor: pointer; }
.gap { fill: ${T.accent}; font: 500 ${T.fsXs} ${T.font}; paint-order: stroke; stroke: ${T.black}; stroke-width: 3px; }
`;

/**
 * clicks(): what a click in the preview does (ui.svelte.js previewClicks; it arranges only on
 * 'arrange'); onpick(id): a widget was clicked; onplace(id, pos, { phone, flow, rows }): a drag ended with
 * the widget at `pos` (phone: its phone area; flow: where the section's widgets are now, { id:
 * area }, and rows: the rows its content needs now); onlink(id, to, gap, { phone }): widget `id` follows `to`
 * with `gap` cells between them (to null: it is free again); widgetOf(id): the stored widget
 * (null when it isn't on the page); secNameOf(id): a section's name for its tag ("Section N"
 * without one); onrows(secId, rows, { phone }): a Custom section's bottom
 * edge was dragged to `rows` (the phone's rows when phone); onsectionpick(secId): a click on a
 * section's empty space (it alone selected); onsize(id, size, rows): the tag's Auto toggle
 * clicked ('auto' or 'rows'; rows: the desktop rows it shows now).
 */
export function createOverlay({
  ui,
  clicks = () => 'visitor',
  onpick,
  onopen,
  onplace,
  onlink = () => {},
  onrows = () => {},
  onselect = () => {},
  onsectionpick = () => {},
  ongroupmove = () => {},
  onsize = () => {},
  widgetOf,
  secNameOf = () => '',
  draw = () => false,
}) {
  /**
   * The overlay's one state (its parts read and write this object, never a copy): the
   * preview's document and window, the layer and its elements, the gesture running (one
   * at a time: a widget's drag, a group's, a selection box, a section's rows, a link) and the
   * draw loop's own fields.
   */
  const S = {
    doc: null,
    win: null,
    root: null, // the shadow root's layer
    els: {},
    drag: null, // a widget being moved or resized
    group: null, // several selected widgets being dragged together
    boxing: null, // a selection box being drawn on a section's empty grid
    sizing: null, // a section's bottom edge being dragged
    linking: null, // a widget's top circle being dragged
    hover: null,
    hoverSec: null,
    // the loop: the frame asked for, and it idles: kick() runs it for IDLE ms more (the page,
    // the pointer or a key changed)
    raf: 0,
    idleUntil: 0,
    anims: 0, // the preview's running transitions and animations
    frames: 0, // frames drawn (the tests count them)
    due: false, // the overlay's own drawing runs this frame (kick(), or something moves)
  };
  const IDLE = 500;
  const now = () => performance.now();
  /** The next frame asked for (once). */
  function wake() {
    if (!S.raf && S.win && S.root) S.raf = S.win.requestAnimationFrame(frame);
  }
  function kick() {
    S.idleUntil = now() + IDLE;
    S.due = true;
    wake();
  }
  let tagShown = ''; // the tag's HTML now (set only when it changes)
  let gridKey = '';

  const arranging = () => clicks() === 'arrange';
  const shown = () => S.doc && arranging();
  const isPhone = () => S.win.innerWidth <= PHONE_W;
  /**
   * The Grid Engine: an item template open (ui.target.kind 'item-template'), the overlay arranges
   * its item instead of the page: the preview's one item (the first .sec--item, the template's one
   * section: src/widgets/list/item-grid.js) is the section, its own widgets
   * (.sec--item > .wgt[data-tw]) the widgets, dragged, resized and linked as a page's (the
   * writes go to the template's file: main.js widgetAt, its /sections/0). The preview page
   * around it (its List) is never picked, and a List on a page is one widget: a template's
   * widgets are arranged in the template's own editor only.
   */
  const tplOpen = () => ui.target?.kind === 'item-template';
  /** The template's item in the preview (an inner List's items are inside it), else null. */
  const tplSec = () => (S.doc && tplOpen() ? S.doc.querySelector('.sec--item') : null);
  /** A widget element's id: its data-widget (a page's), its data-tw (a template's). */
  const idOf = (el) => (el ? (tplOpen() ? el.dataset.tw : el.dataset.widget) : undefined);
  const widgetEl = (id) => {
    if (!id || !S.doc) return null;
    if (!tplOpen()) return S.doc.querySelector(`[data-widget="${CSS.escape(id)}"]`);
    return tplSec()?.querySelector(`:scope > [data-tw="${CSS.escape(id)}"]`) || null;
  };
  /** The widget under `t` (an element): a page's, or the open template's own (not an inner List item's). */
  const widgetAt = (t) => {
    if (!tplOpen()) return t?.closest?.('[data-widget]') || null;
    const sec = tplSec();
    let n = t?.closest?.('[data-tw]');
    while (n && n.parentElement !== sec) n = n.parentElement?.closest('[data-tw]');
    return n || null;
  };

  /** The element pointer event `e` is on: a clickable template item's, found by position (./lib/template-hit.js). */
  const hitOf = (e) => {
    const sec = tplSec();
    return sec ? templateHit(e.target, sec, e.clientX, e.clientY, widgetsIn(sec)) : e.target;
  };

  const secOf = (el) => {
    if (!tplOpen()) return el?.closest('[data-sec]');
    const sec = tplSec();
    return el && sec?.contains(el) ? sec : null;
  };
  /** A section's id (a template's item: its one section, 'item'). */
  const secKey = (sec) => (tplOpen() ? 'item' : sec?.dataset.sec);
  /** Is a section editable now: the footer's while it is open, the page's while no site part is. */
  const live = (sec) =>
    tplOpen() ||
    (!S.doc.querySelector('[data-header][data-ed-open]') &&
      !!sec.closest('[data-footer]') === !!S.doc.querySelector('[data-footer][data-ed-open]'));
  const secById = (id) =>
    tplOpen() ? null : S.doc.querySelector(`[data-sec="${CSS.escape(id)}"]:not([hidden])`);
  /** The section under the pointer in the preview: its row in the Sections tab shows it. */
  const peekAt = (sec) => peekSection(tplOpen() ? null : sec?.dataset.sec, 'preview');
  const unpeek = () => peekAt(null);
  /** The widget under the pointer in the preview: its row in the Sections tab lights. */
  const hotAt = (id) => hotWidget(id, 'preview');
  /** The widget elements of a section (not a nested section's). */
  const widgetsIn = (sec) =>
    tplOpen()
      ? [...sec.children].filter((n) => n.matches('[data-tw]'))
      : [...sec.querySelectorAll('[data-widget]')].filter((n) => secOf(n) === sec);
  /** Where a section's widgets are now (geometry.js flowAreas, with the template's own). */
  const flowOf = (sec, phone) => flowAreas(sec, phone, widgetOf, widgetsIn(sec), idOf);
  /** The link a widget element follows on the grid shown: { to, gap } or null. */
  const linkOfEl = (el) => linkAttr(el, isPhone());

  function build() {
    const host = S.doc.createElement('div');
    host.id = '__ed-layout';
    host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483645;';
    const shadow = host.attachShadow({ mode: 'open' });
    const dots = '<i class="dot" data-dot="top"></i><i class="dot" data-dot="bottom"></i>';
    linkEls.clear();
    svgSize = '';
    tempPath = null;
    shadow.innerHTML = `<style>${STYLE}</style><div class="layer"><div class="grids"></div><svg class="links" xmlns="${SVG}"></svg><div class="box peek" hidden><span class="tag"></span></div><div class="secrow" hidden><span class="count"></span></div><div class="box hover" hidden></div><div class="box sel" hidden><span class="label"></span><i class="edge" data-h="w"></i><i class="edge" data-h="e"></i><i class="edge" data-h="n"></i><i class="edge" data-h="s"></i>${HANDLES.map((h) => `<i class="handle" data-h="${h}"></i>`).join('')}${dots}</div><div class="targets"></div><div class="multi"></div><div class="marquee" hidden></div><div class="blocks"></div></div>`;
    S.root = shadow.querySelector('.layer');
    S.els.grids = S.root.querySelector('.grids');
    S.els.links = S.root.querySelector('.links');
    S.els.hover = S.root.querySelector('.hover');
    S.els.peek = S.root.querySelector('.peek');
    S.els.tag = S.root.querySelector('.tag');
    S.els.sel = S.root.querySelector('.sel');
    S.els.label = S.root.querySelector('.label');
    S.els.targets = S.root.querySelector('.targets');
    S.els.secrow = S.root.querySelector('.secrow');
    S.els.count = S.root.querySelector('.count');
    S.els.multi = S.root.querySelector('.multi');
    S.els.marquee = S.root.querySelector('.marquee');
    S.els.blocks = S.root.querySelector('.blocks');
    shadow.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      // another section while Ctrl/Cmd is held with a selection: not clickable
      if (e.target.closest?.('.block')) return void (e.preventDefault(), e.stopPropagation());
      if (e.target.closest?.('.secrow')) return startRows(e);
      // the tag's Auto toggle: Auto ↔ Rows (the rows it shows now), one undo step
      if (e.target.closest?.('[data-auto]') && ui.widget && !S.drag) {
        e.preventDefault();
        e.stopPropagation();
        const el = widgetEl(ui.widget);
        if (!el) return;
        const auto = sizeOf(widgetOf(ui.widget)) === 'auto';
        const rows = shownPlace(el, S.win).rows;
        onsize(ui.widget, auto ? 'rows' : 'auto', isPhone() ? rows * 2 : rows);
        return kick();
      }
      const h = e.target.dataset?.h;
      if (h && ui.widget) return start(e, widgetEl(ui.widget), h);
      const dot = e.target.dataset?.dot;
      if (dot === 'top') {
        const el = widgetEl(ui.widget);
        if (el) startLink(e, el);
        return;
      }
      const link = e.target.dataset?.link;
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        selectLink(link);
        kick();
      }
    });
    // the filled top circle hovered: the widgets it may link to show (their empty circles, a dim frame)
    shadow.addEventListener('pointerover', (e) => {
      if (e.target.dataset?.dot !== 'top' || S.linking) return;
      const el = widgetEl(ui.widget);
      if (el) showTargets(el);
    });
    shadow.addEventListener('pointerout', (e) => {
      if (e.target.dataset?.dot === 'top' && !S.linking) S.els.targets.replaceChildren();
    });
    S.doc.body.appendChild(host);
    return host;
  }

  const place = (box, r) => {
    box.style.left = `${r.x}px`;
    box.style.top = `${r.y}px`;
    box.style.width = `${r.w}px`;
    box.style.height = `${r.h}px`;
  };

  // ---- its parts (overlay-*.js): each a factory given `ctx` (the one state S, never a copy,
  // and the helpers above); what it gives is added to ctx for the parts after it. None imports
  // this file.
  const ctx = { S, ui, tplOpen, isPhone, secOf, widgetEl, flowOf, secKey, kick, onrows };
  const { minOf, customOf, startRows } = Object.assign(ctx, createOverlayRows(ctx));

  /**
   * The grid of the selected (or dragged) widget's section, none without one: rebuilt when that
   * section, its size or its tracks change.
   */
  function drawGrids() {
    const sec = arranging()
      ? S.drag?.sec ||
        S.group?.sec ||
        S.boxing?.sec ||
        secOf(widgetEl(selectedIds(ui)[0])) ||
        (ui.section && secById(ui.section))
      : null;
    const secs = sec && !sec.hidden ? [sec] : [];
    const info = secs.map((sec) => {
      const cs = S.win.getComputedStyle(sec);
      return { sec, cs, r: rectOf(sec, S.win) };
    });
    const key = info
      .map(({ sec, cs, r }) =>
        [secKey(sec), r.x, r.y, r.w, r.h, cs.gridTemplateColumns, cs.gridTemplateRows].join(),
      )
      .join('|');
    if (`${secs.length}:${key}` === gridKey) return;
    gridKey = `${secs.length}:${key}`;
    S.els.grids.replaceChildren(
      ...info.map(({ cs, r }) => {
        const g = S.doc.createElement('div');
        g.className = 'grid';
        place(g, r);
        // the cells: the tracks as they are laid out (centred in the content box: the few px
        // a whole number of cells leaves over), a line every cell and a stronger one every 5th
        const t = tracksOf(cs, r);
        const cell = t.cols[0] || 8;
        const c = S.doc.createElement('div');
        c.className = 'cells';
        place(c, t);
        c.style.backgroundSize = `${cell * 5}px ${cell * 5}px, ${cell * 5}px ${cell * 5}px, ${cell}px ${cell}px, ${cell}px ${cell}px`;
        g.append(c);
        return g;
      }),
    );
  }

  /** A link's line from a leader's bottom circle to a follower's top circle (page px). */
  const curve = (x1, y1, x2, y2) => {
    const k = Math.max(16, Math.abs(y2 - y1) / 2);
    return `M${x1} ${y1}C${x1} ${y1 + k} ${x2} ${y2 - k} ${x2} ${y2}`;
  };
  const bottomDot = (r) => [r.x + r.w / 2, r.y + r.h + DOT];
  const topDot = (r) => [r.x + r.w / 2, r.y - DOT];

  // the link lines kept between frames, by follower id: a change sets only what changed
  const linkEls = new Map();
  let svgSize = '';
  let tempPath = null;
  const R = (v) => Math.round(v * 10) / 10;
  const attr = (n, k, v) => {
    if (n.getAttribute(k) !== v) n.setAttribute(k, v);
  };
  const svgEl = (tag, cls) => {
    const n = S.doc.createElementNS(SVG, tag);
    n.setAttribute('class', cls);
    return n;
  };
  /** The tag's rect on the page (the gap labels keep clear of it), or null. */
  function tagRect() {
    if (S.els.sel.hidden) return null;
    const r = S.els.label.getBoundingClientRect();
    return r.width
      ? { x: r.left + S.win.scrollX, y: r.top + S.win.scrollY, w: r.width, h: r.height }
      : null;
  }
  /**
   * A gap label's place: left of the line's middle (the tag sits at the follower's top right),
   * further left when it would still touch the tag. Returns [x, y] for text-anchor end.
   */
  function gapAt(mx, my, text, tag) {
    const w = text.length * 7.3; // DM Mono 12px
    let x = mx - 6;
    const y = my + 4;
    if (
      tag &&
      x > tag.x - 4 &&
      x - w < tag.x + tag.w + 4 &&
      y > tag.y - 4 &&
      y - 12 < tag.y + tag.h + 4
    )
      x = tag.x - 8;
    return [R(x), R(y)];
  }

  /** The links of the shown sections as lines (and the one being dragged). */
  function drawLinks() {
    // the page's size without the svg itself: sized to the document's scroll size, it would
    // hold a taller page's height after going to a shorter one (it is part of that size)
    const h = S.doc.documentElement;
    const body = S.doc.body;
    const size = `${body.scrollWidth}x${body.scrollHeight}`;
    if (size !== svgSize) {
      svgSize = size;
      S.els.links.setAttribute('width', 0);
      S.els.links.setAttribute('height', 0);
      S.els.links.setAttribute('width', h.scrollWidth);
      S.els.links.setAttribute('height', h.scrollHeight);
    }
    const seen = new Set();
    const tag = tagRect();
    if (arranging())
      for (const sec of tplOpen()
        ? [tplSec()].filter(Boolean)
        : S.doc.querySelectorAll('[data-sec]:not([hidden])'))
        for (const el of live(sec) ? widgetsIn(sec) : []) {
          const l = linkOfEl(el);
          if (!l || el.hidden || S.linking?.el === el) continue;
          const lead = widgetsIn(sec).find((n) => idOf(n) === l.to);
          if (!lead || lead.hidden) continue;
          const [x1, y1] = bottomDot(boxOf(lead, S.win)).map(R);
          const [x2, y2] = topDot(boxOf(el, S.win)).map(R);
          const id = idOf(el);
          seen.add(id);
          let e = linkEls.get(id);
          if (!e) {
            e = {
              line: svgEl('path', 'link'),
              hit: svgEl('path', 'hit'),
              gap: svgEl('text', 'gap'),
            };
            e.hit.dataset.link = id;
            e.gap.setAttribute('text-anchor', 'end');
            S.els.links.append(e.line, e.hit, e.gap);
            linkEls.set(id, e);
          }
          const d = curve(x1, y1, x2, y2);
          attr(e.line, 'd', d);
          attr(e.hit, 'd', d);
          attr(e.line, 'class', ui.link === id ? 'link is-sel' : 'link');
          const near = [ui.widget, ui.link].includes(id) || ui.widget === l.to;
          e.gap.style.display = near ? '' : 'none';
          if (near) {
            const text = `gap ${gapOf(id, l)}`;
            if (e.gap.textContent !== text) e.gap.textContent = text;
            const [gx, gy] = gapAt((x1 + x2) / 2, (y1 + y2) / 2, text, tag);
            attr(e.gap, 'x', `${gx}`);
            attr(e.gap, 'y', `${gy}`);
          }
        }
    for (const [id, e] of linkEls)
      if (!seen.has(id)) {
        e.line.remove();
        e.hit.remove();
        e.gap.remove();
        linkEls.delete(id);
      }
    if (S.linking?.to) {
      tempPath ??= S.els.links.appendChild(svgEl('path', 'link is-temp'));
      attr(tempPath, 'd', curve(...S.linking.to.map(R), ...S.linking.from.map(R)));
    } else if (tempPath) {
      tempPath.remove();
      tempPath = null;
    }
  }

  // the selected widget's tag: its type only (its gap shows on its link line, live)

  // a link's gap as shown: the dragged widget's live one (show()), else the stored one
  const gapOf = (id, l) => (S.drag?.id === id && S.drag.gap != null ? S.drag.gap : l.gap);

  /**
   * The section card hovered in the Sections tab, else the one selected (`sec`, null: none): a soft white 1px line on
   * its section and its name in a tag above its top edge, left (just inside it when there is
   * no room above, e.g. the first section). Only it is outlined: nothing else is dimmed (a row
   * hovered highlights, it doesn't fade the page). All on this layer: the page's own styles don't change (no reflow).
   */
  function drawPeek(sec) {
    S.els.peek.hidden = !sec;
    if (!sec) return;
    const r = rectOf(sec, S.win);
    place(S.els.peek, r);
    S.els.peek.classList.toggle('is-inside', r.y - S.win.scrollY < TAG_ROOM);
    const name = secNameOf(sec.dataset.sec);
    S.els.tag.hidden = !name;
    if (S.els.tag.textContent !== name) S.els.tag.textContent = name;
  }

  /**
   * The editor's one draw loop: the preview's boxes (draw(): preview-runtime.js drawBoxes) every
   * frame they ask for, the overlay's own (layout()) only while it is due; then it idles.
   */
  function frame() {
    S.raf = 0;
    if (!S.root?.isConnected) return;
    const more = draw();
    if (S.due) layout();
    if (more || S.due) S.raf = S.win.requestAnimationFrame(frame);
  }

  function layout() {
    drawGrids();
    drawLinks();
    // the widget's section card hovered (ui.peek from the panel): only its section shows
    // (not over a widget row: its widget shows, selected or outlined)
    const peeking = !!ui.widget && ui.peek?.from === 'panel' && ui.hot?.from !== 'panel';
    S.root.classList.toggle('is-peeking', peeking);
    const arrange = arranging() && !peeking;
    S.root.classList.toggle('is-linking', !!S.linking);
    const sel = arrange ? widgetEl(ui.widget) : null;
    S.els.sel.hidden = !sel;
    if (sel) {
      place(S.els.sel, boxOf(sel, S.win));
      const widget = widgetOf(ui.widget);
      S.els.sel.classList.toggle('is-free', sizeOf(widget) !== 'rows');
      S.els.sel.classList.toggle('is-phone', isPhone());
      // its size and place, the snapped ones while dragged or resized (widget-tag.js)
      const dragging = S.drag?.id === ui.widget && S.drag.pos;
      // Auto: off once its top or bottom edge is dragged (it gets rows on release)
      const auto =
        sizeOf(widget) === 'auto' &&
        !(dragging && /[ns]/.test(S.drag.h) && S.drag.pos.rows !== S.drag.from.rows);
      S.els.sel.classList.toggle('is-auto', auto);
      // its text edited: no handles or edges over its words and links (F109)
      S.els.sel.classList.toggle('is-editing', !!sel.querySelector('[contenteditable]'));
      const label = tagHtml(
        dragging ? S.drag.pos : shownPlace(sel, S.win),
        dragging ? S.drag.from : null,
        auto,
      );
      if (label !== tagShown) S.els.label.innerHTML = tagShown = label;
    }
    // the section card hovered in the Sections tab, else the one selected while the list shows:
    // its section (under the widget boxes)
    // (a widget row hovered: only its widget is outlined, not its section too)
    const peekId =
      ui.hot?.from === 'panel'
        ? null
        : ui.peek?.from === 'panel'
          ? ui.peek.id
          : !ui.widget && !ui.section && ui.selSection;
    const p = (arrange || peeking) && !S.drag && peekId ? secById(peekId) : null;
    drawPeek(p);
    // a Custom section's bottom edge: the one being dragged, hovered, or the selected widget's
    const rs =
      arrange && !S.drag && !S.linking
        ? S.sizing?.sec || customOf(S.hoverSec) || customOf(secOf(sel))
        : null;
    S.els.secrow.hidden = !rs;
    if (rs) {
      const r = rectOf(rs, S.win);
      place(S.els.secrow, { x: r.x, y: r.y + r.h, w: r.w, h: 12 });
      S.els.secrow.classList.toggle('is-dragging', !!S.sizing);
      if (S.sizing)
        S.els.count.textContent = `${S.sizing.phone ? 'phone · ' : ''}${S.sizing.rows} rows`;
    }
    drawMulti(arrange);
    drawBlocks(arrange);
    S.els.marquee.hidden = !S.boxing?.box;
    if (S.boxing?.box) place(S.els.marquee, S.boxing.box);
    // the pointer's widget, else the one whose row is hovered in the panel
    const hov = S.hover || (ui.hot?.from === 'panel' ? widgetEl(ui.hot.id) : null);
    const h =
      arrange && hov !== sel && !S.drag && !S.group && !S.boxing && !ui.multi.includes(idOf(hov))
        ? hov
        : null;
    S.els.hover.hidden = !h;
    if (h) {
      place(S.els.hover, boxOf(h, S.win));
    }
    S.frames++;
    // again only while something moves: a drag, a resize, a box, a link drawn, a running
    // transition or animation, or for a moment after the page, the pointer or a key changed
    S.due =
      !!shown() &&
      !!(
        S.drag ||
        S.group ||
        S.boxing ||
        S.sizing ||
        S.linking ||
        S.anims > 0 ||
        now() < S.idleUntil
      );
  }

  // ---- multi-select (multi-select.js): two or more widgets, one section, all alike

  /** Each selected widget's box: the same border, no handles or circles (the count: SectionToolbar). */
  function drawMulti(arrange) {
    const els2 = arrange ? ui.multi.map(widgetEl).filter((n) => n && !n.hidden) : [];
    const boxes = S.els.multi.children;
    while (boxes.length > els2.length) boxes[boxes.length - 1].remove();
    while (boxes.length < els2.length) S.els.multi.append(S.doc.createElement('div'));
    const rs = els2.map((n) => boxOf(n, S.win));
    rs.forEach((r, i) => {
      boxes[i].className = `box sel${S.group ? ' is-dragging' : ''}`;
      place(boxes[i], r);
    });
  }

  /**
   * Ctrl/Cmd held (ui.mod) with a selection: every other section is dimmed and not clickable
   * (a box over it that takes the click, the not-allowed cursor).
   */
  function drawBlocks(arrange) {
    const ids = selectedIds(ui);
    const sec =
      arrange && ui.mod && ids.length && !S.drag && !S.group ? secOf(widgetEl(ids[0])) : null;
    const others =
      sec && !tplOpen()
        ? [...S.doc.querySelectorAll('[data-sec]:not([hidden])')].filter(
            (s) =>
              s !== sec && live(s) && !s.parentElement.closest('[data-sec]') && !s.contains(sec),
          )
        : [];
    const blocks = S.els.blocks.children;
    while (blocks.length > others.length) blocks[blocks.length - 1].remove();
    while (blocks.length < others.length) S.els.blocks.append(S.doc.createElement('div'));
    others.forEach((s, i) => {
      blocks[i].className = 'block';
      place(blocks[i], rectOf(s, S.win));
    });
  }

  const secIdOf = (id) => secKey(secOf(widgetEl(id)));

  /** The step of one cell (px) on a section's lines: columns, rows. */
  const stepsOf = (lines) => ({
    col: lines.cols.starts[1] - lines.cols.starts[0] || lines.row + lines.rowGap,
    row: lines.row + lines.rowGap,
  });

  /** What a group move starts from: the section, its flow, the members' areas. */
  function groupOf(ids) {
    const sec = secOf(widgetEl(ids[0]));
    if (!sec) return null;
    const phone = isPhone();
    const flow = flowOf(sec, phone);
    const members = ids
      .map((id) => ({ id, el: widgetEl(id), from: flow[id] }))
      .filter((m) => m.el && m.from);
    if (!members.length) return null;
    return { sec, phone, flow, members, cols: phone ? MCOLS : COLS };
  }

  /** A drag of the selected widgets `ids` (one of them, `el`, under the pointer): all move. */
  function startGroup(e, ids, el) {
    const g = groupOf(ids);
    if (!g) return;
    e.preventDefault();
    e.stopPropagation();
    const { sec, phone, flow } = g;
    const rows = Number(sec.style.getPropertyValue('--frows')) || 0;
    S.doc.documentElement.setAttribute('data-flow-hold', 'move');
    S.els.sel.classList.add('is-dragging', 'is-moving');
    S.group = {
      ...g,
      el,
      saved: new Map([sec, ...widgetsIn(sec)].map((n) => [n, n.style.cssText])),
      x: e.clientX,
      y: e.clientY,
      lines: linesOf(sec, S.win),
      items: widgetsIn(sec)
        .filter((n) => flow[idOf(n)])
        .map((n) => ({
          id: idOf(n),
          el: n,
          ...flow[idOf(n)],
          link: ids.includes(idOf(n)) ? null : linkOfEl(n),
        })),
      dc: 0,
      dr: 0,
      rows: rows || Number(sec.style.getPropertyValue(phone ? '--mrows' : '--rows')) || 1,
      min: minOf(sec, phone),
    };
    noSelect(true);
    S.win.addEventListener('pointermove', moveGroup, true);
    S.win.addEventListener('pointerup', endGroup, true);
    S.win.addEventListener('keydown', cancelGroup, true);
  }

  function moveGroup(e) {
    const st = stepsOf(S.group.lines);
    const areas = Object.fromEntries(S.group.members.map((m) => [m.id, m.from]));
    const d = clampDelta(
      areas,
      Math.round((e.clientX - S.group.x) / st.col),
      Math.round((e.clientY - S.group.y) / st.row),
      S.group.cols,
    );
    if (d.dc === S.group.dc && d.dr === S.group.dr) return;
    S.group.dc = d.dc;
    S.group.dr = d.dr;
    showGroup();
  }

  /** The members at their area + the delta, the widgets that follow them along (live). */
  function showGroup() {
    const { dc, dr, phone } = S.group;
    const at = {};
    for (const m of S.group.members) {
      at[m.id] = { ...m.from, col: m.from.col + dc, row: m.from.row + dr };
      setArea(m.el.style, at[m.id], phone);
    }
    const items = S.group.items.map((it) => (at[it.id] ? { ...it, ...at[it.id] } : it));
    const res = resolveRows(items, 1);
    for (const it of S.group.items)
      if (!at[it.id] && res.at[it.id]) it.el.style.setProperty('--fr', res.at[it.id].row);
    S.group.content = Math.max(res.rows, ...Object.values(at).map((p) => p.row + p.rows - 1));
    S.group.sec.style.setProperty('--frows', Math.max(S.group.min, S.group.rows, S.group.content));
  }

  function stopGroup() {
    S.doc.documentElement.removeAttribute('data-flow-hold');
    S.els.sel.classList.remove('is-dragging', 'is-moving');
    noSelect(false);
    S.win.removeEventListener('pointermove', moveGroup, true);
    S.win.removeEventListener('pointerup', endGroup, true);
    S.win.removeEventListener('keydown', cancelGroup, true);
  }

  function endGroup() {
    const g = S.group;
    stopGroup();
    S.group = null;
    const moved = g.dc || g.dr;
    if (!moved) {
      for (const [n, css] of g.saved) n.style.cssText = css;
      // a click (no move) on one of them: that one only
      setAnchor(idOf(g.el));
      onpick(idOf(g.el));
      return;
    }
    ongroupmove(
      g.members.map((m) => m.id),
      g.dc,
      g.dr,
      {
        phone: g.phone,
        flow: g.flow,
        rows: g.content || 0,
      },
    );
  }

  function cancelGroup(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    for (const [n, css] of S.group.saved) n.style.cssText = css;
    stopGroup();
    S.group = null;
  }

  /** Arrow keys: the selection moved by whole cells (clamped as a drag), one undo step. */
  function nudge(dc, dr) {
    const ids = selectedIds(ui);
    if (!S.doc || !arranging() || !ids.length) return false;
    const g = groupOf(ids);
    if (!g) return false;
    const d = clampDelta(Object.fromEntries(g.members.map((m) => [m.id, m.from])), dc, dr, g.cols);
    if (d.dc || d.dr)
      ongroupmove(
        g.members.map((m) => m.id),
        d.dc,
        d.dr,
        { phone: g.phone, flow: g.flow },
      );
    return true;
  }

  /**
   * A selection box: dragged on a section's empty grid, it selects the widgets it touches (in
   * that section; `base`: kept too, Ctrl/Cmd+drag). A click without a drag clears (or, with
   * Ctrl/Cmd, keeps) the selection.
   */
  function startBox(e, sec, base) {
    e.preventDefault();
    e.stopPropagation();
    if (S.doc.activeElement?.isContentEditable) S.doc.activeElement.blur();
    S.boxing = {
      sec,
      base,
      x: e.pageX,
      y: e.pageY,
      box: null,
      mod: base.length > 0 || e.ctrlKey || e.metaKey,
    };
    noSelect(true);
    S.win.addEventListener('pointermove', moveBox, true);
    S.win.addEventListener('pointerup', endBox, true);
    S.win.addEventListener('keydown', cancelBox, true);
    kick();
  }

  function moveBox(e) {
    const { sec, x, y } = S.boxing;
    if (!S.boxing.box && Math.hypot(e.pageX - x, e.pageY - y) < 4) return;
    // inside its section's grid
    const s = rectOf(sec, S.win);
    const cx = (v) => Math.min(Math.max(v, s.x), s.x + s.w);
    const cy = (v) => Math.min(Math.max(v, s.y), s.y + s.h);
    const x1 = cx(Math.min(x, e.pageX));
    const x2 = cx(Math.max(x, e.pageX));
    const y1 = cy(Math.min(y, e.pageY));
    const y2 = cy(Math.max(y, e.pageY));
    S.boxing.box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    const rects = Object.fromEntries(
      widgetsIn(sec)
        .filter((n) => !n.hidden && widgetOf(idOf(n)))
        .map((n) => [idOf(n), boxOf(n, S.win)]),
    );
    const ids = [...new Set([...S.boxing.base, ...hits(rects, S.boxing.box)])];
    if (ids.join() !== selectedIds(ui).join()) onselect(ids);
  }

  function stopBox() {
    noSelect(false);
    S.win.removeEventListener('pointermove', moveBox, true);
    S.win.removeEventListener('pointerup', endBox, true);
    S.win.removeEventListener('keydown', cancelBox, true);
  }

  function endBox() {
    const b = S.boxing;
    stopBox();
    S.boxing = null;
    // a click on a section's empty space: that section selected, alone (Ctrl/Cmd: the
    // selection stays)
    // (a template's item: nothing selected, its one section has no settings of its own here)
    if (b.box || b.mod) return;
    if (tplOpen()) onpick(null);
    else onsectionpick(b.sec.dataset.sec);
  }

  function cancelBox(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    const b = S.boxing;
    stopBox();
    S.boxing = null;
    onselect(b.base);
  }

  /** A drag of widget `el`: move (h empty) or a resize by handle `h`. */
  function start(e, el, h = '') {
    const id = idOf(el);
    const stored = widgetOf(id);
    if (!stored) return;
    e.preventDefault();
    e.stopPropagation();
    selectLink(null);
    // a resize (its handle) or a move ends a text edit: the next press on the widget drags it,
    // it doesn't select its text (it stayed editable after a resize); and no text selected meanwhile
    if (S.doc.activeElement?.isContentEditable) S.doc.activeElement.blur();
    noSelect(true);
    const sec = secOf(el);
    const phone = isPhone();
    const saved = new Map([sec, ...widgetsIn(sec)].map((n) => [n, n.style.cssText]));
    // where the section's widgets are now (stored with the drag), then hold them there
    const flow = flowOf(sec, phone);
    const rows = Number(sec.style.getPropertyValue('--frows')) || 0;
    S.doc.documentElement.setAttribute('data-flow-hold', h ? 'resize' : 'move');
    const from = flow[id];
    // the section's widgets and links, to move the widgets that follow this one along
    const items = widgetsIn(sec)
      .filter((n) => flow[idOf(n)])
      .map((n) => ({
        id: idOf(n),
        el: n,
        ...flow[idOf(n)],
        link: n === el ? null : linkOfEl(n),
      }));
    S.drag = {
      id,
      el,
      sec,
      h,
      from,
      pos: from,
      x: e.clientX,
      y: e.clientY,
      // the preview's scroll at the start: a drag that scrolls it (autoScroll) counts it in
      sy: S.win.scrollY,
      // and how far it scrolls then: no further (the section grows as a widget goes down)
      maxY: Math.max(0, S.doc.documentElement.scrollHeight - S.win.innerHeight),
      last: null,
      raf: 0,
      phone,
      saved,
      cols: phone ? MCOLS : COLS,
      lines: linesOf(sec, S.win),
      flow,
      items,
      link: linkOfEl(el),
      gap: null,
      rows: rows || Number(sec.style.getPropertyValue(phone ? '--mrows' : '--rows')) || 1,
      // a Custom section keeps its rows (never fewer: its widgets move inside them)
      min: minOf(sec, phone),
    };
    S.els.sel.classList.add('is-dragging');
    if (!h) S.els.sel.classList.add('is-moving');
    S.win.addEventListener('pointermove', move, true);
    S.win.addEventListener('pointerup', end, true);
    S.win.addEventListener('keydown', cancel, true);
  }

  /**
   * A drag held near the preview's top or bottom edge scrolls it, faster the closer, one row
   * a frame at most (phone rows are shorter: a 16px cap ran at about 61 rows, about 17 on
   * desktop: G15), and the widget goes along: a long move or resize reaches past what shows (G6).
   */
  const EDGE = 48;
  function autoScroll() {
    if (!S.drag || S.drag.raf || !S.drag.last) return;
    const speed = () => {
      const y = S.drag?.last?.clientY ?? EDGE;
      const top = EDGE - y;
      const bottom = y - (S.win.innerHeight - EDGE);
      const v = top > 0 ? -top : bottom > 0 ? bottom : 0;
      const row = (S.drag.lines?.row || 0) + (S.drag.lines?.rowGap || 0) || 16;
      const cap = Math.max(1, Math.round(row));
      return Math.round(Math.max(-cap, Math.min(cap, v / 3)));
    };
    const step = () => {
      if (!S.drag) return;
      S.drag.raf = 0;
      const v = speed();
      if (!v) return;
      const before = S.win.scrollY;
      const to = Math.max(0, Math.min(S.drag.maxY, before + v));
      if (to === before) return; // at the top or the page's end (as the drag started)
      S.win.scrollTo(S.win.scrollX, to);
      move(S.drag.last);
      S.drag.raf = S.win.requestAnimationFrame(step);
    };
    S.drag.raf = S.win.requestAnimationFrame(step);
  }

  function move(e) {
    const { lines, from, h } = S.drag;
    const { cols, rows, row, rowGap } = lines;
    S.drag.last = { clientX: e.clientX, clientY: e.clientY };
    autoScroll();
    const dx = e.clientX - S.drag.x;
    const dy = e.clientY - S.drag.y + (S.win.scrollY - S.drag.sy);
    const step = row + rowGap;
    const colStart = cols.starts[from.col - 1];
    const colEnd = cols.ends[from.col + from.span - 2];
    const rowStart =
      rows.starts[from.row - 1] ?? rows.ends.at(-1) + (from.row - rows.starts.length) * step;
    const rowEnd =
      rows.ends[from.row + from.rows - 2] ??
      rows.ends.at(-1) + (from.row + from.rows - 1 - rows.ends.length) * step;
    let { col, span, row: r, rows: n } = from;
    // an Auto / Aspect widget's height follows its content / width; its top or bottom edge
    // dragged (desktop) makes it a Rows widget of the rows dragged to (onplace's size)
    const free = sizeOf(widgetOf(S.drag.id)) !== 'rows' && S.drag.phone;
    if (!h) {
      col = Math.min(Math.max(1, nearest(cols.starts, colStart + dx)), S.drag.cols - span + 1);
      r = Math.max(1, nearest(rows.starts, rowStart + dy, step));
    }
    if (h.includes('e')) span = Math.max(1, nearest(cols.ends, colEnd + dx) - col + 1);
    if (h.includes('w')) {
      const end = from.col + from.span - 1;
      col = Math.min(nearest(cols.starts, colStart + dx), end);
      span = end - col + 1;
    }
    if (h.includes('s') && !free) n = Math.max(1, nearest(rows.ends, rowEnd + dy, step) - r + 1);
    if (h.includes('n') && !free) {
      const end = from.row + from.rows - 1;
      r = Math.min(Math.max(1, nearest(rows.starts, rowStart + dy, step)), end);
      n = end - r + 1;
    }
    span = Math.min(span, S.drag.cols - col + 1);
    // an Aspect widget's corner (desktop): its ratio kept, its rows follow its width, so its
    // size readout and the rows stored are the ones it shows (G7); its top or bottom edge
    // alone still makes it a Rows widget
    const ratio = aspectCorner(S.drag) && ratioOf(widgetOf(S.drag.id)?.aspect);
    if (ratio) {
      const width = cols.ends[col + span - 2] - cols.starts[col - 1];
      n = aspectRows(width, ratio, step);
      if (h.includes('n')) r = Math.max(1, from.row + from.rows - n);
    }
    S.drag.pos = { col, span, row: r, rows: n };
    show(S.drag.pos);
  }

  /** A desktop drag of an Aspect widget's corner (its ratio kept: move, end). */
  function aspectCorner(d) {
    return !d.phone && /[ns]/.test(d.h) && /[ew]/.test(d.h) && sizeOf(widgetOf(d.id)) === 'aspect';
  }

  /** An area as a widget's CSS variables (desktop, or the phone's; and where it is now). */
  function setArea(s, p, phone) {
    s.setProperty(phone ? '--mc' : '--c', p.col);
    s.setProperty(phone ? '--ms' : '--s', p.span);
    s.setProperty(phone ? '--mr' : '--r', p.row);
    s.setProperty(phone ? '--mrs' : '--rs', p.rows);
    s.setProperty('--fr', p.row);
    s.setProperty('--frs', p.rows);
  }

  /**
   * Show `pos` on the widget without storing it: the widgets that follow it move along, the
   * section's rows grow to hold them, and a linked widget's link line shows its gap (live).
   */
  function show(p) {
    setArea(S.drag.el.style, p, S.drag.phone);
    const items = S.drag.items.map((it) => (it.id === S.drag.id ? { ...it, ...p } : it));
    const { rows, at } = resolveRows(items, 1);
    for (const it of S.drag.items)
      if (it.id !== S.drag.id && at[it.id]) it.el.style.setProperty('--fr', at[it.id].row);
    // its content's rows (a Custom section grows to them on release: onplace's rows)
    S.drag.content = Math.max(rows, p.row + p.rows - 1);
    S.drag.sec.style.setProperty('--frows', Math.max(S.drag.min, S.drag.rows, S.drag.content));
    if (S.drag.link) {
      const lead = at[S.drag.link.to];
      if (lead) S.drag.gap = p.row - (lead.row + lead.rows);
    }
  }

  function stop() {
    if (S.drag?.raf) S.win.cancelAnimationFrame(S.drag.raf);
    noSelect(false);
    S.doc.documentElement.removeAttribute('data-flow-hold');
    S.win.removeEventListener('pointermove', move, true);
    S.win.removeEventListener('pointerup', end, true);
    S.win.removeEventListener('keydown', cancel, true);
    S.els.sel.classList.remove('is-dragging', 'is-moving');
  }

  /** The section and its widgets as they were before the drag. */
  function restore() {
    for (const [n, css] of S.drag.saved) n.style.cssText = css;
  }

  function end() {
    const { id, from, pos, phone, flow } = S.drag;
    const rows = S.drag.content || 0;
    // an Auto widget's top or bottom edge moved by a row (a stray drag) changes nothing: its
    // height is Auto until dragged at least STRAY_ROWS (F58)
    const auto = !phone && sizeOf(widgetOf(id)) !== 'rows';
    const stray =
      auto &&
      /[ns]/.test(S.drag.h) &&
      Math.abs(pos.rows - from.rows) < STRAY_ROWS &&
      ['col', 'span'].every((k) => pos[k] === from[k]);
    const moved = !stray && ['col', 'span', 'row', 'rows'].some((k) => pos[k] !== from[k]);
    if (!moved) restore(); // a click changes nothing
    const tall = /[ns]/.test(S.drag.h) && pos.rows !== from.rows && !aspectCorner(S.drag);
    const size = !phone && tall && sizeOf(widgetOf(id)) !== 'rows' ? 'rows' : undefined;
    const click = S.drag.click;
    stop();
    S.drag = null;
    if (moved) onplace(id, pos, { phone, flow, rows, size });
    else if (click) (setAnchor(click), onpick(click));
  }

  function cancel(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    restore();
    stop();
    S.drag = null;
  }

  // ---- links: a drag from a widget's top circle to another widget's bottom circle

  /** Start dragging widget `el`'s top circle: the widgets it may follow show bottom circles. */
  function startLink(e, el) {
    e.preventDefault();
    e.stopPropagation();
    selectLink(null);
    const id = idOf(el);
    const sec = secOf(el);
    const phone = isPhone();
    const widgets = widgetsIn(sec)
      .map((n) => widgetOf(idOf(n)))
      .filter(Boolean);
    const targets = showTargets(el, sec, phone, widgets);
    S.linking = {
      el,
      id,
      sec,
      phone,
      targets,
      near: null,
      from: topDot(boxOf(el, S.win)),
      to: null,
    };
    noSelect(true);
    S.win.addEventListener('pointermove', moveLink, true);
    S.win.addEventListener('pointerup', endLink, true);
    S.win.addEventListener('keydown', cancelLink, true);
    kick();
  }

  /**
   * The widgets `el` may follow (in its section, no loop): each an empty circle under its bottom
   * edge and a dim 1px frame (on this layer; the page doesn't change). Shown while its top circle
   * is hovered or dragged.
   */
  function showTargets(el, sec = secOf(el), phone = isPhone(), widgets = null) {
    const id = idOf(el);
    widgets ??= widgetsIn(sec)
      .map((n) => widgetOf(idOf(n)))
      .filter(Boolean);
    const targets = widgetsIn(sec)
      .filter((n) => n !== el && !n.hidden && !makesLoop(widgets, id, idOf(n), phone))
      .map((n) => {
        const r = boxOf(n, S.win);
        const [x, y] = bottomDot(r);
        const frame = S.doc.createElement('div');
        frame.className = 'tframe';
        place(frame, r);
        const dot = S.doc.createElement('i');
        dot.className = 'target';
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
        return { id: idOf(n), x, y, dot, frame };
      });
    S.els.targets.replaceChildren(...targets.flatMap((t) => [t.frame, t.dot]));
    return targets;
  }

  function moveLink(e) {
    const p = [e.clientX + S.win.scrollX, e.clientY + S.win.scrollY];
    let near = null;
    let best = REACH;
    for (const t of S.linking.targets) {
      const d = Math.hypot(t.x - p[0], t.y - p[1]);
      if (d <= best) {
        best = d;
        near = t;
      }
    }
    for (const t of S.linking.targets) {
      t.dot.classList.toggle('is-near', t === near);
      t.frame.classList.toggle('is-near', t === near);
    }
    S.linking.near = near;
    S.linking.to = near ? [near.x, near.y] : p;
  }

  // no page text selected while a circle is dragged: user-select off on the page, a selection
  // already there cleared (not a text being edited: its caret stays), selectstart stopped
  const stopSelect = (e) => e.preventDefault();
  let savedSelect = null;
  function noSelect(on) {
    const st = S.doc.documentElement.style;
    if (on) {
      savedSelect ??= [st.userSelect, st.webkitUserSelect];
      st.userSelect = st.webkitUserSelect = 'none';
      if (!S.doc.activeElement?.isContentEditable) S.win.getSelection()?.removeAllRanges();
      S.doc.addEventListener('selectstart', stopSelect, true);
    } else if (savedSelect) {
      [st.userSelect, st.webkitUserSelect] = savedSelect;
      savedSelect = null;
      S.doc.removeEventListener('selectstart', stopSelect, true);
    }
  }

  function stopLink() {
    noSelect(false);
    S.win.removeEventListener('pointermove', moveLink, true);
    S.win.removeEventListener('pointerup', endLink, true);
    S.win.removeEventListener('keydown', cancelLink, true);
    S.els.targets.replaceChildren();
    S.linking = null;
  }

  function endLink() {
    const { el, id, sec, phone, near } = S.linking;
    const was = linkOfEl(el);
    stopLink();
    if (near) {
      // it stays where it is: the gap is the rows between them now (negative: it overlaps its
      // leader); it is dragged where it should go from there
      const flow = flowOf(sec, phone);
      const a = flow[near.id];
      const b = flow[id];
      if (a && b && (was?.to !== near.id || was.gap !== b.row - (a.row + a.rows)))
        onlink(id, near.id, b.row - (a.row + a.rows), { phone });
    } else if (was) onlink(id, null, 0, { phone, row: shownRow(el) }); // dropped off: free
  }

  // the row a widget shows now (rows.js: --fr): an unlinked widget stays there
  const shownRow = (el) => parseInt(el.style.getPropertyValue('--fr'), 10) || undefined;

  function cancelLink(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    stopLink();
  }

  /** Delete or Backspace with a link selected: that link removed. */
  function deleteLink() {
    const id = ui.link;
    if (!id) return false;
    selectLink(null);
    const el = widgetEl(id);
    if (el && linkOfEl(el)) onlink(id, null, 0, { phone: isPhone(), row: shownRow(el) });
    return true;
  }
  // Arrange: clicks pick and drag widgets; the page's own clicks (links, buttons) are off. A
  // text being edited in place (contenteditable, preview-edit.js) keeps its clicks (the caret).
  const editing = (t) => !!t.closest?.('[contenteditable]');
  /**
   * The selected widget when the pointer is inside its box (widgets overlap: the selected one
   * is dragged, not the topmost under it); null otherwise, with Ctrl/Cmd, or with several selected.
   */
  function selectedUnder(e, mod) {
    if (mod || !ui.widget || ui.multi.length > 1) return null;
    const el = widgetEl(ui.widget);
    if (!el?.isConnected || el.hidden) return null;
    const r = el.getBoundingClientRect();
    const inside =
      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    return inside ? el : null;
  }
  function onpointerdown(e) {
    if (e.target.id === '__ed-layout') return; // the overlay's own (its shadow root handles it)
    if (!arranging() || e.button !== 0 || e.altKey || editing(e.target)) return;
    selectLink(null);
    const mod = e.ctrlKey || e.metaKey;
    const ids = selectedIds(ui);
    // (a template open: its item's own widgets, dragged as a page's: the Grid Engine)
    const hit = hitOf(e);
    const top = widgetAt(hit);
    const el = selectedUnder(e, mod) || top;
    if (!el) {
      // a section's empty grid: a selection box (Ctrl/Cmd: adds; another section's: refused)
      const sec = secOf(hit);
      if (sec && live(sec) && widgetsIn(sec).length) {
        if (mod && ids.length && secIdOf(ids[0]) !== secKey(sec))
          return void (e.preventDefault(), e.stopPropagation());
        return startBox(e, sec, mod ? ids : []);
      }
      // a section without widgets: it is selected; outside any: nothing selected
      if (sec && live(sec) && !tplOpen()) return void onsectionpick(sec.dataset.sec);
      return void ((ui.widget || ui.section || ui.selSection || ui.multi.length) && onpick(null));
    }
    const id = idOf(el);
    if (mod) {
      // Ctrl/Cmd+click: in or out of the selection, only within its section
      e.preventDefault();
      e.stopPropagation();
      const next = toggle(ids, id, secIdOf);
      if (!next) return;
      if (S.doc.activeElement?.isContentEditable) S.doc.activeElement.blur();
      setAnchor(id);
      onselect(next);
      return;
    }
    if (S.doc.activeElement?.isContentEditable) S.doc.activeElement.blur(); // ends an edit
    // one of several selected: they all move
    if (ui.multi.length > 1 && ui.multi.includes(id)) return startGroup(e, ui.multi, el);
    setAnchor(id);
    onpick(id);
    start(e, el);
    // inside the selected widget, over another one: a click (no drag) selects that other one
    if (S.drag && top && top !== el) S.drag.click = idOf(top);
  }
  // a double click on a widget: its pop-up (a single click only selects it; a text's own edit
  // still starts, preview-edit.js)
  function ondblclick(e) {
    if (!arranging() || e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (editing(e.target)) return;
    const id = idOf(widgetAt(hitOf(e)));
    if (id) onopen?.(id);
  }
  const swallow = (e) => {
    if (!arranging() || e.altKey || editing(e.target)) return;
    if (hitOf(e).closest?.(tplOpen() ? '[data-tw]' : '[data-widget]')) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  // a clickable template item's widgets get no pointerover (hitOf): the pointer's move finds them
  function onpointermove(e) {
    if (tplOpen() && arranging() && e.target.id !== '__ed-layout' && widgetAt(hitOf(e)) !== S.hover)
      onpointerover(e);
  }
  function onpointerleave() {
    S.hover = null; // the pointer out of the preview: no widget outlined
    unpeek();
    hotAt(null);
  }
  function onpointerover(e) {
    if (e.target.id === '__ed-layout') return; // over its circles: the widget stays hovered
    const hit = hitOf(e);
    S.hover = arranging() ? widgetAt(hit) : null;
    hotAt(idOf(S.hover));
    S.hoverSec = arranging() ? secOf(hit) || null : null;
    if (e.target.id !== '__ed-layout') peekAt(arranging() ? secOf(e.target) : null);
  }

  return {
    /** The preview loaded a document. */
    attach(siteWin) {
      // a frame asked of the document before (a reload) never comes: the loop starts again
      S.raf = 0;
      S.due = false;
      S.win = siteWin;
      S.doc = siteWin.document;
      gridKey = '';
      build();
      // (its pointer handlers: preview-pointer.js listens and calls them, `pointer` below)
      // what moves the page: the loop runs for it, then idles
      S.anims = 0;
      const opts = { capture: true, passive: true };
      for (const t of [
        'pointermove',
        'pointerover',
        'pointerout',
        'keydown',
        'keyup',
        'wheel',
        'input',
      ])
        S.doc.addEventListener(t, kick, opts);
      S.win.addEventListener('scroll', kick, opts);
      S.win.addEventListener('resize', kick, opts);
      // an endless one (a pulse) is followed by neither: the loop would never idle
      const endless = (e) =>
        e.type.startsWith('animation') &&
        /infinite/.test(S.win.getComputedStyle(e.target).animationIterationCount);
      for (const t of ['transitionrun', 'animationstart'])
        S.doc.addEventListener(t, (e) => (endless(e) || S.anims++, kick()), opts);
      for (const t of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel'])
        S.doc.addEventListener(
          t,
          (e) => (endless(e) || (S.anims = Math.max(0, S.anims - 1)), kick()),
          opts,
        );
      new S.win.MutationObserver(kick).observe(S.doc.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      new S.win.ResizeObserver(kick).observe(S.doc.documentElement);
      this.refresh();
    },
    /** Widget `id` scrolled to (centred) only when it is out of the preview's view. */
    reveal(id) {
      reveal(S.doc && widgetEl(id), { when: 'part' });
    },
    /** previewClicks(), ui.widget or ui.link changed: show or hide what they ask for. */
    refresh() {
      if (!S.doc || !S.root) return;
      gridKey = '';
      if (!shown()) S.els.grids.replaceChildren();
      kick();
    },
    /** Delete with a link selected (keys.js). */
    deleteLink,
    /** The loop run for a moment (the editor's panel changed what shows: main.js). */
    kick,
    /** The next frame drawn (the preview's boxes asked for it: preview-runtime.js). */
    wake,
    /** Frames drawn so far (the loop idles: tests). */
    get frames() {
      return S.frames;
    },
    /** Arrow keys: the selection moved by (dc, dr) cells. */
    nudge,
    /**
     * The preview's pointer (preview-pointer.js calls them, after the editing's): a press picks
     * or drags, a double click opens the pop-up, the page's own press and click on a widget are
     * swallowed, the widget under the pointer is outlined.
     */
    pointer: {
      down: onpointerdown,
      dblclick: ondblclick,
      swallow,
      over: onpointerover,
      move: onpointermove,
      leave: onpointerleave,
    },
  };
}
