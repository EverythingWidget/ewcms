/**
 * Fit text (src/site/layout/type.js: "fit": true): a text widget's longest line fills the
 * widget's width, as --tkf on the widget (one factor over its styles' sizes, _layout.scss
 * .wgt--fit; each line kept on one line). Never by its height. Sizes are linear in --tkf, so
 * one measurement does it: the lines' widths at --tkf 1, then width / longest. Worked out on
 * load and whenever the widget's WIDTH or its text changes (fonts loading, the editor's
 * typing), at most once a frame; its own height changing (the text it sized) is not a change,
 * so no loop.
 */
const FIT = '.wgt--fit';
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

// a widget's last fit: what it was measured with (its width, its text)
const cache = new WeakMap();

/** The --tkf at which the widget's longest line fills its width; only when it changed. */
export function fitOne(el) {
  const body = el.querySelector('.text__body') || el.firstElementChild;
  if (!body) return;
  const cs = getComputedStyle(body);
  const room = body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (!(room > 0)) return;
  const key = `${room}|${body.innerHTML}`;
  if (cache.get(el) === key && el.style.getPropertyValue('--tkf')) return;
  el.style.setProperty('--tkf', '1');
  const lines = [...body.querySelectorAll('.ts')];
  const all = lines.length ? lines : [body];
  const k = fitFactor(
    room,
    all.map(lineWidth),
    all.map((l) => indentOf(l, room)),
  );
  el.style.setProperty('--tkf', String(k));
  cache.set(el, key);
}

export function fitText(view) {
  let raf = 0;
  const dirty = new Set();
  const run = () => {
    raf = 0;
    for (const el of dirty) {
      if (el.isConnected && el.matches(FIT)) fitOne(el);
      else if (!el.isConnected) ro.unobserve(el); // gone (a section rendered again)
    }
    dirty.clear();
  };
  const queue = (el) => {
    dirty.add(el);
    if (!raf) raf = requestAnimationFrame(run);
  };
  // a width change only: its own height (the text it sized) changing is not one
  const widths = new WeakMap();
  const ro = new ResizeObserver((entries) =>
    entries.forEach((e) => {
      const w = e.contentRect.width;
      if (widths.get(e.target) === w) return;
      widths.set(e.target, w);
      queue(e.target);
    }),
  );
  // the widgets a fit turns on later (the editor's toolbar) and the text typed in them
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      const el = t?.closest?.(FIT);
      if (el) queue(el);
      // removed fitted widgets: no longer observed
      for (const n of m.removedNodes || [])
        if (n.nodeType === 1) {
          if (n.matches(FIT)) ro.unobserve(n);
          n.querySelectorAll?.(FIT).forEach((b) => ro.unobserve(b));
        }
      if (m.type === 'attributes' && t?.matches?.('.wgt')) {
        if (t.matches(FIT)) {
          ro.observe(t);
          queue(t);
        } else if (t.style.getPropertyValue('--tkf')) t.style.removeProperty('--tkf');
      }
    }
  });
  // (fonts loaded: every widget measured again, its text and box the same or not)
  const watch = (again) =>
    view.querySelectorAll(FIT).forEach((el) => {
      if (again) cache.delete(el);
      ro.observe(el);
      queue(el);
    });
  watch();
  mo.observe(view, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  document.fonts?.ready.then(() => watch(true));
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    mo.disconnect();
  };
}
