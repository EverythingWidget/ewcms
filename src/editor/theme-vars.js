/**
 * The preview follows content/theme.json as it is edited, with no reload (lib/needs-reload.js:
 * theme.json is IN_PLACE): its CSS variables (src/render/theme.js themeVars: --brand, the type
 * scale, the layout) replace the :root:root block of the page's <style id="theme-vars">, the
 * one the page head rendered (shell/layout.js), and its color-scheme meta is brought in line
 * with color.scheme. A value cleared is gone from it, so the theme's tokens.scss default shows
 * again (and no color-scheme meta when that is cleared). main.js calls applyTheme on every
 * theme.json change (an edit, undo, redo, the panel open or not) and whenever a page loads in
 * the preview.
 */
import { schemeOf, themeVars } from '../render/theme.js';

const ROOT_BLOCK = /\s*:root:root\s*\{[^}]*\}/g;

/** The theme-vars style's text with theme.json's :root:root block (none when it sets nothing). */
export function themeStyleText(text, theme) {
  const vars = themeVars(theme);
  const rest = String(text || '').replace(ROOT_BLOCK, '').trimEnd();
  return vars ? `${rest}\n      :root:root {\n        ${vars};\n      }\n    ` : rest;
}

/** Put theme.json's variables on the preview's document `doc` (see the top). */
export function applyThemeVars(doc, theme) {
  if (!doc?.head) return;
  let el = doc.getElementById('theme-vars');
  const text = themeStyleText(el?.textContent, theme);
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

/** Put theme.json on the preview's document: CSS variables and the color-scheme meta. */
export function applyTheme(doc, theme) {
  applyThemeVars(doc, theme);
  applyColorScheme(doc, theme);
}
