/**
 * Where the engine (this package, ewcms) is, and how the dev server and the build reach its
 * files from a site's root: the site's own folder holds only its content, theme and media.
 * Node only. Paths are the platform's (Windows: S:\…); URLs always use "/".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The engine's folder: the real one (a workspace link or node_modules/ewcms resolved). */
export const ENGINE = fs.realpathSync(fileURLToPath(new URL('..', import.meta.url)));

/** A path in the engine, e.g. enginePath('src/site/render.js'). */
export const enginePath = (...parts) => path.join(ENGINE, ...parts);

/** A path with "/" separators (Vite's ids, globs, URLs). */
export const posixPath = (p, paths = path) => p.split(paths.sep).join('/');

/**
 * A file's dev server URL by its absolute path (Vite's /@fs/ prefix): /@fs/home/x/a.js,
 * /@fs/S:/ewcms-dev/ewcms/a.js on Windows. The build resolves the same URLs.
 */
export const fsUrl = (abs, paths = path) => {
  const p = posixPath(paths.resolve(abs), paths);
  return `/@fs${p.startsWith('/') ? '' : '/'}${p}`;
};

/**
 * Whether a module id (Vite / Rolldown: "/" or "\\", maybe a /@fs/ or /S:/ prefix, a ?query) is
 * the file at `file`. Windows (paths = path.win32): drive letters and names case-insensitive.
 */
export function sameFile(id, file, paths = path) {
  const norm = (s) => {
    let p = String(s).split('?')[0].replace(/\\/g, '/');
    if (p.startsWith('/@fs/')) p = p.slice(4);
    if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
    return p.replace(/\/{2,}/g, '/');
  };
  const a = norm(id);
  const b = norm(paths.resolve(file));
  return paths === path.win32 ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** The marker engine-owned HTML uses for the engine's URL: %EWCMS%/src/client/main.js. */
export const ENGINE_MARK = '%EWCMS%';

/** HTML with %EWCMS% replaced by the engine's URL (fsUrl). */
export const withEngineUrls = (html) => html.split(ENGINE_MARK).join(fsUrl(ENGINE));

/** The engine's package.json version. */
export const ENGINE_VERSION = JSON.parse(
  fs.readFileSync(enginePath('package.json'), 'utf8'),
).version;

/**
 * The site the mock sandbox's dev server runs (npm run mock, mock:serve): MOCK_SITE, else the
 * working folder when it is a site, else the engine's test fixture (never written: no images).
 */
export function mockSite(cwd = process.cwd()) {
  if (process.env.MOCK_SITE) return path.resolve(process.env.MOCK_SITE);
  const isSite = ['site.config.mjs', 'content'].some((f) => fs.existsSync(path.join(cwd, f)));
  return isSite ? cwd : enginePath('test', 'fixtures', 'site-a');
}
