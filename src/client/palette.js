/**
 * A page's own palette (its page file's "palette": src/render/colors.js pagePaletteOf) on <html>:
 * the view's data-palette ("#2a241e,,,,": slot 1 first, empty: the site's) as --palette-1 … 5
 * on its style, the slots it leaves empty cleared (theme.json's show again). The head's
 * <style id="page-palette"> (the first page's, before this runs) goes: from here on the page
 * shown is the view's. Instant (a tween on page change comes later). main.js runs it on every
 * mount; the editor's preview on every edit of the page's palette (src/editor/theme-vars.js).
 */
const SIZE = 5;
const HEX = /^#[0-9a-f]{6}$/i;

export function applyPalette(value, doc = document) {
  doc.getElementById('page-palette')?.remove();
  const root = doc.documentElement;
  const slots = String(value || '').split(',');
  for (let i = 0; i < SIZE; i++) {
    const c = slots[i]?.trim();
    if (c && HEX.test(c)) root.style.setProperty(`--palette-${i + 1}`, c);
    else root.style.removeProperty(`--palette-${i + 1}`);
  }
}
