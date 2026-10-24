/**
 * The ewcms command (bin/ewcms.mjs), one function per command; each takes the site's root.
 * Plain Node and Vite's JavaScript API: no shell, the same in PowerShell, cmd, WSL and macOS.
 *
 *   dev            images, then the dev server (pages, the editor at ?edit, /sandbox/)
 *   build          images, then the static build (outDir, dist/)
 *   preview        serve the build
 *   check          content (every file, sources, bindings, motion), then lint (the theme's SCSS,
 *                  the site's own JS) when ESLint / Stylelint are installed; --links: the build's links
 *   images         media/ → public/media sizes + .generated/media.json
 *   publish-media  upload media/ photos to Cloudflare R2 (.env.local R2_* keys), like the editor
 *   new-site <dir> a new site: theme-default, starter content, package.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ENGINE, enginePath, posixPath, ENGINE_VERSION } from './engine.mjs';
import { loadSiteConfig, CONFIG_FILE } from './site-config.mjs';
import { buildImages } from './images.mjs';
import { checkLinks } from './check-links.mjs';
import { registerSiteWidgets } from './site-widgets.mjs';
import { walkJson, loadContent } from './content.mjs';

const VITE_CONFIGS = ['vite.config.js', 'vite.config.mjs', 'vite.config.ts'];

/** Vite's inline config for the site: its own vite.config.* if it has one, else the preset. */
async function viteConfig(root, extra = {}) {
  const own = VITE_CONFIGS.map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
  if (own) return { configFile: own, root, ...extra };
  const { siteConfig } = await import('../vite.js');
  return { configFile: false, ...siteConfig({ root }), ...extra };
}

const images = async (root, opts) => {
  if (opts.images === false) return;
  await buildImages(root);
};

export async function dev(root, opts = {}) {
  await images(root, opts);
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
  await images(root, opts);
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

/** The site's content checked like the build does: a list of problems ([] = fine). */
export async function checkContentOf(root) {
  const site = loadSiteConfig(root);
  const problems = [];
  // the render module as Node loads it (the registry its checks use) + the site's widgets
  const { registerWidgets } = await import(
    pathToFileURL(enginePath('src/site/widgets/index.js')).href
  );
  await registerSiteWidgets(root, { register: registerWidgets });
  const { setContentDir } = await import(pathToFileURL(enginePath('src/site/files.js')).href);
  const { parseContent, checkContent } = await import(
    pathToFileURL(enginePath('src/site/validate.js')).href
  );
  setContentDir(site.contentRel);
  for (const file of walkJson(site.contentDir)) {
    try {
      const data = parseContent(fs.readFileSync(path.join(site.contentDir, file), 'utf8'), file);
      problems.push(...checkContent(file, data).map((p) => `${site.contentRel}/${file}: ${p}`));
    } catch (err) {
      problems.push(err.message);
    }
  }
  if (problems.length) return problems;
  const render = await import(pathToFileURL(enginePath('src/site/render.js')).href);
  const { checkSources } = await import(pathToFileURL(enginePath('src/site/schemas.js')).href);
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

/** The site's own code and styles linted with the engine's rules: problems as text lines. */
export async function lintSite(root, log = console) {
  const site = loadSiteConfig(root);
  const out = [];
  const eslintPkg = await optional('eslint');
  if (!eslintPkg) log.warn("[check] ESLint is not installed: the site's JS is not linted");
  else {
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
  if (!stylelint) log.warn("[check] Stylelint is not installed: the theme's SCSS is not linted");
  else {
    const { default: config } = await import(
      pathToFileURL(enginePath('stylelint.config.mjs')).href
    );
    const dirs = [
      site.themeDir,
      site.themeLayerDir,
      ...site.config.widgets.map((w) => path.resolve(root, w)),
    ];
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

export async function check(root, opts = {}) {
  let failed = false;
  const report = (what, problems) => {
    if (problems.length) {
      failed = true;
      console.error(`✗ ${what}: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
    } else console.log(`✓ ${what}`);
  };
  report('content', await checkContentOf(root));
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
  const { PHOTOS } = await import(pathToFileURL(enginePath('src/site/files.js')).href);
  const env = loadEnv('production', root, 'R2_');
  if (r2Config(env).missing) throw new Error(NOT_CONFIGURED);
  const site = loadSiteConfig(root);
  const photosFile = path.join(site.contentDir, PHOTOS);
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

/** A new site in `dir`: the engine's theme, a starter content (the test fixture), package.json. */
export function newSite(dir, { name = path.basename(path.resolve(dir)) } = {}) {
  dir = path.resolve(dir);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`${dir} is not empty`);
  const copy = (from, to) => fs.cpSync(from, path.join(dir, to), { recursive: true });
  const starter = enginePath('templates', 'site');
  copy(starter, '.');
  copy(enginePath('theme-default'), 'theme');
  copy(enginePath('test', 'fixtures', 'site-a', 'content'), 'content');
  fs.renameSync(path.join(dir, 'gitignore'), path.join(dir, '.gitignore'));
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  pkg.name = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  pkg.dependencies.ewcms = `github:EverythingWidget/ewcms#v${ENGINE_VERSION}`;
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
  console.log(`New site in ${dir} (${CONFIG_FILE}, content/, theme/, public/).
Next: add it to the workspace (or cd into it), npm install, npx ewcms dev`);
}
