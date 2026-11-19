/**
 * The layout overlay's links (overlay.js): the lines that join every leader's bottom to its
 * followers' tops, with the gap shown on the selected widget's (drawLinks(), in the overlay's one
 * draw loop: layout()), and the drag of a widget's top circle onto another widget's bottom circle
 * (in its section, no loop) that links it, keeping where it is; dropped anywhere else, a linked
 * widget is free again (onlink). Delete with a link selected removes it (keys.js: deleteLink).
 */
import { makesLoop } from '../render/layout/index.js';
import { boxOf } from '../render/layout/geometry.js';
import { selectLink } from './svelte/ui.svelte.js';

/** How far a link circle sits outside its widget's edge, px (clear of the n / s handles). */
export const DOT = 12;
/** How near the pointer must come to a bottom circle to drop a link on it, px. */
const REACH = 24;
export const SVG = 'http://www.w3.org/2000/svg';

/**
 * `ctx`: the overlay's one state (S: S.linking is the circle dragged; S.drag's live gap shows on
 * its line) and its helpers. Gives drawLinks(), resetLinks() (a new layer: no lines kept),
 * startLink(e, el), showTargets(el) and deleteLink().
 */
export function createOverlayLinks(ctx) {
  const {
    S,
    ui,
    arranging,
    tplOpen,
    tplSec,
    live,
    widgetsIn,
    widgetEl,
    idOf,
    secOf,
    isPhone,
    widgetOf,
    flowOf,
    linkOfEl,
    place,
    noSelect,
    kick,
    onlink,
    escKeys,
  } = ctx;

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
  /** A new layer (the overlay's build()): no line kept from the one before. */
  function resetLinks() {
    linkEls.clear();
    svgSize = '';
    tempPath = null;
  }
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
    escKeys(cancelLink, true);
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

  function stopLink() {
    noSelect(false);
    S.win.removeEventListener('pointermove', moveLink, true);
    S.win.removeEventListener('pointerup', endLink, true);
    escKeys(cancelLink, false);
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

  return { drawLinks, resetLinks, startLink, showTargets, deleteLink };
}
