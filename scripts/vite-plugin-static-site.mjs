/**
 * vite-plugin-static-site: the whole "static site builder" in one small plugin.
 *
 *  dev   → every HTML request is rendered on the fly from content/<folder>/*.json with the
 *          templates in src/site (via Vite's SSR loader, so edits hot-reload).
 *  build → after Vite bundles the client (index.html → dist/index.html with hashed
 *          JS/CSS), every route is rendered into that shell and written to
 *          dist/<route>/index.html, plus 404.html, sitemap.xml, robots.txt and _redirects
 *          (content/en/settings/redirects.json, src/site/redirects.js).
 *
 * index.html is the shell; it contains two markers: <!--ssr-head--> and <!--ssr-body-->.
 *
 * Visual editor (src/editor/index.html → src/editor) is DEV ONLY:
 *  dev   → any page with ?edit (/?edit, /about/?edit&tab=motion: src/editor/lib/editor-url.js)
 *          gets the editor app instead (its preview iframe, ?draft=…, always gets the site; the
 *          old /edit/?path=… redirects there, /edit/sandbox/ to /sandbox/), and /__editor/*
 *          (scripts/editor-server.mjs, localhost only) loads, saves and publishes the content JSON files and uploads photos to
 *          Cloudflare R2 with the R2_* keys from .env.local (read here, never sent to a page).
 *
 * Dev reloads: a change in content/, .generated/ or src/site/ sends the custom HMR event
 * "site:changed" { files, content, external } instead of Vite's full reload, which every
 * page would obey, the editor (?edit) included. The editor reloads only its preview
 * (src/editor/main.js); a plain site tab reloads itself (src/client/main.js). external is
 * false for the editor's own saves. Code changes keep normal HMR.
 *  build → only index.html is bundled; no editor page, code or endpoints are emitted (?edit on
 *          the built site is an ignored param).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { loadEnv, searchForWorkspaceRoot } from 'vite';
import { loadContent } from './content.mjs';
import { DRAFT_PARAM, draftsFor, editorMiddleware } from './editor-server.mjs';
import { contactMiddleware } from './contact-dev.mjs';
import { pageFile } from '../src/site/files.js';
import { EDITOR_HTML, legacyRedirect, wantsEditor } from '../src/editor/lib/editor-url.js';
import { checkSources } from '../src/site/schemas.js';
import { FOLDERS } from '../src/site/files.js';
import { THEME_LAYERS, loadSiteConfig } from './site-config.mjs';
import { createUpdater } from './update.mjs';
import { registerSiteWidgets, widgetClientsModule, widgetsModule } from './site-widgets.mjs';
import { ENGINE, enginePath, fsUrl, posixPath, sameFile, withEngineUrls } from './engine.mjs';

// the engine's modules the server loads itself (render, registry): absolute, the engine is
// not inside the site's root (node_modules/ewcms, or a workspace folder next to it)
const RENDER_FILE = enginePath('src/site/render.js');
const WIDGETS_FILE = enginePath('src/site/widgets/index.js');
const RENDER_MODULE = fsUrl(RENDER_FILE);
const WIDGETS_MODULE = fsUrl(WIDGETS_FILE);

/** The page shell: the site's own index.html if it has one, else the engine's template. */
export const shellFile = (root) =>
  [path.join(root, 'index.html'), enginePath('index.html')].find((f) => fs.existsSync(f));
const readShell = (file) => withEngineUrls(fs.readFileSync(file, 'utf8'));

const attr = (s) => String(s).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
const setLang = (shell, lang) =>
  shell.replace(
    /<html lang="[^"]*"/,
    `<html lang="${String(lang || 'en').replace(/[^\w-]/g, '')}"`,
  );
/** The core's stylesheets (src/client/styles): the theme's styles use them as site-core. */
const CORE_STYLES = enginePath('src/client/styles');

/**
 * The theme's part of a page's head (theme.json), at the shell's <!--theme-meta--> and
 * <!--theme-preloads-->: the theme-color (site.json themeColor first) and color-scheme metas,
 * and its preloads ({ href, as, type?, crossorigin? }).
 */
