/**
 * site.json lang: the languages offered (the first-run modal and Site settings, one list) and
 * the hint for one without its content folder in use. The language folder is read when
 * ewcms dev starts (src/cli/site-config.mjs langContentDir): content/<lang>/ when it exists,
 * else content/en/.
 */
import { CONTENT_DIR, contentRoot } from '../../render/files.js';

/** [lang, label] */
export const LANGUAGES = [
  ['en', 'English'],
  ['nl', 'Nederlands'],
  ['de', 'Deutsch'],
  ['fr', 'Français'],
  ['es', 'Español'],
  ['it', 'Italiano'],
];

/** The Select's options, with `current` too when it is not in the list (nl-BE). */
export function languageOptions(current = '') {
  const list = LANGUAGES.map(([value, label]) => ({ value, label, hint: value }));
  return !current || LANGUAGES.some(([l]) => l === current)
    ? list
    : [...list, { value: current, label: current, hint: current }];
}

/** '' when lang's folder is the one in use; else where the pages are and what it takes. */
export function langHint(lang) {
  const folder = CONTENT_DIR.split('/').pop();
  if (!lang || lang === folder || lang.split('-')[0] === folder) return '';
  return `Uses ${CONTENT_DIR}/ until ${contentRoot()}/${lang}/ exists and ewcms dev restarts.`;
}
