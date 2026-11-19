/**
 * The ewcms command (bin/ewcms.mjs), one function per command; each takes the site's root.
 * Plain Node and Vite's JavaScript API: no shell, the same in PowerShell, cmd, WSL and macOS.
 *
 *   dev            photo sizes, then the dev server (pages, the editor at ?edit, /sandbox/); in a
 *                  folder with no site yet, first the default site (scaffold.mjs: only what is missing)
 *   build          photo sizes, then the static build (outDir, dist/)
 *   preview        serve the build
 *   check          content (every file, sources, bindings, motion), then lint (the theme's SCSS,
 *                  the site's own JS) when ESLint / Stylelint are installed; --links: the build's links
 *   photos         media/ → public/media sizes + .generated/media.json
 *   publish-media  upload media/ photos to Cloudflare R2 (.env.local R2_* keys), like the editor
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ENGINE, enginePath, posixPath, ENGINE_VERSION } from './engine.mjs';
import {
  loadSiteConfig,
  CONFIG_FILE,
  DEFAULT_SITE_THEME,
  legacyConfigWarning,
} from './site-config.mjs';
import { buildPhotos } from './photos.mjs';
import { checkLinks } from './check-links.mjs';
import { registerSiteWidgets } from './site-widgets.mjs';
import { isSiteFolder, scaffoldSite, enginePin, installSite } from './scaffold.mjs';
import { assertNoSettingsFolder, walkJson, loadContent } from './content.mjs';

const VITE_CONFIGS = ['vite.config.js', 'vite.config.mjs', 'vite.config.ts'];

/** Vite's inline config for the site: its own vite.config.* if it has one, else the preset. */
async function viteConfig(root, extra = {}) {
  const own = VITE_CONFIGS.map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
  if (own) return { configFile: own, root, ...extra };
  const { siteConfig } = await import('../../vite.js');
  return { configFile: false, ...siteConfig({ root }), ...extra };
}

const photos = async (root, opts) => {
  if (opts.photos === false) return;
  await buildPhotos(root);
};

function warnLegacyConfig(root) {
  const warning = legacyConfigWarning(root);
  if (warning) console.warn(warning);
  // site.json lang without its language folder: content/en/ (site-config.mjs langContentDir)
  const lang = loadSiteConfig(root).langWarning;
  if (lang) console.warn(`! ${lang}`);
}

export async function dev(root, opts = {}) {
  // the first run in a folder with no site: the default site (the editor asks for the name, language, look)
  if (!isSiteFolder(root)) {
    const pin = enginePin();
    if (!pin.exact)
      console.warn(`! the running ewcms's commit is unknown: package.json pins #${pin.ref}`);
    const made = scaffoldSite(root, { pin });
    console.log(
      `New site in ${root}: ${made.length} default-site file(s) (${CONFIG_FILE}, content/, theme/, public/, functions/), ewcms #${pin.ref}`,
    );
    // its packages, once: only the run that made package.json (later runs find a site)
    if (made.includes('package.json')) installSite(root);
  }
  warnLegacyConfig(root);
  await photos(root, opts);
  const { createServer } = await import('vite');
  const server = await createServer(
    await viteConfig(root, {
      server: { ...(opts.port && { port: opts.port, strictPort: true }), host: opts.host },
    }),
  );
  await server.listen();
  server.printUrls();
  const url = server.resolvedUrls?.local?.[0];
  if (url)
    console.log(`  Editor:  ${new URL('?edit', url)}  ·  ewcms ${ENGINE_VERSION} (${ENGINE})\n`);
  server.bindCLIShortcuts?.({ print: true });
  return server;
}

export async function build(root, opts = {}) {
  warnLegacyConfig(root);
  await photos(root, opts);
  const { build: viteBuild } = await import('vite');
  await viteBuild(await viteConfig(root));
}

export async function preview(root, opts = {}) {
  const { preview: vitePreview } = await import('vite');
  const server = await vitePreview(
    await viteConfig(root, { preview: { port: opts.port || 4173, strictPort: !!opts.port } }),
  );
  server.printUrls();
}

/**
 * The site's content checked like the build does: a list of problems ([] = fine). `warnings`
 * collects what isn't a problem (a List's leftover config.properties).
 */
