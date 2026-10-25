/**
 * The layout overlay, drawn in the preview over the page (in its own Shadow DOM, so neither
 * the site's styles nor the editor's reach it):
 *
 *   Grid      the square cells (120 columns, the phone grid's 60, and its rows, all one
 *             --cell: src/site/layout/flow.js) of the selected widget's section only, while a
 *             widget is selected (and so while it is dragged or resized) or an empty
 *             section's view is open (ui.section), from the section's own computed grid: faint white lines, every 5th a little stronger. Nothing
 *             selected: no grid
 *   Arrange   always on in the Content tab: a click picks a widget (the widget inspector opens),
 *             a click on empty space (no widget, handle, circle or link line) or Esc (main /
 *             App.svelte) drops the selection (the panel shows the sections again),
 *             a drag moves it and the handles on its edges and corners resize it; a double
 *             click edits a text in place (bridge.js), the page's own clicks are off. A drag
 *             snaps to the cells and shows its area live (the widget's CSS variables, and the
 *             widgets that follow it move along); on release it is one edit, one undo step
 *             (onplace), which also stores where the section's other widgets are now (their
 *             real rows). A linked widget dragged up or down keeps its link: its gap changes.
 *             Esc cancels. Below 760px (the mobile preview) a drag edits the widget's phone
 *             area, on the phone grid of 60 columns (a widget without one shows its desktop
 *             area halved: that is where the drag starts). An aspect or auto widget's rows
 *             follow its width: only its sides resize.
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
 *             phone rows (mobile.rows.min; without them: half the desktop rows, rounded up).
 *             A widget dragged or resized past a Custom section's bottom: on release its rows
 *             become the content's (onplace's rows), so moving it back up leaves empty rows.
 *
 * A widget is where the site's rows.js put it (--fr / --frs: a linked widget below its leader,
 * auto and aspect widgets the rows they need), so a drag starts from there; while it runs the
 * page holds its rows (data-flow-hold on <html>).
 *
 * The overlay follows the page with a frame loop while it shows something; it reads `ui`
 * (mode, widget, link) every frame, and the section metrics once per drag, so the grid
 * doesn't move under the pointer while the page reflows.
 */
import { COLS, MAX_MIN_ROWS, MCOLS, makesLoop, sizeOf } from '../site/layout/index.js';
import { resolveRows } from '../site/layout/flow.js';
import {
  flowAreas,
  linesOf,
  linkOfEl as linkAttr,
  nearest,
  boxOf,
  rectOf,
  tracksOf,
} from '../site/layout/geometry.js';
import { PHONE_MAX } from '../site/layout/grid.js';
import { clampDelta, hits, offscreen, selectedIds, toggle } from './multi-select.js';
import { T } from './ui-tokens.js';
import { shownPlace, tagHtml } from './widget-tag.js';

