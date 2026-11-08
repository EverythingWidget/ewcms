/**
 * The template editor's text size warning (TemplatePanel.svelte): text has no minimum size,
 * but the editor warns when a template widget's text shows under MIN_TEXT_PX in the preview
 * (at the preview's width: a phone preview measures the phone layout, or the scaled desktop).
 */
export const MIN_TEXT_PX = 11;

/** Each template widget's smallest text size in `doc` ({ [data-tw id]: px }, rounded to 0.5). */
export function textSizes(doc) {
  const out = {};
  if (!doc?.querySelectorAll) return out;
  const win = doc.defaultView;
  for (const w of doc.querySelectorAll('.sec--item > .wgt[data-tw]')) {
    const id = w.dataset.tw;
    const walker = doc.createTreeWalker(w, 4); // text nodes
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || !n.parentElement) continue;
      const px = parseFloat(win.getComputedStyle(n.parentElement).fontSize);
      if (!Number.isFinite(px)) continue;
      const r = Math.round(px * 2) / 2;
      if (out[id] === undefined || r < out[id]) out[id] = r;
    }
  }
  return out;
}

/** The line shown under a widget: '' when it has no text in the preview. */
export function sizeLine(px) {
  if (px === undefined) return '';
  return px < MIN_TEXT_PX
    ? `Text ${px} px here: under ${MIN_TEXT_PX} px, hard to read`
    : `Text ${px} px here`;
}