export async function checkContentOf(root, { warnings = [] } = {}) {
  const site = loadSiteConfig(root);
  const problems = [];
  // the render module as Node loads it (the registry its checks use) + the site's widgets
  const { registerWidgets } = await import(
    pathToFileURL(enginePath('src/widgets/index.js')).href
  );
  await registerSiteWidgets(root, { register: registerWidgets });
  const { setContentDir, ROOT_FILES } = await import(
    pathToFileURL(enginePath('src/render/files.js')).href
  );
  const { parseContent, checkContent, contentWarnings } = await import(
    pathToFileURL(enginePath('src/render/validate.js')).href
  );
  setContentDir(site.contentRel);
  try {
    assertNoSettingsFolder(root);
  } catch (err) {
    return [err.message];
  }
  // the shared files at the content root (content/site.json, header.json, ...)
  for (const file of ROOT_FILES) {
    const abs = path.join(site.contentRootDir, file);
    if (!fs.existsSync(abs)) continue;
    try {
      const data = parseContent(fs.readFileSync(abs, 'utf8'), file);
      problems.push(...checkContent(file, data).map((p) => `${site.contentRootRel}/${file}: ${p}`));
      warnings.push(...contentWarnings().map((w) => `${site.contentRootRel}/${file}: ${w}`));
    } catch (err) {
      problems.push(err.message);
    }
  }
  for (const file of walkJson(site.contentDir)) {
    try {
      const data = parseContent(fs.readFileSync(path.join(site.contentDir, file), 'utf8'), file);
      problems.push(...checkContent(file, data).map((p) => `${site.contentRel}/${file}: ${p}`));
      warnings.push(...contentWarnings().map((w) => `${site.contentRel}/${file}: ${w}`));
    } catch (err) {
      problems.push(err.message);
    }
  }
  // the site-wide item templates (content/templates/t-*.json)
  for (const name of walkJson(site.templatesDir)) {
    const file = `templates/${name}`;
    try {
      const data = parseContent(fs.readFileSync(path.join(site.templatesDir, name), 'utf8'), file);
      problems.push(...checkContent(file, data).map((p) => `${site.templatesRel}/${name}: ${p}`));
      warnings.push(...contentWarnings().map((w) => `${site.templatesRel}/${name}: ${w}`));
    } catch (err) {
      problems.push(err.message);
    }
  }
  if (problems.length) return problems;
  const render = await import(pathToFileURL(enginePath('src/render/render.js')).href);
  const { checkSources } = await import(pathToFileURL(enginePath('src/render/schemas.js')).href);
  let content;
  try {
    content = loadContent(root);
  } catch (err) {
    return [err.message];
  }
  problems.push(...checkSources(content));
  problems.push(
    ...render
      .bindingChecks(content)
      .filter((p) => p.level === 'error')
      .map((p) => p.message),
  );
  problems.push(...render.motionChecks(content));
  return problems;
}

/** A package the engine can load (ESLint, Stylelint: dev tools), or null when not installed. */
async function optional(name) {
  try {
    const file = createRequire(enginePath('package.json')).resolve(name);
    return await import(pathToFileURL(file).href);
  } catch {
    return null;
  }
}

/** Folders that hold no code of the site's own (content, built or installed files). */
const NOT_CODE = new Set([
  'content',
  'public',
  'dist',
  'node_modules',
  'media',
  '.generated',
  '.git',
  '.wrangler',
  '.cache',
]);

/** A folder's files (relative, posix) whose name matches `re`, skipping NOT_CODE folders. */
function filesIn(root, dir, re, out = []) {
  if (!dir || !fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!NOT_CODE.has(e.name)) filesIn(root, p, re, out);
    } else if (re.test(e.name)) out.push(posixPath(path.relative(root, p)));
  }
  return out;
}

/**
 * The site's own code a missing linter would leave unchecked: { js, scss } (relative paths).
 * js: .js / .mjs outside content, public, dist, node_modules, .generated and the like, and
 * not ewcms.config.mjs (settings) or functions/ (the small server functions ewcms scaffolds):
 * those alone are no reason to warn. scss: the theme's and the site's widgets' (what Stylelint
 * lints). ESLint, when installed, still lints them all.
 */
export function siteCode(root, site = loadSiteConfig(root)) {
  const js = filesIn(root, root, /\.(m?js)$/).filter(
    (f) => f !== 'ewcms.config.mjs' && !f.startsWith('functions/'),
  );
  const dirs = [
    site.themeDir,
    ...(site.config?.widgets || []).map((w) => path.resolve(root, w)),
  ].filter((d) => d && !path.resolve(d).startsWith(ENGINE));
  const scss = [...new Set(dirs.flatMap((d) => filesIn(root, d, /\.scss$/)))];
  return { js, scss };
}