export function themeHead(theme = {}, themeColor = '') {
  const color = themeColor || theme.themeColor;
  const meta = [
    color && `<meta name="theme-color" content="${attr(color)}" />`,
    theme.colorScheme && `<meta name="color-scheme" content="${attr(theme.colorScheme)}" />`,
  ].filter(Boolean);
  const preloads = (Array.isArray(theme.preloads) ? theme.preloads : []).map(
    (p) =>
      `<link rel="preload" href="${attr(p.href)}" as="${attr(p.as || 'font')}"` +
      `${p.type ? ` type="${attr(p.type)}"` : ''}${p.crossorigin ? ' crossorigin' : ''} />`,
  );
  return { meta: meta.join('\n    '), preloads: preloads.join('\n    ') };
}
const setTheme = (shell, theme, themeColor) => {
  const t = themeHead(theme, themeColor);
  return shell.replace('<!--theme-meta-->', t.meta).replace('<!--theme-preloads-->', t.preloads);
};

/** The editor's page: its title names the site (site.json name), lang from site.json. */
export const editorShell = (shell, site = {}) =>
  setLang(shell, site.lang).replace(
    /<title>[^<]*<\/title>/,
    `<title>${site.name ? `Editor · ${attr(site.name)}` : 'Editor'}</title>`,
  );

const fill = (shell, { head, body, lang, themeColor }, theme) =>
  setTheme(setLang(shell, lang), theme, themeColor)
    .replace('<!--ssr-head-->', head)
    .replace('<!--ssr-body-->', body);

/** The editor's settings, for its browser code: `import editorConfig from 'virtual:editor-config'`. */
export const EDITOR_CONFIG = 'virtual:editor-config';
/**
 * Client code imports the content folder's files through this alias (site.config.mjs contentDir):
 * `import config from '@site-content/settings/animations.json'`.
 */
export const CONTENT_ALIAS = '@site-content';

/** The editor config module's source: the content folder, the editable folders, the media URL. */
export const editorConfigModule = (site) =>
  `export default ${JSON.stringify({
    contentDir: site.contentRel,
    folders: FOLDERS,
    mediaUrl: site.mediaUrl,
    repo: site.config.repo,
  })};\n`;

/** The site's own widgets (site.config.mjs widgets): definitions for the editor, styles and
 * client modules for the public site (scripts/site-widgets.mjs). */
export const SITE_WIDGETS = 'virtual:site-widgets';
export const SITE_WIDGET_CLIENTS = 'virtual:site-widgets/client';

const posixRel = (root, p) => path.relative(root, p).split(path.sep).join('/');
/** The build's entry id: <root>/index.html with "/" (Vite's ids, also on Windows: S:/…). */
export const siteShellId = (root) => posixPath(path.resolve(root, 'index.html'));
/**
 * Whether `id` is the build's entry, <root>/index.html, when the site has no index.html (the
 * engine's template stands in). Any spelling of the path: Rolldown passes the entry as given
 * (S:\\…\\index.html on Windows), Vite with "/".
 */
export const isVirtualShell = (id, root, paths = path) =>
  sameFile(id, paths.join(root, 'index.html'), paths) &&
  !fs.existsSync(path.join(root, 'index.html'));

/**
 * Whether a GET is for a page: an extensionless path or .html, from a client that takes HTML.
 * No Accept header counts (Windows PowerShell's Invoke-WebRequest, scripts' fetches send none).
 */
export function wantsPage(pathname, accept = '') {
  if (path.posix.extname(pathname) && !pathname.endsWith('.html')) return false;
  return !accept || accept.includes('text/html') || accept.includes('*/*');
}

/**
 * The site-layer folder (<generatedDir>/theme-layers): _fonts, _tokens and _overrides, each
 * the site theme's own (themeLayerDir: fonts.scss, ...) or empty. main.scss uses all three, so
 * a layer is optional: Sass has no optional @use. Rewritten when a layer file comes or goes.
 */
