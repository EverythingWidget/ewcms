/**
 * The preview follows content/theme.json as it is edited, with no reload (lib/needs-reload.js:
 * theme.json is IN_PLACE): its CSS variables (src/render/theme.js themeVars: --brand, the type
 * scale, the layout) replace the :root:root block of the page's <style id="accent-init">, the
 * one the page head rendered (shell/layout.js). A value cleared is gone from it, so the theme's
 * tokens.scss default shows again. main.js calls it on every theme.json change (an edit, undo,
 * redo, the panel open or not) and whenever a page loads in the preview.
 */
import { themeVars } from '../render/theme.js';

const ROOT_BLOCK = /\s*:root:root\s*\{[^}]*\}/g;

/** The accent-init style's text with theme.json's :root:root block (none when it sets nothing). */
export function themeStyleText(text, theme) {
  const vars = themeVars(theme);
  const rest = String(text || '').replace(ROOT_BLOCK, '').trimEnd();
  return vars ? `${rest}\n      :root:root {\n        ${vars};\n      }\n    ` : rest;
}

/** Put theme.json's variables on the preview's document `doc` (see the top). */
export function applyThemeVars(doc, theme) {
  if (!doc?.head) return;
  let el = doc.getElementById('accent-init');
  const text = themeStyleText(el?.textContent, theme);
  if (!el) {
    if (!text.trim()) return;
    el = doc.createElement('style');
    el.id = 'accent-init';
    doc.head.prepend(el);
  }
  if (el.textContent !== text) el.textContent = text;
}
