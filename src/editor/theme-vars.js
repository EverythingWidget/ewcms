/**
 * The preview follows content/theme.json as it is edited, with no reload (lib/needs-reload.js:
 * theme.json is IN_PLACE): its CSS variables (src/render/theme.js themeVars: --brand, the type
 * scale and fonts, the layout) replace the :root:root block of the page's <style id="theme-vars">, the
 * one the page head rendered (shell/layout.js), and its color-scheme meta is brought in line
 * with color.scheme. A value cleared is gone from it, so the theme's tokens.scss default shows
 * again (and no color-scheme meta when that is cleared). Its palette's color themes (src/render/
 * colors.js) replace the text of the page's <style id="color-themes">. main.js calls applyTheme on every
 * theme.json change (an edit, undo, redo, the panel open or not) and whenever a page loads in
 * the preview.
 *
 * Two more look edits outside theme.json go in the same way, with no reload: a page's own palette
 * (its page file's "palette", the page's Style tab: applyPagePalette, the view's data-palette and
 * <html>'s --palette-n, as the client does on a page change) and the header's height in grid rows
 * (header.json rows and rowsPhone, the Header's Style tab: applyHeaderRows, the head's
 * <style id="header-rows">; lib/needs-reload.js headerKey leaves them out).
 */
import { schemeOf, themeVars } from '../render/theme.js';
import { colorThemeStyle, pagePaletteAttr } from '../render/colors.js';
import { headerRowsCss } from '../render/header-rows.js';
import { applyPalette } from '../client/palette.js';

const ROOT_BLOCK = /\s*:root:root\s*\{[^}]*\}/g;

/** The theme-vars style's text with theme.json's :root:root block (none when it sets nothing). */
export function themeStyleText(text, theme, fonts) {
  const vars = themeVars(theme, fonts);
  const rest = String(text || '').replace(ROOT_BLOCK, '').trimEnd();
  return vars ? `${rest}\n      :root:root {\n        ${vars};\n      }\n    ` : rest;
}

/** Put theme.json's variables on the preview's document `doc` (see the top). */
export function applyThemeVars(doc, theme, fonts) {
  if (!doc?.head) return;
  let el = doc.getElementById('theme-vars');
  const text = themeStyleText(el?.textContent, theme, fonts);
  if (!el) {
    if (!text.trim()) return;
    el = doc.createElement('style');
    el.id = 'theme-vars';
    doc.head.prepend(el);
  }
  if (el.textContent !== text) el.textContent = text;
}

/** Put theme.json's color-scheme meta on the preview's document `doc` (no reload). */
export function applyColorScheme(doc, theme) {
  if (!doc?.head) return;
  const scheme = schemeOf(theme);
  let el = doc.querySelector('meta[name="color-scheme"]');
  if (!scheme) {
    el?.remove();
    return;
  }
  if (!el) {
    el = doc.createElement('meta');
    el.setAttribute('name', 'color-scheme');
    const themeColor = doc.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.after(el);
    else doc.head.append(el);
  }
  if (el.getAttribute('content') !== scheme) el.setAttribute('content', scheme);
}

/** Put theme.json's color themes on the preview's document `doc`: the color-themes style's text. */
export function applyColorThemes(doc, theme) {
  if (!doc?.head) return;
  let el = doc.getElementById('color-themes');
  const text = colorThemeStyle(theme);
  if (!el) {
    el = doc.createElement('style');
    el.id = 'color-themes';
    doc.head.prepend(el);
  }
  if (el.textContent.trim() !== text) el.textContent = text;
}

/** Put theme.json on the preview's document: color themes, CSS variables and the color-scheme meta. */
export function applyTheme(doc, theme, fonts) {
  applyColorThemes(doc, theme);
  applyThemeVars(doc, theme, fonts);
  applyColorScheme(doc, theme);
}

/** Put a page's own palette on the preview's document `doc` (page: its page file's data). */
export function applyPagePalette(doc, page) {
  const view = doc?.querySelector?.('[data-router-view]');
  if (!view) return;
  const value = pagePaletteAttr(page);
  if (value) view.dataset.palette = value;
  else delete view.dataset.palette;
  applyPalette(value, doc);
}

/** Put header.json's rows on the preview's document `doc`: the header-rows style (none: removed). */
export function applyHeaderRows(doc, header) {
  if (!doc?.head) return;
  const css = headerRowsCss(header);
  let el = doc.getElementById('header-rows');
  if (!css) return void el?.remove();
  if (!el) {
    el = doc.createElement('style');
    el.id = 'header-rows';
    doc.head.append(el);
  }
  if (el.textContent.trim() !== css) el.textContent = css;
}
