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
import { execFileSync, spawnSync } from 'node:child_process';
import { ENGINE, enginePath, ENGINE_VERSION } from './engine.mjs';
import { CONFIG_FILE, LEGACY_CONFIG_FILE, DEFAULTS } from './site-config.mjs';

export const STARTER = enginePath('starter');

// starter files named otherwise in the site (npm drops a package's .gitignore)
const RENAMED = { gitignore: '.gitignore' };

const SHA = /^[0-9a-f]{40}$/;
const git = (dir, ...args) => {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

/** The commit npm installed `engine` from (a github: dependency): its lockfiles' resolved "#<sha>". */
export function installedCommit(engine = ENGINE) {
  const name = path.basename(engine);
  const nm = path.dirname(engine);
  // node_modules/.package-lock.json (npm 7+), else the project's package-lock.json (npx's too)
  for (const lock of [
    path.join(nm, '.package-lock.json'),
    path.join(nm, '..', 'package-lock.json'),
  ]) {
    try {
      const pkgs = JSON.parse(fs.readFileSync(lock, 'utf8')).packages || {};
      const sha = /#([0-9a-f]{40})$/.exec(pkgs[`node_modules/${name}`]?.resolved || '')?.[1];
      if (sha) return sha;
    } catch {
      // no lockfile there
    }
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(engine, 'package.json'), 'utf8'));
    const sha = /#([0-9a-f]{40})$/.exec(pkg._resolved || '')?.[1] || pkg.gitHead;
    if (SHA.test(sha || '')) return sha;
  } catch {
    // no package.json
  }
  return '';
}

/**
 * The ref a new site pins (github:EverythingWidget/ewcms#<ref>): the engine that runs. A git
 * checkout: its release tag when HEAD is exactly v<version>, else HEAD's commit; an npm
 * install: the commit it came from (installedCommit); else the version's tag (exact: false).
 */
export function enginePin(engine = ENGINE, version = ENGINE_VERSION) {
  const tag = `v${version}`;
  if (git(engine, 'rev-parse', '--show-toplevel') === engine) {
    const tags = git(engine, 'tag', '--points-at', 'HEAD').split('\n');
    if (tags.includes(tag)) return { ref: tag, exact: true };
    const head = git(engine, 'rev-parse', 'HEAD');
    if (SHA.test(head)) return { ref: head, exact: true };
  }
  const sha = installedCommit(engine);
  if (sha) return { ref: sha, exact: true };
  return { ref: tag, exact: false };
}

/** npm install in root, its output shown: true when it worked (EWCMS_NO_INSTALL=1: skipped). */
export function installSite(root) {
  if (process.env.EWCMS_NO_INSTALL) return true;
  console.log(`npm install in ${root} (once, for the new site)…`);
  const r = spawnSync('npm install', {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status === 0) return true;
  console.error(
    `npm install failed: the editor runs now, but npm run dev needs it. Run it yourself: cd "${root}" && npm install`,
  );
  return false;
}

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
 * A package.json made is named after the folder and pins this engine (enginePin: the code that
 * runs, not an older release); theme.json too is named.
 */
export function scaffoldSite(
  root,
  { name = path.basename(path.resolve(root)), pin = enginePin() } = {},
) {
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
      ewcms: `github:EverythingWidget/ewcms#${pin.ref}`,
    },
  }));
  edit('theme/theme.json', (theme) => ({ ...theme, name }));
  return made;
}