/**
 * The site's own code and styles linted with the engine's rules: problems as text lines. A
 * missing linter warns only when the site has files of its kind (siteCode); else it is skipped
 * quietly.
 */
export async function lintSite(root, log = console) {
  const site = loadSiteConfig(root);
  const out = [];
  const code = siteCode(root, site);
  const eslintPkg = await optional('eslint');
  if (!eslintPkg) {
    if (code.js.length)
      log.warn(
        `[check] ESLint is not installed: the site's JS is not linted (${code.js.length} file${code.js.length === 1 ? '' : 's'})`,
      );
  } else {
    const { default: js } = await optional('@eslint/js');
    const { default: globals } = await optional('globals');
    const eslint = new eslintPkg.ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: [
        { ignores: ['dist/', '.generated/', 'media/', 'node_modules/', 'public/'] },
        js.configs.recommended,
        {
          rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] },
          languageOptions: { globals: globals.node },
        },
        { files: ['functions/**/*.js'], languageOptions: { globals: globals.serviceworker } },
        { files: ['**/widgets/*/client.js'], languageOptions: { globals: globals.browser } },
      ],
      errorOnUnmatchedPattern: false,
    });
    const results = await eslint.lintFiles(['**/*.{js,mjs}']);
    for (const r of results)
      for (const m of r.messages)
        out.push(
          `${posixPath(path.relative(root, r.filePath))}:${m.line}:${m.column} ${m.message} (${m.ruleId})`,
        );
  }
  const stylelint = await optional('stylelint');
  if (!stylelint) {
    if (code.scss.length)
      log.warn(
        `[check] Stylelint is not installed: the theme's SCSS is not linted (${code.scss.length} file${code.scss.length === 1 ? '' : 's'})`,
      );
  } else {
    const { default: config } = await import(
      pathToFileURL(enginePath('stylelint.config.mjs')).href
    );
    const dirs = [site.themeDir, ...site.config.widgets.map((w) => path.resolve(root, w))];
    const files = dirs
      .filter((d) => d && fs.existsSync(d) && !d.startsWith(ENGINE))
      .map((d) => `${posixPath(d)}/**/*.scss`);
    if (files.length) {
      const res = await stylelint.default.lint({
        files,
        config: { ...config, ignoreFiles: [] },
        configBasedir: ENGINE,
      });
      for (const r of res.results)
        for (const w of r.warnings)
          out.push(`${posixPath(path.relative(root, r.source))}:${w.line}:${w.column} ${w.text}`);
    }
  }
  return out;
}

/** The default site's tokens.scss up to its `// @optional` line: the tokens a theme must set. */
export const requiredPart = (scss) => scss.split(/^\s*\/\/ @optional\b/m)[0];

/** The custom properties a stylesheet sets (`--name:`), in order, once each. */
const tokensSet = (scss) => [...new Set(scss.match(/(?<![\w-])--[\w-]+(?=\s*:)/g) || [])];

/**
 * A warning for a site whose theme misses tokens of the look (ewcms default-site/theme/tokens.scss):
 * the engine has no theme of its own, so the chrome and widgets would read them unset. The
 * site's tokens.scss and overrides.scss count. The type scale (--type-*) on its own line: the
 * engine has defaults for it, and what site.json "type" sets counts. '' when none is missing.
 * Not a failure.
 */
export function themeWarning(site) {
  const read = (f) =>
    site.themeDir && fs.existsSync(path.join(site.themeDir, f))
      ? fs.readFileSync(path.join(site.themeDir, f), 'utf8')
      : '';
  const own = new Set([
    ...tokensSet(read('tokens.scss') + read('overrides.scss')),
    ...siteTypeTokens(site),
  ]);
  const defaultSite = fs.readFileSync(path.join(DEFAULT_SITE_THEME, 'tokens.scss'), 'utf8');
  // (the default site's @optional tokens have the engine's defaults: not asked for)
  const missing = tokensSet(requiredPart(defaultSite)).filter((t) => !own.has(t));
  const look = missing.filter((t) => !t.startsWith('--type-'));
  const type = missing.filter((t) => t.startsWith('--type-'));
  const rel =
    posixPath(path.relative(site.root, path.resolve(site.root, site.config.themeDir))) || '.';
  const out = [];
  // a token renamed (no alias: the old name is read nowhere): the new name to set
  const renamed = Object.entries(RENAMED_TOKENS)
    .filter(([old, now]) => own.has(old) && look.includes(now))
    .map(([old, now]) => ` ${old} is now ${now}: rename it.`)
    .join('');
  if (look.length)
    out.push(
      `[check] ${rel}/tokens.scss misses ${look.length} token(s) of the look (${look.join(', ')}): ` +
        `ewcms has no default theme, so its chrome and widgets read them unset.${renamed} Copy them from ` +
        `ewcms default-site/theme/tokens.scss (and fonts.scss, theme.json): see ewcms docs/THEME-MIGRATION.md`,
    );
  // the type scale has the engine's defaults (site-core/_tokens.scss): a site sees it, not unset
  if (type.length)
    out.push(
      `[check] ${rel}/tokens.scss doesn't set ${type.length} token(s) of the type scale ` +
        `(${type.join(', ')}): the engine's defaults apply. Copy them from ewcms ` +
        `default-site/theme/tokens.scss (with those defaults) and set the sizes there, or per site ` +
        `in site.json "type"`,
    );
  return out.join('\n');
}

