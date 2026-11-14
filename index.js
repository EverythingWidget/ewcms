/**
 * ewcms from JavaScript: the commands (what bin/ewcms.mjs runs), the Vite preset and where the
 * engine is. A site normally needs none of it: its package.json scripts call `ewcms`.
 */
export {
  dev,
  build,
  preview,
  check,
  checkContentOf,
  lintSite,
  publishMedia,
  newSite,
} from './src/cli/cli.mjs';
export { buildPhotos } from './src/cli/photos.mjs';
export { checkLinks } from './src/cli/check-links.mjs';
export { loadSiteConfig } from './src/cli/site-config.mjs';
export { siteConfig, staticSite, mocksPlugin } from './vite.js';
export { ENGINE, ENGINE_VERSION, enginePath } from './src/cli/engine.mjs';
