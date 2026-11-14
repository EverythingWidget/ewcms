/**
 * Which ewcms runs a site's commands. A site depends on a tagged ewcms from GitHub; in a
 * workspace (ewcms-dev/: "workspaces": ["ewcms", "sites/*"]) npm may still install that copy in
 * the site's node_modules next to the workspace's link (npm 10, a git dependency). So the
 * command itself prefers, in order:
 *
 *   1. EWCMS_ENGINE (a folder with ewcms's package.json)
 *   2. the workspace's ewcms: the nearest folder above the site whose package.json has
 *      "workspaces" naming a folder whose package.json is "name": "ewcms"
 *   3. itself (node_modules/ewcms: the tag the site pins, what Cloudflare runs)
 *
 * No npm link, no per-site overrides. Kept small and dependency-free: bin/ewcms.mjs loads it
 * before anything else. Plain Node: the same on Windows and Linux.
 */
import fs from 'node:fs';
import path from 'node:path';

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const isEngine = (dir) => readJson(path.join(dir, 'package.json'))?.name === 'ewcms';

/** The folders a package.json "workspaces" names (plain folders and "dir/*" patterns). */
export function workspaceDirs(root) {
  const pkg = readJson(path.join(root, 'package.json'));
  const list = Array.isArray(pkg?.workspaces) ? pkg.workspaces : pkg?.workspaces?.packages;
  if (!Array.isArray(list)) return null;
  const dirs = [];
  for (const pattern of list) {
    const parts = String(pattern)
      .split(/[\\/]+/)
      .filter(Boolean);
    if (parts.at(-1) === '*') {
      const base = path.join(root, ...parts.slice(0, -1));
      if (!fs.existsSync(base)) continue;
      for (const e of fs.readdirSync(base, { withFileTypes: true }))
        if (e.isDirectory() || e.isSymbolicLink()) dirs.push(path.join(base, e.name));
    } else if (!parts.some((p) => p.includes('*'))) dirs.push(path.join(root, ...parts));
  }
  return dirs;
}

/** The workspace's ewcms folder for a site at `site` (its real path), or null. */
export function workspaceEngine(site) {
  for (let dir = path.resolve(site); ;) {
    const dirs = workspaceDirs(dir);
    if (dirs) {
      const engine = dirs.find(isEngine);
      if (engine) return fs.realpathSync(engine);
    }
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** The engine folder a site's commands should run: EWCMS_ENGINE, the workspace's, or null. */
export function preferredEngine(site, env = process.env) {
  if (env.EWCMS_ENGINE) {
    const dir = path.resolve(env.EWCMS_ENGINE);
    if (!isEngine(dir)) throw new Error(`EWCMS_ENGINE=${env.EWCMS_ENGINE}: no ewcms package there`);
    return fs.realpathSync(dir);
  }
  return workspaceEngine(site);
}
