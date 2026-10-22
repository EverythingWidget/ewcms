/**
 * npm install (postinstall) turns on this repo's git hooks (.githooks/pre-push: lint + tests).
 * Only in a git checkout of the package itself: installed as a dependency (a site's
 * node_modules/ewcms, Cloudflare's build) there is no .git here and it does nothing.
 * Plain Node, so the same in PowerShell, cmd and WSL. Never fails the install.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
if (fs.existsSync(path.join(dir, '.git')) && fs.existsSync(path.join(dir, '.githooks'))) {
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: dir, stdio: 'ignore' });
  } catch {
    // no git on PATH: hooks stay off
  }
}