export function writeThemeLayers(site) {
  const dir = path.join(site.generatedDir, 'theme-layers');
  fs.mkdirSync(dir, { recursive: true });
  for (const file of THEME_LAYERS) {
    const own = site.themeLayerDir && path.join(site.themeLayerDir, file);
    const rel = own && fs.existsSync(own) && posixPath(path.relative(dir, own));
    const text = rel ? `@use '${rel.replace(/\.scss$/, '')}';\n` : "// none in the site's theme\n";
    const out = path.join(dir, `_${file}`);
    if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== text) fs.writeFileSync(out, text);
  }
  return dir;
}

/** Vite's default (the site's workspace) plus the engine and the packages it serves. */
function engineAllow(root) {
  const req = createRequire(enginePath('package.json'));
  let fa = [];
  try {
    fa = [path.dirname(req.resolve('@fortawesome/fontawesome-free/package.json'))];
  } catch {
    // not installed: the editor's icons are missing anyway
  }
  return [searchForWorkspaceRoot(root), ENGINE, ...fa];
}

export default function staticSite() {
  let config;
  // Until then, content changes come from the editor's own Save (not "external").
  let editorWriteUntil = 0;
  // a Save's files and what it wrote (editor-server.mjs save): a change that leaves a file
  // just so is the editor's own, even when the watcher reports it after those 2s
  const ownWrites = new Map();
  // the site's widgets in Node's registry (the build, the editor endpoints, content checks)
  let widgetsReady = Promise.resolve();
  return {
    name: 'static-site',
    config(c) {
      const site = loadSiteConfig(c.root || process.cwd());
      return {
        resolve: {
          alias: {
            [CONTENT_ALIAS]: site.contentDir,
            // the stylesheets: the core's main.scss uses the theme's, the theme's the core's tokens
            'site-theme': site.themeDir,
            // the site theme's layers over it (tokens, fonts, overrides): writeThemeLayers
            'site-layer': writeThemeLayers(site),
            'site-core': CORE_STYLES,
          },
        },
        // the content folder's name, for client messages ("content/en/settings/animations.json")
        define: { __SITE_CONTENT_DIR__: JSON.stringify(site.contentRel) },
        // the engine's files (the editor's fonts, Font Awesome's) served even when the engine
        // sits outside the site's workspace (a linked checkout): else 403s in the console
        server: { fs: { allow: engineAllow(c.root || process.cwd()) } },
      };
    },
    // engine-owned HTML (the template, the editor, the sandbox) names the engine as %EWCMS%
    transformIndexHtml: { order: 'pre', handler: (html) => withEngineUrls(html) },
    configResolved(c) {
      config = c;
      widgetsReady = registerSiteWidgets(c.root);
      widgetsReady.catch(() => {}); // reported where it is awaited
    },
    resolveId(id) {
      if ([EDITOR_CONFIG, SITE_WIDGETS, SITE_WIDGET_CLIENTS].includes(id)) return `\0${id}`;
      // the build's entry, <root>/index.html: the engine's template when the site has none
      if (isVirtualShell(id, config.root)) return siteShellId(config.root);
    },
    load(id) {
      if (isVirtualShell(id, config.root)) return readShell(shellFile(config.root));
      if (id === `\0${EDITOR_CONFIG}`) return editorConfigModule(loadSiteConfig(config.root));
      if (id === `\0${SITE_WIDGETS}`) return widgetsModule(config.root);
      if (id === `\0${SITE_WIDGET_CLIENTS}`) return widgetClientsModule(config.root);
    },

    configureServer(server) {
      const root = config.root;
      // The editor's unsaved edits per editor session (POST /__editor/draft): only its preview's
      // pages (?draft=<session>) render from them, every other request from the saved files
      const drafts = {};
      // Nothing before the site's widgets are known (content checks need their types)
      server.middlewares.use((req, res, next) => widgetsReady.then(() => next(), next));
      // Content and media manifest changes re-render pages (see handleHotUpdate).
      const site = loadSiteConfig(root);
      server.watcher.add([site.contentDir, site.generatedDir]);
      // a theme layer added or deleted: the site-layer stubs follow (Vite then rebuilds the CSS)
      if (site.themeLayerDir) {
        server.watcher.add(site.themeLayerDir);
        const relayer = (file) => {
          if (path.dirname(path.resolve(file)) === path.resolve(site.themeLayerDir))
            writeThemeLayers(site);
        };
        server.watcher.on('add', relayer).on('unlink', relayer);
      }

      // Editor endpoints (dev only, localhost only).
      server.middlewares.use(
        '/__editor',
        editorMiddleware({
          root,
          logger: config.logger,
          // R2_* only (Node side): Vite exposes nothing but VITE_* to client code
          env: loadEnv(config.mode, config.envDir || root, 'R2_'),
          drafts,
          updater: createUpdater({ root, server, logger: config.logger }),
          onWrite: (texts) => {
            editorWriteUntil = Date.now() + 2000;
            for (const [file, text] of texts || []) ownWrites.set(path.resolve(file), text);
          },
          render: () => server.ssrLoadModule(RENDER_MODULE),
        }),
      );

      // The contact form's POST /api/contact (functions/contact.js): checked, logged, not sent
      server.middlewares.use('/api/contact', contactMiddleware(config.logger));

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const url = new URL(req.url, 'http://localhost');
        if (!wantsPage(url.pathname, req.headers.accept)) return next();
        if (url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules'))
          return next();
        const moved = legacyRedirect(url); // the old /edit/?path=… addresses
        if (moved || url.pathname === '/sandbox') {
          res.writeHead(302, { Location: moved || '/sandbox/' + url.search });
          return res.end();
        }
        if (url.pathname === '/sandbox/') {
          // the mock sandbox (the engine's sandbox/index.html, sandbox/README.md)
          const html = readShell(enginePath('sandbox/index.html'));
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.end(await server.transformIndexHtml(req.url, html));
        }
        try {
          if (wantsEditor(url, req.headers)) {
            // the editor app on this page (src/editor/lib/editor-url.js); its preview gets the site
            const shell = editorShell(readShell(enginePath(EDITOR_HTML)), loadContent(root).site);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.end(await server.transformIndexHtml(req.url, shell));
          }
          const { getRoutes, renderRoute } = await server.ssrLoadModule(RENDER_MODULE);
          // the site's widgets in the render's own module graph too (Vite's SSR one)
          const { registerWidgets } = await server.ssrLoadModule(WIDGETS_MODULE);
          await registerSiteWidgets(root, {
            load: (file) => server.ssrLoadModule(file),
            register: registerWidgets,
          });
          const draft = url.searchParams.get(DRAFT_PARAM);
          const content = loadContent(root, draftsFor(drafts, draft));
          // the editor's preview (a draft session): [param] pages that build none too (routes.js)
          const routes = getRoutes(content, { unbuilt: !!draft });
          let pathname = url.pathname.replace(/index\.html$/, '');
          if (!pathname.endsWith('/')) pathname += '/';
          let route = routes.find((r) => r.path === pathname);
          if (route?.redirect) {
            // a folder without its own page (routes.js): its first sub page
            res.writeHead(302, { Location: route.redirect + url.search });
            return res.end();
          }
          const status = route ? 200 : 404;
          route ||= routes.find((r) => r.page === 'notFound');
          const shell = readShell(shellFile(root));
          const html = await server.transformIndexHtml(
            req.url,
            fill(
              shell,
              renderRoute(route, content, { editable: true, unbuilt: !!draft }),
              loadSiteConfig(root).theme,
            ),
          );
          res.statusCode = status;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (err) {
          server.ssrFixStacktrace?.(err);
          next(err);
        }
      });
    },

    /** Content and templates changed: tell the pages (see the top of this file). */
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.tmp')) return []; // writeFileAtomic's temporary file (scripts/content.mjs)
      const rel = path.relative(config.root, file).split(path.sep).join('/');
      // content and media manifest files are data: they re-render pages, never hot-update modules
      const site = loadSiteConfig(config.root);
      const content = [site.contentDir, site.generatedDir].some((d) =>
        rel.startsWith(`${posixRel(config.root, d)}/`),
      );
      // the engine's templates: src/site in the engine's folder
      const engineRel = posixRel(ENGINE, file);
      const template = engineRel.startsWith('src/site/');
      if (!content && !template) return;
      const own = ownWrites.get(path.resolve(file));
      let mine = false;
      if (own !== undefined) {
        try {
          mine = fs.readFileSync(file, 'utf8') === own;
        } catch {
          // gone: someone else's change
        }
        if (mine) ownWrites.delete(path.resolve(file));
      }
      const external = !mine && Date.now() >= editorWriteUntil;
      server.ws.send({
        type: 'custom',
        event: 'site:changed',
        data: { files: [template ? `ewcms/${engineRel}` : rel], content, external },
      });
      // Client code imports animations.json: without this, Vite would full-reload every page.
      // src/site modules keep Vite's own handling (the editor imports some of them).
      if (content) return [];
    },

    async closeBundle() {
      if (config.command !== 'build') return;
      const root = config.root;
      const outDir = path.resolve(root, config.build.outDir);
      const shellFile = path.join(outDir, 'index.html');
      if (!fs.existsSync(shellFile)) return;
      const shell = fs.readFileSync(shellFile, 'utf8');
      const {
        buildRedirects,
        buildRoutes,
        ownPageRedirects,
        redirectPage,
        pathsOf,
        redirectsText,
        renderRoute,
        bindingChecks,
        motionChecks,
        seoWarnings,
        sitemapXml,
      } = await import(pathToFileURL(RENDER_FILE).href + `?t=${Date.now()}`);
      await widgetsReady;
      // the render module was imported by Node itself: its registry is not the one this plugin
      // (loaded once, from the engine's own folder) registered in, so the site's widgets join it too
      const { registerWidgets } = await import(pathToFileURL(WIDGETS_FILE).href);
      await registerSiteWidgets(root, { register: registerWidgets });
      const content = loadContent(root);
      // every source against its schema (required fields, types, photos): stop on a mistake
      const problems = checkSources(content);
      if (problems.length) throw new Error(`Content problems:\n  ${problems.join('\n  ')}`);
      // bindings against the sources' schemas: a wrong one stops, an empty one warns
      const bindings = bindingChecks(content);
      const wrong = bindings.filter((p) => p.level === 'error').map((p) => p.message);
      if (wrong.length) throw new Error(`Binding problems:\n  ${wrong.join('\n  ')}`);
      for (const p of bindings) config.logger.warn(`\x1b[33m[bindings]\x1b[0m ${p.message}`);
      // every widget's animation is in the library
      const motion = motionChecks(content);
      if (motion.length) throw new Error(`Motion problems:\n  ${motion.join('\n  ')}`);
      const { routes, warnings } = buildRoutes(content);
      for (const w of warnings) config.logger.warn(`\x1b[33m[routes]\x1b[0m ${w}`);
      for (const w of seoWarnings(routes)) config.logger.warn(`\x1b[33m[seo]\x1b[0m ${w}`);

      for (const route of routes) {
        const rel = route.out || path.join(route.path, 'index.html');
        const file = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        // a folder without its own page: a redirect page (and a 302 in _redirects)
        fs.writeFileSync(
          file,
          route.redirect
            ? redirectPage(route.redirect)
            : fill(shell, renderRoute(route, content), loadSiteConfig(root).theme),
        );
      }
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemapXml(routes, content.site.url));
      fs.writeFileSync(
        path.join(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\nSitemap: ${content.site.url}/sitemap.xml\n`,
      );
      // Cloudflare Pages / Netlify: "from to status" per line
      const redirects = buildRedirects(content.redirects, pathsOf(content));
      for (const w of redirects.warnings) config.logger.warn(`\x1b[33m[redirects]\x1b[0m ${w}`);
      const text = redirectsText([...ownPageRedirects(routes), ...redirects.list]);
      fs.writeFileSync(path.join(outDir, '_redirects'), text && `${text}\n`);

      // The editor is dev-only: make sure nothing of it ends up in the build.
      fs.rmSync(path.join(outDir, 'edit'), { recursive: true, force: true });
      fs.rmSync(path.join(outDir, '404'), { recursive: true, force: true });
      config.logger.info(
        `\x1b[32m✓\x1b[0m prerendered ${routes.length} routes into ${path.relative(root, outDir)}/\n` +
          routes.map((r) => `  ${r.path.padEnd(28)} ${r.template || pageFile(r.id)}`).join('\n'),
      );
    },
  };
}