const MOBILE = PHONE_MAX;
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
.label { position: absolute; right: 0; bottom: 100%; margin-bottom: 8px; padding: 4px 8px; border-radius: ${T.radiusSm}; background: ${T.accent}; color: ${T.black}; font: 500 12px/1 ${T.font}; white-space: nowrap; }
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
.sel.is-free.is-phone .handle:not([data-h='e']):not([data-h='w']) { display: none; }
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
 * onpick(id): a widget was clicked; onplace(id, pos, { mobile, flow, rows }): a drag ended with
 * the widget at `pos` (mobile: its phone area; flow: where the section's widgets are now, { id:
 * area }, and rows: the rows its content needs now); onlink(id, to, gap, { mobile }): widget `id` follows `to`
 * with `gap` cells between them (to null: it is free again); widgetOf(id): the stored widget
 * (null when it isn't on the page); secNameOf(id): a section's name for its tag ("Section N"
 * without one); onrows(secId, rows, { mobile }): a Custom section's bottom
 * edge was dragged to `rows` (the phone's rows when mobile); onsectionpick(secId): a click on a
 * section's empty space (it alone selected).
 */
export function createOverlay({
  ui,
  onpick,
  onopen,
  onplace,
  onlink = () => {},
  onrows = () => {},
  onselect = () => {},
  onsectionpick = () => {},
  ongroupmove = () => {},
  widgetOf,
  secNameOf = () => '',
}) {
  let doc = null;
  let win = null;
  let root = null; // the shadow root's layer
  let raf = 0;
  // the loop idles: kick() runs it for IDLE ms more (the page, the pointer or a key changed)
  const IDLE = 500;
  let idleUntil = 0;
  let anims = 0; // the preview's running transitions and animations
  let frames = 0; // frames drawn (the tests count them)
  const now = () => performance.now();
  function kick() {
    idleUntil = now() + IDLE;
    if (!raf && win && root) raf = win.requestAnimationFrame(frame);
  }
  let drag = null;
  let linking = null;
  let hover = null;
  let tagShown = ''; // the tag's HTML now (set only when it changes)
  let hoverSec = null;
  let sizing = null; // a section's bottom edge being dragged
  let gridKey = '';
  let group = null; // several selected widgets being dragged together
  let boxing = null; // a selection box being drawn on a section's empty grid
  const els = {};

  const arranging = () => ui.mode === 'text';
  const shown = () => doc && arranging();
  const mobile = () => win.innerWidth <= MOBILE;
  const widgetEl = (id) => (id ? doc.querySelector(`[data-widget="${CSS.escape(id)}"]`) : null);
  const secOf = (el) => el?.closest('[data-sec]');
  /** Is a section editable now: the footer's while it is open, the page's while no site part is. */
  const live = (sec) =>
    !doc.querySelector('[data-header][data-ed-open]') &&
    !!sec.closest('[data-footer]') === !!doc.querySelector('[data-footer][data-ed-open]');
  const secById = (id) => doc.querySelector(`[data-sec="${CSS.escape(id)}"]:not([hidden])`);
  /** The section under the pointer in the preview: its row in the Content tab shows it. */
  const peekAt = (sec) => {
    const id = sec?.dataset.sec;
    if (id) {
      if (ui.peek?.id !== id || ui.peek.from !== 'preview') ui.peek = { id, from: 'preview' };
    } else if (ui.peek?.from === 'preview') ui.peek = null;
  };
  const unpeek = () => peekAt(null);
  /** The widget under the pointer in the preview: its row in the Content tab lights. */
  const hotAt = (id) => {
    if (id) {
      if (ui.hot?.id !== id || ui.hot.from !== 'preview') ui.hot = { id, from: 'preview' };
    } else if (ui.hot?.from === 'preview') ui.hot = null;
  };
  /** The widget elements of a section (not a nested section's). */
  const widgetsIn = (sec) =>
    [...sec.querySelectorAll('[data-widget]')].filter((n) => secOf(n) === sec);
  /** The link a widget element follows on the grid shown: { to, gap } or null. */
  const linkOfEl = (el) => linkAttr(el, mobile());

  function build() {
    const host = doc.createElement('div');
    host.id = '__ed-layout';
    host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483645;';
    const shadow = host.attachShadow({ mode: 'open' });
    const dots = '<i class="dot" data-dot="top"></i><i class="dot" data-dot="bottom"></i>';
    linkEls.clear();
    svgSize = '';
    tempPath = null;
    shadow.innerHTML = `<style>${STYLE}</style><div class="layer"><div class="grids"></div><svg class="links" xmlns="${SVG}"></svg><div class="box peek" hidden><span class="tag"></span></div><div class="secrow" hidden><span class="count"></span></div><div class="box hover" hidden></div><div class="box sel" hidden><span class="label"></span><i class="edge" data-h="w"></i><i class="edge" data-h="e"></i>${HANDLES.map((h) => `<i class="handle" data-h="${h}"></i>`).join('')}${dots}</div><div class="targets"></div><div class="multi"></div><div class="marquee" hidden></div><div class="blocks"></div></div>`;
    root = shadow.querySelector('.layer');
    els.grids = root.querySelector('.grids');
    els.links = root.querySelector('.links');
    els.hover = root.querySelector('.hover');
    els.peek = root.querySelector('.peek');
    els.tag = root.querySelector('.tag');
    els.sel = root.querySelector('.sel');
    els.label = root.querySelector('.label');
    els.targets = root.querySelector('.targets');
    els.secrow = root.querySelector('.secrow');
    els.count = root.querySelector('.count');
    els.multi = root.querySelector('.multi');
    els.marquee = root.querySelector('.marquee');
    els.blocks = root.querySelector('.blocks');
    shadow.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      // another section while Ctrl/Cmd is held with a selection: not clickable
      if (e.target.closest?.('.block')) return void (e.preventDefault(), e.stopPropagation());
      if (e.target.closest?.('.secrow')) return startRows(e);
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
        ui.link = link;
        kick();
      }
    });
    // the filled top circle hovered: the widgets it may link to show (their empty circles, a dim frame)
    shadow.addEventListener('pointerover', (e) => {
      if (e.target.dataset?.dot !== 'top' || linking) return;
      const el = widgetEl(ui.widget);
      if (el) showTargets(el);
    });
    shadow.addEventListener('pointerout', (e) => {
      if (e.target.dataset?.dot === 'top' && !linking) els.targets.replaceChildren();
    });
    doc.body.appendChild(host);
    return host;
  }

  const place = (box, r) => {
    box.style.left = `${r.x}px`;
    box.style.top = `${r.y}px`;
    box.style.width = `${r.w}px`;
    box.style.height = `${r.h}px`;
  };

  /**
   * The grid of the selected (or dragged) widget's section, none without one: rebuilt when that
   * section, its size or its tracks change.
   */
  function drawGrids() {
    const sec = arranging()
      ? drag?.sec ||
        group?.sec ||
        boxing?.sec ||
        secOf(widgetEl(selectedIds(ui)[0])) ||
        (ui.section && secById(ui.section))
      : null;
    const secs = sec && !sec.hidden ? [sec] : [];
    const info = secs.map((sec) => {
      const cs = win.getComputedStyle(sec);
      return { sec, cs, r: rectOf(sec, win) };
    });
    const key = info
      .map(({ sec, cs, r }) =>
        [sec.dataset.sec, r.x, r.y, r.w, r.h, cs.gridTemplateColumns, cs.gridTemplateRows].join(),
      )
      .join('|');
    if (`${secs.length}:${key}` === gridKey) return;
    gridKey = `${secs.length}:${key}`;
    els.grids.replaceChildren(
      ...info.map(({ cs, r }) => {
        const g = doc.createElement('div');
        g.className = 'grid';
        place(g, r);
        // the cells: the tracks as they are laid out (centred in the content box: the few px
        // a whole number of cells leaves over), a line every cell and a stronger one every 5th
        const t = tracksOf(cs, r);
        const cell = t.cols[0] || 8;
        const c = doc.createElement('div');
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
    const n = doc.createElementNS(SVG, tag);
    n.setAttribute('class', cls);
    return n;
  };
  /** The tag's rect on the page (the gap labels keep clear of it), or null. */
  function tagRect() {
    if (els.sel.hidden) return null;
    const r = els.label.getBoundingClientRect();
    return r.width
      ? { x: r.left + win.scrollX, y: r.top + win.scrollY, w: r.width, h: r.height }
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
    const h = doc.documentElement;
    const size = `${h.scrollWidth}x${h.scrollHeight}`;
    if (size !== svgSize) {
      svgSize = size;
      els.links.setAttribute('width', h.scrollWidth);
      els.links.setAttribute('height', h.scrollHeight);
    }
    const seen = new Set();
    const tag = tagRect();
    if (arranging())
      for (const sec of doc.querySelectorAll('[data-sec]:not([hidden])'))
        for (const el of live(sec) ? widgetsIn(sec) : []) {
          const l = linkOfEl(el);
          if (!l || el.hidden || linking?.el === el) continue;
          const lead = widgetsIn(sec).find((n) => n.dataset.widget === l.to);
          if (!lead || lead.hidden) continue;
          const [x1, y1] = bottomDot(boxOf(lead, win)).map(R);
          const [x2, y2] = topDot(boxOf(el, win)).map(R);
          const id = el.dataset.widget;
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
            els.links.append(e.line, e.hit, e.gap);
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
    if (linking?.to) {
      tempPath ??= els.links.appendChild(svgEl('path', 'link is-temp'));
      attr(tempPath, 'd', curve(...linking.to.map(R), ...linking.from.map(R)));
    } else if (tempPath) {
      tempPath.remove();
      tempPath = null;
    }
  }

  // the selected widget's tag: its type only (its gap shows on its link line, live)

  // a link's gap as shown: the dragged widget's live one (show()), else the stored one
  const gapOf = (id, l) => (drag?.id === id && drag.gap != null ? drag.gap : l.gap);

  /**
   * The section card hovered in the Content tab, else the one selected (`sec`, null: none): a soft white 1px line on
   * its section and its name in a tag above its top edge, left (just inside it when there is
   * no room above, e.g. the first section). Only it is outlined: nothing else is dimmed (a row
   * hovered highlights, it doesn't fade the page). All on this layer: the page's own styles don't change (no reflow).
   */
  function drawPeek(sec) {
    els.peek.hidden = !sec;
    if (!sec) return;
    const r = rectOf(sec, win);
    place(els.peek, r);
    els.peek.classList.toggle('is-inside', r.y - win.scrollY < TAG_ROOM);
    const name = secNameOf(sec.dataset.sec);
    els.tag.hidden = !name;
    if (els.tag.textContent !== name) els.tag.textContent = name;
  }

  function frame() {
    raf = 0;
    if (!root?.isConnected) return;
    drawGrids();
    drawLinks();
    // the widget's section card hovered (ui.peek from the panel): only its section shows
    // (not over a widget row: its widget shows, selected or outlined)
    const peeking = !!ui.widget && ui.peek?.from === 'panel' && ui.hot?.from !== 'panel';
    root.classList.toggle('is-peeking', peeking);
    const arrange = arranging() && !peeking;
    root.classList.toggle('is-linking', !!linking);
    const sel = arrange ? widgetEl(ui.widget) : null;
    els.sel.hidden = !sel;
    if (sel) {
      place(els.sel, boxOf(sel, win));
      const b = widgetOf(ui.widget);
      els.sel.classList.toggle('is-free', sizeOf(b) !== 'rows');
      els.sel.classList.toggle('is-phone', mobile());
      // its size and place, the snapped ones while dragged or resized (widget-tag.js)
      const dragging = drag?.id === ui.widget && drag.pos;
      const label = tagHtml(
        dragging ? drag.pos : shownPlace(sel, win),
        dragging ? drag.from : null,
      );
      if (label !== tagShown) els.label.innerHTML = tagShown = label;
    }
    // the section card hovered in the Content tab, else the one selected while the list shows:
    // its section (under the widget boxes)
    // (a widget row hovered: only its widget is outlined, not its section too)
    const peekId =
      ui.hot?.from === 'panel'
        ? null
        : ui.peek?.from === 'panel'
          ? ui.peek.id
          : !ui.widget && !ui.section && ui.selSection;
    const p = (arrange || peeking) && !drag && peekId ? secById(peekId) : null;
    drawPeek(p);
    // a Custom section's bottom edge: the one being dragged, hovered, or the selected widget's
    const rs =
      arrange && !drag && !linking
        ? sizing?.sec || customOf(hoverSec) || customOf(secOf(sel))
        : null;
    els.secrow.hidden = !rs;
    if (rs) {
      const r = rectOf(rs, win);
      place(els.secrow, { x: r.x, y: r.y + r.h, w: r.w, h: 12 });
      els.secrow.classList.toggle('is-dragging', !!sizing);
      if (sizing) els.count.textContent = `${sizing.phone ? 'phone · ' : ''}${sizing.rows} rows`;
    }
    drawMulti(arrange);
    drawBlocks(arrange);
    els.marquee.hidden = !boxing?.box;
    if (boxing?.box) place(els.marquee, boxing.box);
    // the pointer's widget, else the one whose row is hovered in the panel
    const hov = hover || (ui.hot?.from === 'panel' ? widgetEl(ui.hot.id) : null);
    const h =
      arrange &&
      hov !== sel &&
      !drag &&
      !group &&
      !boxing &&
      !ui.multi.includes(hov?.dataset.widget)
        ? hov
        : null;
    els.hover.hidden = !h;
    if (h) {
      place(els.hover, boxOf(h, win));
    }
    frames++;
    // again only while something moves: a drag, a resize, a box, a link drawn, a running
    // transition or animation, or for a moment after the page, the pointer or a key changed
    if (shown() && (drag || group || boxing || sizing || linking || anims > 0 || now() < idleUntil))
      raf = win.requestAnimationFrame(frame);
  }

  // ---- multi-select (multi-select.js): two or more widgets, one section, all alike

  /** Each selected widget's box: the same border, no handles or circles (the count: SectionToolbar). */
  function drawMulti(arrange) {
    const els2 = arrange ? ui.multi.map(widgetEl).filter((n) => n && !n.hidden) : [];
    const boxes = els.multi.children;
    while (boxes.length > els2.length) boxes[boxes.length - 1].remove();
    while (boxes.length < els2.length) els.multi.append(doc.createElement('div'));
    const rs = els2.map((n) => boxOf(n, win));
    rs.forEach((r, i) => {
      boxes[i].className = `box sel${group ? ' is-dragging' : ''}`;
      place(boxes[i], r);
    });
  }

  /**
   * Ctrl/Cmd held (ui.mod) with a selection: every other section is dimmed and not clickable
   * (a box over it that takes the click, the not-allowed cursor).
   */
  function drawBlocks(arrange) {
    const ids = selectedIds(ui);
    const sec = arrange && ui.mod && ids.length && !drag && !group ? secOf(widgetEl(ids[0])) : null;
    const others = sec
      ? [...doc.querySelectorAll('[data-sec]:not([hidden])')].filter(
          (s) => s !== sec && live(s) && !s.parentElement.closest('[data-sec]') && !s.contains(sec),
        )
      : [];
    const blocks = els.blocks.children;
    while (blocks.length > others.length) blocks[blocks.length - 1].remove();
    while (blocks.length < others.length) els.blocks.append(doc.createElement('div'));
    others.forEach((s, i) => {
      blocks[i].className = 'block';
      place(blocks[i], rectOf(s, win));
    });
  }

  const secIdOf = (id) => secOf(widgetEl(id))?.dataset.sec;

  /** The step of one cell (px) on a section's lines: columns, rows. */
  const stepsOf = (lines) => ({
    col: lines.cols.starts[1] - lines.cols.starts[0] || lines.row + lines.rowGap,
    row: lines.row + lines.rowGap,
  });

  /** What a group move starts from: the section, its flow, the members' areas. */
  function groupOf(ids) {
    const sec = secOf(widgetEl(ids[0]));
    if (!sec) return null;
    const phone = mobile();
    const flow = flowAreas(sec, phone, widgetOf);
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
    doc.documentElement.setAttribute('data-flow-hold', '');
    group = {
      ...g,
      el,
      saved: new Map([sec, ...widgetsIn(sec)].map((n) => [n, n.style.cssText])),
      x: e.clientX,
      y: e.clientY,
      lines: linesOf(sec, win),
      items: widgetsIn(sec)
        .filter((n) => flow[n.dataset.widget])
        .map((n) => ({
          id: n.dataset.widget,
          el: n,
          ...flow[n.dataset.widget],
          link: ids.includes(n.dataset.widget) ? null : linkOfEl(n),
        })),
      dc: 0,
      dr: 0,
      rows: rows || Number(sec.style.getPropertyValue(phone ? '--mrows' : '--rows')) || 1,
      min: minOf(sec, phone),
    };
    noSelect(true);
    win.addEventListener('pointermove', moveGroup, true);
    win.addEventListener('pointerup', endGroup, true);
    win.addEventListener('keydown', cancelGroup, true);
  }

  function moveGroup(e) {
    const st = stepsOf(group.lines);
    const areas = Object.fromEntries(group.members.map((m) => [m.id, m.from]));
    const d = clampDelta(
      areas,
      Math.round((e.clientX - group.x) / st.col),
      Math.round((e.clientY - group.y) / st.row),
      group.cols,
    );
    if (d.dc === group.dc && d.dr === group.dr) return;
    group.dc = d.dc;
    group.dr = d.dr;
    showGroup();
  }

  /** The members at their area + the delta, the widgets that follow them along (live). */
  function showGroup() {
    const { dc, dr, phone } = group;
    const at = {};
    for (const m of group.members) {
      at[m.id] = { ...m.from, col: m.from.col + dc, row: m.from.row + dr };
      setArea(m.el.style, at[m.id], phone);
    }
    const items = group.items.map((it) => (at[it.id] ? { ...it, ...at[it.id] } : it));
    const res = resolveRows(items, 1);
    for (const it of group.items)
      if (!at[it.id] && res.at[it.id]) it.el.style.setProperty('--fr', res.at[it.id].row);
    group.content = Math.max(res.rows, ...Object.values(at).map((p) => p.row + p.rows - 1));
    group.sec.style.setProperty('--frows', Math.max(group.min, group.rows, group.content));
  }

  function stopGroup() {
    doc.documentElement.removeAttribute('data-flow-hold');
    noSelect(false);
    win.removeEventListener('pointermove', moveGroup, true);
    win.removeEventListener('pointerup', endGroup, true);
    win.removeEventListener('keydown', cancelGroup, true);
  }

  function endGroup() {
    const g = group;
    stopGroup();
    group = null;
    const moved = g.dc || g.dr;
    if (!moved) {
      for (const [n, css] of g.saved) n.style.cssText = css;
      // a click (no move) on one of them: that one only
      ui.anchor = g.el.dataset.widget;
      onpick(g.el.dataset.widget);
      return;
    }
    ongroupmove(
      g.members.map((m) => m.id),
      g.dc,
      g.dr,
      {
        mobile: g.phone,
        flow: g.flow,
        rows: g.content || 0,
      },
    );
  }

  function cancelGroup(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    for (const [n, css] of group.saved) n.style.cssText = css;
    stopGroup();
    group = null;
  }

  /** Arrow keys: the selection moved by whole cells (clamped as a drag), one undo step. */
  function nudge(dc, dr) {
    const ids = selectedIds(ui);
    if (!doc || !arranging() || !ids.length) return false;
    const g = groupOf(ids);
    if (!g) return false;
    const d = clampDelta(Object.fromEntries(g.members.map((m) => [m.id, m.from])), dc, dr, g.cols);
    if (d.dc || d.dr)
      ongroupmove(
        g.members.map((m) => m.id),
        d.dc,
        d.dr,
        { mobile: g.phone, flow: g.flow },
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
    if (doc.activeElement?.isContentEditable) doc.activeElement.blur();
    boxing = {
      sec,
      base,
      x: e.pageX,
      y: e.pageY,
      box: null,
      mod: base.length > 0 || e.ctrlKey || e.metaKey,
    };
    noSelect(true);
    win.addEventListener('pointermove', moveBox, true);
    win.addEventListener('pointerup', endBox, true);
    win.addEventListener('keydown', cancelBox, true);
    kick();
  }

  function moveBox(e) {
    const { sec, x, y } = boxing;
    if (!boxing.box && Math.hypot(e.pageX - x, e.pageY - y) < 4) return;
    // inside its section's grid
    const s = rectOf(sec, win);
    const cx = (v) => Math.min(Math.max(v, s.x), s.x + s.w);
    const cy = (v) => Math.min(Math.max(v, s.y), s.y + s.h);
    const x1 = cx(Math.min(x, e.pageX));
    const x2 = cx(Math.max(x, e.pageX));
    const y1 = cy(Math.min(y, e.pageY));
    const y2 = cy(Math.max(y, e.pageY));
    boxing.box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    const rects = Object.fromEntries(
      widgetsIn(sec)
        .filter((n) => !n.hidden && widgetOf(n.dataset.widget))
        .map((n) => [n.dataset.widget, boxOf(n, win)]),
    );
    const ids = [...new Set([...boxing.base, ...hits(rects, boxing.box)])];
    if (ids.join() !== selectedIds(ui).join()) onselect(ids);
  }

  function stopBox() {
    noSelect(false);
    win.removeEventListener('pointermove', moveBox, true);
    win.removeEventListener('pointerup', endBox, true);
    win.removeEventListener('keydown', cancelBox, true);
  }

  function endBox() {
    const b = boxing;
    stopBox();
    boxing = null;
    // a click on a section's empty space: that section selected, alone (Ctrl/Cmd: the
    // selection stays)
    if (!b.box && !b.mod) onsectionpick(b.sec.dataset.sec);
  }

  function cancelBox(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    const b = boxing;
    stopBox();
    boxing = null;
    onselect(b.base);
  }

  /** A drag of widget `el`: move (h empty) or a resize by handle `h`. */
  function start(e, el, h = '') {
    const id = el?.dataset.widget;
    const stored = widgetOf(id);
    if (!stored) return;
    e.preventDefault();
    e.stopPropagation();
    ui.link = null;
    const sec = secOf(el);
    const phone = mobile();
    const saved = new Map([sec, ...widgetsIn(sec)].map((n) => [n, n.style.cssText]));
    // where the section's widgets are now (stored with the drag), then hold them there
    const flow = flowAreas(sec, phone, widgetOf);
    const rows = Number(sec.style.getPropertyValue('--frows')) || 0;
    doc.documentElement.setAttribute('data-flow-hold', '');
    const from = flow[id];
    // the section's widgets and links, to move the widgets that follow this one along
    const items = widgetsIn(sec)
      .filter((n) => flow[n.dataset.widget])
      .map((n) => ({
        id: n.dataset.widget,
        el: n,
        ...flow[n.dataset.widget],
        link: n === el ? null : linkOfEl(n),
      }));
    drag = {
      id,
      el,
      sec,
      h,
      from,
      pos: from,
      x: e.clientX,
      y: e.clientY,
      phone,
      saved,
      cols: phone ? MCOLS : COLS,
      lines: linesOf(sec, win),
      flow,
      items,
      link: linkOfEl(el),
      gap: null,
      rows: rows || Number(sec.style.getPropertyValue(phone ? '--mrows' : '--rows')) || 1,
      // a Custom section keeps its rows (never fewer: its widgets move inside them)
      min: minOf(sec, phone),
    };
    els.sel.classList.add('is-dragging');
    win.addEventListener('pointermove', move, true);
    win.addEventListener('pointerup', end, true);
    win.addEventListener('keydown', cancel, true);
  }

  function move(e) {
    const { lines, from, h } = drag;
    const { cols, rows, row, rowGap } = lines;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
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
    const free = sizeOf(widgetOf(drag.id)) !== 'rows' && drag.phone;
    if (!h) {
      col = Math.min(Math.max(1, nearest(cols.starts, colStart + dx)), drag.cols - span + 1);
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
    drag.pos = { col, span: Math.min(span, drag.cols - col + 1), row: r, rows: n };
    show(drag.pos);
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
    setArea(drag.el.style, p, drag.phone);
    const items = drag.items.map((it) => (it.id === drag.id ? { ...it, ...p } : it));
    const { rows, at } = resolveRows(items, 1);
    for (const it of drag.items)
      if (it.id !== drag.id && at[it.id]) it.el.style.setProperty('--fr', at[it.id].row);
    // its content's rows (a Custom section grows to them on release: onplace's rows)
    drag.content = Math.max(rows, p.row + p.rows - 1);
    drag.sec.style.setProperty('--frows', Math.max(drag.min, drag.rows, drag.content));
    if (drag.link) {
      const lead = at[drag.link.to];
      if (lead) drag.gap = p.row - (lead.row + lead.rows);
    }
  }

  function stop() {
    doc.documentElement.removeAttribute('data-flow-hold');
    win.removeEventListener('pointermove', move, true);
    win.removeEventListener('pointerup', end, true);
    win.removeEventListener('keydown', cancel, true);
    els.sel.classList.remove('is-dragging');
  }

  /** The section and its widgets as they were before the drag. */
  function restore() {
    for (const [n, css] of drag.saved) n.style.cssText = css;
  }

  function end() {
    const { id, from, pos, phone, flow } = drag;
    const rows = drag.content || 0;
    const moved = ['col', 'span', 'row', 'rows'].some((k) => pos[k] !== from[k]);
    if (!moved) restore(); // a click changes nothing
    const tall = /[ns]/.test(drag.h) && pos.rows !== from.rows;
    const size = !phone && tall && sizeOf(widgetOf(id)) !== 'rows' ? 'rows' : undefined;
    const click = drag.click;
    stop();
    drag = null;
    if (moved) onplace(id, pos, { mobile: phone, flow, rows, size });
    else if (click) ((ui.anchor = click), onpick(click));
  }

  function cancel(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    restore();
    stop();
    drag = null;
  }

  // ---- a Custom section's rows: its bottom edge dragged

  /** A section's own rows (Custom height; the phone's on the phone), 0 for any other. */
  function minOf(sec, phone) {
    return parseInt(sec?.style.getPropertyValue(phone ? '--mminrows' : '--minrows'), 10) || 0;
  }
  // custom on the grid shown (the phone's height on the phone: its --mminrows)
  const customOf = (sec) => (sec && !sec.hidden && minOf(sec, mobile()) ? sec : null);

  function startRows(e) {
    const sec = customOf(hoverSec) || customOf(secOf(widgetEl(ui.widget)));
    if (!sec || drag || linking) return;
    e.preventDefault();
    e.stopPropagation();
    const phone = mobile();
    const flow = flowAreas(sec, phone, widgetOf);
    // the rows its content needs: down to its lowest widget, as rows.js placed them
    const content = Math.max(1, ...Object.values(flow).map((a) => a.row + a.rows - 1));
    const rows = Number(sec.style.getPropertyValue('--frows')) || minOf(sec, phone) || content;
    const lines = linesOf(sec, win);
    doc.documentElement.setAttribute('data-flow-hold', '');
    sizing = {
      sec,
      phone,
      content,
      from: rows,
      rows,
      y: e.clientY,
      step: lines.row + lines.rowGap,
      saved: [sec.style.cssText, phone ? '--mminrows' : '--minrows'],
      max: phone ? Math.ceil(MAX_MIN_ROWS / 2) : MAX_MIN_ROWS,
    };
    ui.secRows = { id: sec.dataset.sec, rows, phone };
    win.addEventListener('pointermove', moveRows, true);
    win.addEventListener('pointerup', endRows, true);
    win.addEventListener('keydown', cancelRows, true);
    kick();
  }

  function moveRows(e) {
    const s = sizing;
    const n = Math.min(s.max, Math.max(s.content, Math.round(s.from + (e.clientY - s.y) / s.step)));
    if (n === s.rows) return;
    s.rows = n;
    s.sec.style.setProperty('--frows', n);
    s.sec.style.setProperty(s.saved[1], n);
    ui.secRows = { id: s.sec.dataset.sec, rows: n, phone: s.phone };
  }

  function stopRows() {
    doc.documentElement.removeAttribute('data-flow-hold');
    win.removeEventListener('pointermove', moveRows, true);
    win.removeEventListener('pointerup', endRows, true);
    win.removeEventListener('keydown', cancelRows, true);
    sizing = null;
    ui.secRows = null;
  }

  function endRows() {
    const { sec, rows, from, phone } = sizing;
    if (rows === from) sec.style.cssText = sizing.saved[0];
    stopRows();
    if (rows !== from) onrows(sec.dataset.sec, rows, { mobile: phone });
  }

  function cancelRows(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    sizing.sec.style.cssText = sizing.saved[0];
    stopRows();
  }

  // ---- links: a drag from a widget's top circle to another widget's bottom circle

  /** Start dragging widget `el`'s top circle: the widgets it may follow show bottom circles. */
  function startLink(e, el) {
    e.preventDefault();
    e.stopPropagation();
    ui.link = null;
    const id = el.dataset.widget;
    const sec = secOf(el);
    const phone = mobile();
    const widgets = widgetsIn(sec)
      .map((n) => widgetOf(n.dataset.widget))
      .filter(Boolean);
    const targets = showTargets(el, sec, phone, widgets);
    linking = { el, id, sec, phone, targets, near: null, from: topDot(boxOf(el, win)), to: null };
    noSelect(true);
    win.addEventListener('pointermove', moveLink, true);
    win.addEventListener('pointerup', endLink, true);
    win.addEventListener('keydown', cancelLink, true);
    kick();
  }

  /**
   * The widgets `el` may follow (in its section, no loop): each an empty circle under its bottom
   * edge and a dim 1px frame (on this layer; the page doesn't change). Shown while its top circle
   * is hovered or dragged.
   */
  function showTargets(el, sec = secOf(el), phone = mobile(), widgets = null) {
    const id = el.dataset.widget;
    widgets ??= widgetsIn(sec)
      .map((n) => widgetOf(n.dataset.widget))
      .filter(Boolean);
    const targets = widgetsIn(sec)
      .filter((n) => n !== el && !n.hidden && !makesLoop(widgets, id, n.dataset.widget, phone))
      .map((n) => {
        const r = boxOf(n, win);
        const [x, y] = bottomDot(r);
        const frame = doc.createElement('div');
        frame.className = 'tframe';
        place(frame, r);
        const dot = doc.createElement('i');
        dot.className = 'target';
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
        return { id: n.dataset.widget, x, y, dot, frame };
      });
    els.targets.replaceChildren(...targets.flatMap((t) => [t.frame, t.dot]));
    return targets;
  }

  function moveLink(e) {
    const p = [e.clientX + win.scrollX, e.clientY + win.scrollY];
    let near = null;
    let best = REACH;
    for (const t of linking.targets) {
      const d = Math.hypot(t.x - p[0], t.y - p[1]);
      if (d <= best) {
        best = d;
        near = t;
      }
    }
    for (const t of linking.targets) {
      t.dot.classList.toggle('is-near', t === near);
      t.frame.classList.toggle('is-near', t === near);
    }
    linking.near = near;
    linking.to = near ? [near.x, near.y] : p;
  }

  // no page text selected while a circle is dragged: user-select off on the page, a selection
  // already there cleared (not a text being edited: its caret stays), selectstart stopped
  const stopSelect = (e) => e.preventDefault();
  let savedSelect = null;
  function noSelect(on) {
    const st = doc.documentElement.style;
    if (on) {
      savedSelect ??= [st.userSelect, st.webkitUserSelect];
      st.userSelect = st.webkitUserSelect = 'none';
      if (!doc.activeElement?.isContentEditable) win.getSelection()?.removeAllRanges();
      doc.addEventListener('selectstart', stopSelect, true);
    } else if (savedSelect) {
      [st.userSelect, st.webkitUserSelect] = savedSelect;
      savedSelect = null;
      doc.removeEventListener('selectstart', stopSelect, true);
    }
  }

  function stopLink() {
    noSelect(false);
    win.removeEventListener('pointermove', moveLink, true);
    win.removeEventListener('pointerup', endLink, true);
    win.removeEventListener('keydown', cancelLink, true);
    els.targets.replaceChildren();
    linking = null;
  }

  function endLink() {
    const { el, id, sec, phone, near } = linking;
    const was = linkOfEl(el);
    stopLink();
    if (near) {
      // it stays where it is: the gap is the rows between them now (negative: it overlaps its
      // leader); it is dragged where it should go from there
      const flow = flowAreas(sec, phone, widgetOf);
      const a = flow[near.id];
      const b = flow[id];
      if (a && b && (was?.to !== near.id || was.gap !== b.row - (a.row + a.rows)))
        onlink(id, near.id, b.row - (a.row + a.rows), { mobile: phone });
    } else if (was) onlink(id, null, 0, { mobile: phone, row: shownRow(el) }); // dropped off: free
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
    ui.link = null;
    const el = widgetEl(id);
    if (el && linkOfEl(el)) onlink(id, null, 0, { mobile: mobile(), row: shownRow(el) });
    return true;
  }
  // Ctrl/Cmd held: the other sections show blocked (drawBlocks)
  const trackMod = (e) => {
    const on = e.ctrlKey || e.metaKey;
    if (ui.mod !== on) ui.mod = on;
    if (on && win) kick();
  };
  function onkeydown(e) {
    trackMod(e);
    if (!['Delete', 'Backspace'].includes(e.key) || !ui.link || editing(e.target)) return;
    if (e.target.closest?.('input, textarea, select')) return;
    e.preventDefault();
    deleteLink();
  }

  // Arrange: clicks pick and drag widgets; the page's own clicks (links, buttons) are off. A
  // text being edited in place (contenteditable, bridge.js) keeps its clicks (the caret).
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
    ui.link = null;
    const mod = e.ctrlKey || e.metaKey;
    const ids = selectedIds(ui);
    const top = e.target.closest?.('[data-widget]');
    const el = selectedUnder(e, mod) || top;
    if (!el) {
      // a section's empty grid: a selection box (Ctrl/Cmd: adds; another section's: refused)
      const sec = secOf(e.target);
      if (sec && live(sec) && widgetsIn(sec).length) {
        if (mod && ids.length && secIdOf(ids[0]) !== sec.dataset.sec)
          return void (e.preventDefault(), e.stopPropagation());
        return startBox(e, sec, mod ? ids : []);
      }
      // a section without widgets: it is selected; outside any: nothing selected
      if (sec && live(sec)) return void onsectionpick(sec.dataset.sec);
      return void ((ui.widget || ui.section || ui.selSection || ui.multi.length) && onpick(null));
    }
    const id = el.dataset.widget;
    if (mod) {
      // Ctrl/Cmd+click: in or out of the selection, only within its section
      e.preventDefault();
      e.stopPropagation();
      const next = toggle(ids, id, secIdOf);
      if (!next) return;
      if (doc.activeElement?.isContentEditable) doc.activeElement.blur();
      ui.anchor = id;
      onselect(next);
      return;
    }
    if (doc.activeElement?.isContentEditable) doc.activeElement.blur(); // ends an edit
    // one of several selected: they all move
    if (ui.multi.length > 1 && ui.multi.includes(id)) return startGroup(e, ui.multi, el);
    ui.anchor = id;
    onpick(id);
    start(e, el);
    // inside the selected widget, over another one: a click (no drag) selects that other one
    if (drag && top && top !== el) drag.click = top.dataset.widget;
  }
  // a double click on a widget: its pop-up (a single click only selects it; a text's own edit
  // still starts, bridge.js)
  function ondblclick(e) {
    if (!arranging() || e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (editing(e.target)) return;
    const id = e.target.closest?.('[data-widget]')?.dataset.widget;
    if (id) onopen?.(id);
  }
  const swallow = (e) => {
    if (!arranging() || e.altKey || editing(e.target)) return;
    if (e.target.closest?.('[data-widget]')) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  function onpointerover(e) {
    if (e.target.id === '__ed-layout') return; // over its circles: the widget stays hovered
    hover = arranging() ? e.target.closest?.('[data-widget]') || null : null;
    hotAt(hover?.dataset.widget);
    hoverSec = arranging() ? secOf(e.target) || null : null;
    if (e.target.id !== '__ed-layout') peekAt(arranging() ? secOf(e.target) : null);
  }

  return {
    /** The preview loaded a document. */
    attach(siteWin) {
      win = siteWin;
      doc = siteWin.document;
      gridKey = '';
      build();
      doc.addEventListener('pointerdown', onpointerdown, true);
      doc.addEventListener('mousedown', swallow, true);
      doc.addEventListener('click', swallow, true);
      doc.addEventListener('dblclick', ondblclick, true);
      doc.addEventListener('pointerover', onpointerover, true);
      doc.documentElement.addEventListener('pointerleave', () => {
        hover = null; // the pointer out of the preview: no widget outlined
        unpeek();
        hotAt(null);
      });
      doc.addEventListener('keydown', onkeydown, true);
      doc.addEventListener('keyup', trackMod, true);
      win.addEventListener('blur', () => (ui.mod = false));
      // what moves the page: the loop runs for it, then idles
      anims = 0;
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
        doc.addEventListener(t, kick, opts);
      win.addEventListener('scroll', kick, opts);
      win.addEventListener('resize', kick, opts);
      // an endless one (a pulse) is followed by neither: the loop would never idle
      const endless = (e) =>
        e.type.startsWith('animation') &&
        /infinite/.test(win.getComputedStyle(e.target).animationIterationCount);
      for (const t of ['transitionrun', 'animationstart'])
        doc.addEventListener(t, (e) => (endless(e) || anims++, kick()), opts);
      for (const t of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel'])
        doc.addEventListener(
          t,
          (e) => (endless(e) || (anims = Math.max(0, anims - 1)), kick()),
          opts,
        );
      new win.MutationObserver(kick).observe(doc.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      new win.ResizeObserver(kick).observe(doc.documentElement);
      this.refresh();
    },
    /** Widget `id` scrolled to (centred) only when it is out of the preview's view. */
    reveal(id) {
      const el = doc && widgetEl(id);
      if (el && offscreen(el.getBoundingClientRect(), win.innerHeight))
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    /** ui.mode, ui.widget or ui.link changed: show or hide what they ask for. */
    refresh() {
      if (!doc || !root) return;
      gridKey = '';
      if (!shown()) els.grids.replaceChildren();
      kick();
    },
    /** The editor's Delete with a link selected (its focus outside the preview). */
    deleteLink,
    /** The loop run for a moment (the editor's panel changed what shows: main.js). */
    kick,
    /** Frames drawn so far (the loop idles: tests). */
    get frames() {
      return frames;
    },
    /** Arrow keys: the selection moved by (dc, dr) cells. */
    nudge,
  };
}
