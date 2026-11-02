/**
 * A Text widget's live sizes (src/site/layout/type.js), worked out in the page and the editor's
 * preview alike:
 *
 *   Fit width   a line with "fit": true ([data-fit], src/site/text.js) fills the widget's width,
 *               on one line: --tkf on that line (_layout.scss: its style's size in cells × it).
 *               Never by its height; the other lines keep their style's size.
 *   Scale to fit  a widget with "scale": true (.wgt--scale): its text laid out at its normal
 *               sizes at the widget's width (kept, --tkw: or its widest word's), scaled down as one, like a
 *               photo (--tks: the text body's zoom, never above 1), until it fits the widget's
 *               width (a word wider than it) and, a widget with a fixed height (Rows, Aspect),
 *               its height too. Same line breaks, same proportions. A fit line still fills the
 *               width (its size ÷ --tks).
 *
 * Sizes are linear in --tkf, so one measurement does a line: its width at --tkf 1, then
 * room / width. Worked out on load and whenever the widget's WIDTH (a fixed-height widget: its
 * height too) or its text changes (fonts loading, the editor's typing), at most once a frame;
 * the height it gives an Auto widget is not a change, so no loop.
 */
const WATCH = '.wgt--scale, .wgt:has(.ts[data-fit])';
const LINE = '.ts[data-fit]';
const MIN = 0.05;
const MAX = 40;

/** A line's text width at the current --tkf (as wide as its content, whatever its alignment). */
function lineWidth(line) {
  const was = line.style.width;
  line.style.width = 'max-content';
  const w = line.getBoundingClientRect().width;
  line.style.width = was;
  return w;
}

/** A line's indent (a style's text-indent, a % of the widget: it doesn't grow with the text). */
function indentOf(line, room) {
  const v = getComputedStyle(line).textIndent;
  const n = parseFloat(v) || 0;
  return v.endsWith('%') ? (n / 100) * room : n;
}

/**
 * The factor that makes the longest line fill `room`: each line's text `widths` (measured at 1)
 * after its fixed `indents` (px, not scaled).
 */
export function fitFactor(room, widths, indents = []) {
  if (!(room > 0)) return 1;
  let k = Infinity;
  widths.forEach((w, i) => {
    if (w > 0) k = Math.min(k, Math.max(0, room - (indents[i] || 0)) / w);
  });
  if (k === Infinity) return 1;
  // a hair under: rounding never pushes the longest line over the edge
  return Math.min(MAX, Math.max(MIN, Math.floor(k * 0.995 * 1000) / 1000));
}

/**
 * Scale to fit's factor: the text laid out at `room` (px wide) is `width` × `height` (its
 * widest content, a word wider than the room too); `fixed` of that height is fit lines, which
 * keep their size. Fits `room` and `limit` (the widget's height; Infinity: an Auto widget), at
 * most 1 (only down).
 */
export function scaleFactor(room, width, height, limit = Infinity, fixed = 0) {
  if (!(room > 0) || !(width > 0)) return 1;
  let k = Math.min(1, room / width);
  if (Number.isFinite(limit) && height > limit) {
    const rest = height - fixed;
    k = Math.min(k, rest > 0 ? Math.max(0, limit - fixed) / rest : 1);
  }
  if (k >= 1) return 1;
  return Math.max(MIN, Math.floor(k * 0.995 * 1000) / 1000);
}

// a widget's last fit: what it was measured with (its size, its text)
const cache = new WeakMap();
const VARS = ['--tks', '--tkw'];

/** Every fit line's --tkf and the widget's Scale to fit (--tks, --tkw); only when it changed. */
export function fitOne(el) {
  const body = el.querySelector('.text__body') || el.firstElementChild;
  if (!body) return;
  const scale = el.matches('.wgt--scale');
  const fixed = scale && !el.matches('.wgt--auto');
  // measured as laid out at 1: no zoom, no kept width
  VARS.forEach((v) => el.style.removeProperty(v));
  const cs = getComputedStyle(body);
  const room = body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (!(room > 0)) return;
  const limit = fixed ? el.clientHeight : Infinity;
  const text = body.innerHTML.replace(/ style="[^"]*"/g, '');
  const key = `${room}|${fixed ? limit : ''}|${text}`;
  const lines = [...body.querySelectorAll(LINE)];
  const was = cache.get(el);
  if (was?.key === key)
    return void VARS.forEach((v, i) => was.vars[i] && el.style.setProperty(v, was.vars[i]));
  for (const line of lines) {
    line.style.setProperty('--tkf', '1');
    line.style.setProperty(
      '--tkf',
      String(fitFactor(room, [lineWidth(line)], [indentOf(line, room)])),
    );
  }
  const vars = ['', ''];
  if (scale) {
    const width = Math.max(room, body.scrollWidth);
    const height = body.getBoundingClientRect().height;
    const kept = lines.reduce((n, l) => n + l.getBoundingClientRect().height, 0);
    const k = scaleFactor(room, width, height, limit, kept);
    if (k < 1) {
      vars[0] = String(k);
      // laid out as measured: as wide as its widest word (or the widget), so scaled it fits
      vars[1] = `${Math.ceil(width)}px`;
      VARS.forEach((v, i) => el.style.setProperty(v, vars[i]));
    }
  }
  cache.set(el, { key, vars });
}

export function fitText(view) {
  let raf = 0;
  const dirty = new Set();
  const watched = new Set();
  const clear = (el) => {
    VARS.forEach((v) => el.style.removeProperty(v));
    cache.delete(el);
  };
  const run = () => {
    raf = 0;
    for (const el of dirty) {
      if (el.isConnected && el.matches(WATCH)) fitOne(el);
      else {
        // gone (a section rendered again), or neither fit lines nor Scale to fit any more
        ro.unobserve(el);
        watched.delete(el);
        if (el.isConnected) clear(el);
      }
    }
    dirty.clear();
  };
  const queue = (el) => {
    dirty.add(el);
    if (!raf) raf = requestAnimationFrame(run);
  };
  const observe = (el) => {
    if (!watched.has(el)) (watched.add(el), ro.observe(el));
    queue(el);
  };
  // its width changing (a fixed-height widget: its height too); the height its text gives an
  // Auto widget is not a change
  const sizes = new WeakMap();
  const ro = new ResizeObserver((entries) =>
    entries.forEach((e) => {
      const t = e.target;
      const s = `${e.contentRect.width}|${t.matches('.wgt--auto') ? '' : e.contentRect.height}`;
      if (sizes.get(t) === s) return;
      sizes.set(t, s);
      queue(t);
    }),
  );
  // widgets that get a fit line or Scale to fit later (the editor), and the text typed in them
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      const el = t?.closest?.('.wgt');
      if (el && (el.matches(WATCH) || watched.has(el))) {
        if (el.matches(WATCH)) observe(el);
        else queue(el);
      }
      for (const n of m.addedNodes || [])
        if (n.nodeType === 1) {
          if (n.matches('.wgt') && n.matches(WATCH)) observe(n);
          n.querySelectorAll?.(WATCH).forEach(observe);
        }
    }
  });
  // (fonts loaded: every widget measured again, its text and box the same or not)
  const watch = (again) =>
    view.querySelectorAll(WATCH).forEach((el) => {
      if (again) cache.delete(el);
      observe(el);
    });
  watch();
  mo.observe(view, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'data-fit'],
  });
  document.fonts?.ready.then(() => watch(true));
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    mo.disconnect();
  };
}
