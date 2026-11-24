/**
 * The site's config, ewcms.config.mjs at the site's root, and the paths it resolves to. Node only.
 *
 *   export default {
 *     contentDir: 'content/en',        // pages/, sources/, strings.json (its parent, the content
 *                                      // root: templates/, site.json, header.json, ...)
 *     mediaDir: 'media',               // original photos (src/cli/photos.mjs reads them)
 *     publicDir: 'public',             // Vite's public folder
 *     publicMediaDir: 'public/media',  // the photos' generated sizes (served as /media/...)
 *     generatedDir: '.generated',      // the media manifest (media.json)
 *     outDir: 'dist',                  // the build
 *     themeDir: 'theme',               // the site's look: tokens.scss, fonts.scss,
 *                                      // overrides.scss, meta.json (each optional; a new site
 *                                      // gets a copy of the engine's default-site/theme/)
 *     widgets: ['./widgets/quote'],    // the site's own widgets (widget modules), after the built-ins
 *     repo: { owner, name },           // GitHub links when the git remote names none
 *   };
 *
 * Every key is optional (DEFAULTS); paths are relative to the root. Without contentDir the language
 * folder follows site.json lang: content/<lang>/ when it exists, else content/en/ (langWarning
 * says so; no folder is made or moved). loadSiteConfig(root) gives
 * the merged config (config) and the absolute paths (contentDir, mediaDir, publicDir,
 * publicMediaDir, generatedDir, manifest, outDir), themeDir and themeLayers (the site's theme
 * folder and its style files, null and [] without), themeMeta (its meta.json, {} without),
 * plus contentRootDir (the content root: contentDir's parent, the shared files and templates/),
 * contentRel and contentRootRel (contentDir and contentRootDir from the root,
 * with "/": git paths and messages) and mediaUrl (publicMediaDir as a URL: "/media").
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { enginePath } from './engine.mjs';

export const CONFIG_FILE = 'ewcms.config.mjs';
/** The old config's name (read no more): a folder with it is a site all the same (scaffold.mjs). */
export const LEGACY_CONFIG_FILE = 'site.config.mjs';

export const DEFAULTS = Object.freeze({
  contentDir: 'content/en',
  mediaDir: 'media',
  publicDir: 'public',
  publicMediaDir: 'public/media',
  generatedDir: '.generated',
  outDir: 'dist',
  themeDir: 'theme',
  widgets: Object.freeze([]),
  repo: Object.freeze({ owner: '', name: '' }),
});

/** A site theme's style files, each optional (src/client/styles/main.scss: the site-layer alias). */
export const THEME_LAYERS = Object.freeze(['fonts.scss', 'tokens.scss', 'overrides.scss']);
/** The theme folder's manifest: name, preloads (was theme.json). */
export const THEME_META = 'meta.json';

/** The theme a new site starts from (ewcms dev copies it into a folder with no site: scaffold.mjs): the look's tokens, fonts, meta.json. */
export const DEFAULT_SITE_THEME = enginePath('default-site', 'theme');

const require = createRequire(import.meta.url);
const cache = new Map();
const posix = (p) => p.split(path.sep).join('/');
const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});

/**
 * The language folder for site.json's lang (contentLang): content/<lang>/, or content/<primary>/
 * ("nl" for "nl-BE"), when it exists; else the default, content/en/, and a warning.
 */
export function langContentDir(root) {
  const contentRoot = path.dirname(DEFAULTS.contentDir);
  let lang = '';
  try {
    lang = String(readJson(path.join(root, contentRoot, 'site.json')).lang || '').trim();
  } catch {
    // a broken site.json: the default folder (ewcms check names the file)
  }
  const fallback = { contentDir: DEFAULTS.contentDir, warning: '' };
  if (!lang) return fallback;
  for (const l of new Set([lang, lang.split('-')[0]])) {
    const dir = `${contentRoot}/${l}`;
    if (dir === DEFAULTS.contentDir || fs.existsSync(path.join(root, dir)))
      return { ...fallback, contentDir: dir };
  }
  return {
    ...fallback,
    warning: `site.json lang "${lang}" has no ${contentRoot}/${lang}/ folder: using ${DEFAULTS.contentDir}/`,
  };
}

/** The site at root (default: the working folder): its config and paths. Cached per root. */
export function loadSiteConfig(root = process.cwd()) {
  root = path.resolve(root);
  if (cache.has(root)) return cache.get(root);
  const file = path.join(root, CONFIG_FILE);
  const own = fs.existsSync(file) ? require(file).default || {} : {};
  const lang = own.contentDir ? { warning: '' } : langContentDir(root);
  const config = {
    ...DEFAULTS,
    ...(lang.contentDir && { contentDir: lang.contentDir }),
    ...own,
    repo: { ...DEFAULTS.repo, ...own.repo },
  };
  const abs = (p) => path.resolve(root, p);
  // The look is the site's own: its theme folder's tokens.scss, fonts.scss, overrides.scss
  // (themeLayers, each optional) and meta.json (name, preloads). The engine has no theme of its own: its chrome
  // and widgets read the site's tokens.
  const themeDir = fs.existsSync(abs(config.themeDir)) ? abs(config.themeDir) : null;
  const site = {
    root,
    config,
    langWarning: lang.warning,
    contentDir: abs(config.contentDir),
    // the content root: the shared files (files.js ROOT_FILES), next to the language folders
    contentRootDir: path.dirname(abs(config.contentDir)),
    // item templates: site-wide, next to the language folders (content/templates)
    templatesDir: path.join(path.dirname(abs(config.contentDir)), 'templates'),
    mediaDir: abs(config.mediaDir),
    publicDir: abs(config.publicDir),
    publicMediaDir: abs(config.publicMediaDir),
    generatedDir: abs(config.generatedDir),
    manifest: path.join(abs(config.generatedDir), 'media.json'),
    outDir: abs(config.outDir),
    themeDir,
    themeLayers: themeDir ? THEME_LAYERS.filter((f) => fs.existsSync(path.join(themeDir, f))) : [],
    themeMeta: themeDir ? readJson(path.join(themeDir, THEME_META)) : {},
    contentRel: posix(path.relative(root, abs(config.contentDir))),
    contentRootRel: posix(path.relative(root, path.dirname(abs(config.contentDir)))) || '.',
    templatesRel: posix(
      path.relative(root, path.join(path.dirname(abs(config.contentDir)), 'templates')),
    ),
    mediaUrl: `/${posix(path.relative(abs(config.publicDir), abs(config.publicMediaDir)))}`,
  };
  cache.set(root, site);
  return site;
}

/** https://github.com/<owner>/<repo> from a git remote URL, else from the config's repo, else ''. */
export function repoUrl(remote, { repo } = DEFAULTS) {
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(remote || '');
  if (m) return `https://github.com/${m[1]}/${m[2]}`;
  return repo?.owner && repo?.name ? `https://github.com/${repo.owner}/${repo.name}` : '';
}
