/**
 * The site's fonts for the toolbar's Style list (WidgetToolbar.svelte), read from the preview's
 * document: its @font-face rules (url()s made absolute) and its --f-display and body font stacks.
 * An exception to "the editor never reads the site's theme": the Style list shows each style as
 * it looks on the page (F95), so its previews take the site's fonts. Each family is renamed
 * ("site <name>"), so a site face never joins one of the editor's own families (DM Mono).
 */

const PREFIX = 'site ';
const FONT_FACE_RULE = 5; // CSSRule.FONT_FACE_RULE
const unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2');

/** url(...) in css made absolute against `base` (data: and blob: kept). */
export const absoluteUrls = (css, base) =>
  css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) =>
    /^(data|blob):/.test(u) ? m : `url("${new URL(u, base).href}")`,
  );

/**
 * { css, display, body } of the preview's document: css the @font-face rules for the editor's
 * document, display and body the font stacks (--f-display, --f-body) with the site's families
 * renamed as in css. null without a document.
 */
export function siteFonts(doc) {
  if (!doc?.defaultView) return null;
  const faces = [];
  const families = new Set();
  const walk = (rules, base) => {
    for (const r of rules) {
      if (r.type === FONT_FACE_RULE) {
        const family = unquote(r.style.getPropertyValue('font-family'));
        families.add(family);
        faces.push(
          absoluteUrls(r.cssText, base).replace(
            /font-family:[^;]+;/,
            `font-family: "${PREFIX}${family}";`,
          ),
        );
      } else if (r.cssRules) walk(r.cssRules, base);
    }
  };
  for (const sheet of doc.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // another origin's sheet
    }
    walk(rules, sheet.href || doc.baseURI);
  }
  const root = doc.defaultView.getComputedStyle(doc.documentElement);
  const stack = (name) =>
    root
      .getPropertyValue(name)
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => (families.has(unquote(f)) ? `"${PREFIX}${unquote(f)}"` : f))
      .join(', ');
  return { css: faces.join('\n'), display: stack('--f-display'), body: stack('--f-body') };
}