/** Tokens of the look renamed, old: new (CHANGELOG, Breaking): check names the new one. */
export const RENAMED_TOKENS = { '--f-mono': '--f-body' };

/** The type scale tokens a site's site.json "type" sets (--type-<style>-min, -max, -lh). */
function siteTypeTokens(site) {
  const file = path.join(site.contentRootDir || '', 'site.json');
  let type;
  try {
    type = JSON.parse(fs.readFileSync(file, 'utf8')).type;
  } catch {
    return [];
  }
  const suffix = { min: 'min', max: 'max', line: 'lh' };
  return Object.entries(type && typeof type === 'object' ? type : {}).flatMap(([k, s]) =>
    Object.keys(suffix)
      .filter((key) => s && typeof s === 'object' && s[key] !== undefined)
      .map((key) => `--type-${k}-${suffix[key]}`),
  );
}

export async function check(root, opts = {}) {
  warnLegacyConfig(root);
  let failed = false;
  const report = (what, problems) => {
    if (problems.length) {
      failed = true;
      console.error(`✗ ${what}: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    } else console.log(`✓ ${what}`);
  };
  const warnings = [];
  report('content', await checkContentOf(root, { warnings }));
  for (const w of warnings) console.warn(`! ${w}`);
  const warning = themeWarning(loadSiteConfig(root));
  if (warning) console.warn(warning);
  if (opts.lint !== false) report('lint', await lintSite(root));
  if (opts.links) {
    const { count, pages, broken } = checkLinks(loadSiteConfig(root).outDir);
    report(`links (${count} internal links in ${pages} pages)`, broken);
  }
  return !failed;
}

export async function publishMedia(root) {
  const { loadEnv } = await import('vite');
  const { r2Config, uploadPhoto, NOT_CONFIGURED } = await import('./r2.mjs');
  const { PHOTOS } = await import(pathToFileURL(enginePath('src/render/files.js')).href);
  const env = loadEnv('production', root, 'R2_');
  if (r2Config(env).missing) throw new Error(NOT_CONFIGURED);
  const site = loadSiteConfig(root);
  const photosFile = path.join(site.contentRootDir, PHOTOS);
  const TYPES = {
    jpg: 'jpeg',
    jpeg: 'jpeg',
    png: 'png',
    webp: 'webp',
    avif: 'avif',
    tif: 'tiff',
    tiff: 'tiff',
  };
  const walk = (dir) =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) return walk(p);
          return TYPES[path.extname(e.name).slice(1).toLowerCase()] ? [p] : [];
        })
      : [];
  let sent = 0;
  let failed = 0;
  for (const file of walk(site.mediaDir)) {
    const rel = posixPath(path.relative(root, file));
    const type = `image/${TYPES[path.extname(file).slice(1).toLowerCase()]}`;
    const r = await uploadPhoto(
      env,
      { name: path.basename(file), type, body: fs.readFileSync(file) },
      { photosFile },
    );
    if (r.status !== 200) {
      failed++;
      console.error(`✗ ${rel}: ${r.body.error}`);
    } else {
      if (!r.body.existing) sent++;
      console.log(`${r.body.existing ? '=' : '+'} ${rel} → ${r.body.key}`);
    }
  }
  console.log(
    `[publish-media] ${sent} new photo(s) in R2, ${failed} failed; their sizes: ${posixPath(path.relative(root, photosFile))}`,
  );
  if (failed) throw new Error(`${failed} photo(s) not uploaded`);
}
