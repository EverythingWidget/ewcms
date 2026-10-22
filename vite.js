/**
 * The Vite preset for an ewcms site (import from 'ewcms/vite'): the whole dev server and build
 * config, from the site's root. `ewcms dev` / `ewcms build` use it as is; a site that needs more
 * keeps a vite.config.js of its own:
 *
 *   import { siteConfig } from 'ewcms/vite';
 *   export default siteConfig({ root: import.meta.dirname }); // then Vite's mergeConfig for more
 *
 * The public site is built from index.html (the site's own, or the engine's template); the
 * editor (src/editor/index.html) and the mock sandbox (sandbox/) are dev only, served from the
 * engine's folder.
 */
import path from 'node:path';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import staticSite from './scripts/vite-plugin-static-site.mjs';
import { mocksPlugin } from './scripts/mock-api.mjs';
import { loadSiteConfig } from './scripts/site-config.mjs';
import { ENGINE, posixPath } from './scripts/engine.mjs';

export { staticSite, mocksPlugin };

/** Vite's config for the site at `root` (default: the working folder). */
export function siteConfig({ root = process.cwd() } = {}) {
  root = path.resolve(root);
  // the site's folders (site.config.mjs): public files and the build
  const site = loadSiteConfig(root);
  const engine = posixPath(ENGINE);
  return {
    root,
    // the site's .env.local (R2_* keys for the editor's uploads)
    envDir: root,
    plugins: [
      // the mock sandbox's list and deletes (dev only: scripts/mock-api.mjs), before the site's pages
      mocksPlugin(),
      staticSite(),
      // Svelte is editor-only (src/editor/svelte, and the editor's mock sandbox: sandbox/). The public site never imports it.
      // vitePreprocess: components can use <style lang="scss">. Runes mode everywhere (also for a
      // component that uses none); scripts/svelte.test.mjs compiles with the same options.
      svelte({
        include: [`${engine}/src/editor/**/*.svelte`, `${engine}/sandbox/**/*.svelte`],
        preprocess: vitePreprocess(),
        compilerOptions: { runes: true },
        // the engine's svelte.config.js, if any, not the site's working folder's
        configFile: false,
      }),
    ],
    publicDir: site.publicDir,
    css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
    build: {
      outDir: site.outDir,
      emptyOutDir: true,
      target: 'es2020',
      assetsInlineLimit: 0,
      modulePreload: { polyfill: false },
      // Only the public site is built: index.html (the site's, else the engine's template:
      // scripts/vite-plugin-static-site.mjs). The visual editor and the mock sandbox are dev only.
      rolldownOptions: {
        input: { main: path.join(root, 'index.html') },
      },
    },
    preview: { port: 4173 },
  };
}

export default siteConfig;
