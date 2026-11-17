/**
 * A new site from the engine's starter/ (the same flat layout as a site: ewcms.config.mjs,
 * package.json, gitignore, content/, theme/, public/, functions/, empty media/ and widgets/).
 * `ewcms dev` runs it in a folder with no site files yet (isSiteFolder): the first run makes
 * the site. Only what is missing is copied, nothing is overwritten (a package.json or README
 * already there stays as it is). The editor then asks once for the name, language and look
 * (FirstRunModal.svelte): starter/content/site.json has no name until then.
 */
import fs from 'node:fs';
import path from 'node:path';
import { enginePath, ENGINE_VERSION } from './engine.mjs';
import { CONFIG_FILE, LEGACY_CONFIG_FILE, DEFAULTS } from './site-config.mjs';

export const STARTER = enginePath('starter');

// starter files named otherwise in the site (npm drops a package's .gitignore)
const RENAMED = { gitignore: '.gitignore' };

/** Does root hold a site already (its config, the old config or content/site.json)? */
export function isSiteFolder(root) {
  root = path.resolve(root);
  return [
    CONFIG_FILE,
    LEGACY_CONFIG_FILE,
    path.join(path.dirname(DEFAULTS.contentDir), 'site.json'),
  ].some((f) => fs.existsSync(path.join(root, f)));
}

/** The starter's files, from the starter's root, "/"-separated. */
function starterFiles(dir = STARTER, rel = '', out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) starterFiles(path.join(dir, e.name), r, out);
    else out.push(r);
  }
  return out;
}

/**
 * The starter's files root misses, copied (nothing overwritten): the files made, "/"-separated.
 * A package.json made is named after the folder and pins this engine; theme.json too is named.
 */
export function scaffoldSite(root, { name = path.basename(path.resolve(root)) } = {}) {
  root = path.resolve(root);
  const made = [];
  for (const rel of starterFiles()) {
    const parts = rel.split('/');
    const to = parts.map((p, i) => (i === parts.length - 1 ? RENAMED[p] || p : p)).join('/');
    const dest = path.join(root, to);
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(STARTER, rel), dest, fs.constants.COPYFILE_EXCL);
    made.push(to);
  }
  const edit = (rel, fn) => {
    if (!made.includes(rel)) return;
    const file = path.join(root, rel);
    fs.writeFileSync(
      file,
      `${JSON.stringify(fn(JSON.parse(fs.readFileSync(file, 'utf8'))), null, 2)}\n`,
    );
  };
  edit('package.json', (pkg) => ({
    ...pkg,
    name:
      name
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'site',
    dependencies: {
      ...pkg.dependencies,
      ewcms: `github:EverythingWidget/ewcms#v${ENGINE_VERSION}`,
    },
  }));
  edit('theme/theme.json', (theme) => ({ ...theme, name }));
  return made;
}
