/**
 * The editor's update notice (dev only): is there a newer ewcms than the site's package.json
 * names, and the update itself. GET /__editor/update: { current, latest, available, changes,
 * boot } (the newest vX.Y.Z tag of the engine's GitHub repo; changes: the commits between,
 * newest first, { ref, text }). POST /__editor/update { to }: package.json's ewcms tag set to
 * it, `npm install`, then the dev server restarted (the same command again, so the new engine's
 * code runs); GET /__editor/update/status follows it: { state: idle | installing | restarting
 * | error, log, from, to }. A failed install puts package.json and the lockfile back.
 * EWCMS_UPDATE_INSTALL: the install command (tests). Restart: EWCMS_UPDATE_NO_RESTART skips it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ENGINE_VERSION } from './engine.mjs';

/** This process's id: a restarted dev server answers with another (the editor's "done"). */
export const BOOT = `${process.pid}-${Date.now()}`;
const CHECK_TTL = 10 * 60 * 1000;
const TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/** "1.2.3" or "v1.2.3" as [1, 2, 3], else null. */
export const parseVersion = (v) => {
  const m = TAG.exec(`v${String(v ?? '').replace(/^v/, '')}`);
  return m ? m.slice(1).map(Number) : null;
};
/** a > b, versions as parseVersion's. */
export const newer = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};
/** The newest vX.Y.Z of tag names, else ''. */
export function newestTag(names) {
  let best = null;
  for (const n of names) {
    const v = parseVersion(n);
    if (v && TAG.test(n) && (!best || newer(v, best.v))) best = { n, v };
  }
  return best?.n || '';
}

/**
 * The site's ewcms dependency: { spec, owner, repo, tag } for "github:owner/repo#vX.Y.Z" (also
 * git+https / git+ssh URLs of GitHub), else null (a linked or local engine: nothing to update).
 */
export function engineDep(pkg) {
  const spec = pkg?.dependencies?.ewcms || pkg?.devDependencies?.ewcms || '';
  const m =
    /^(?:github:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?#(v\d+\.\d+\.\d+)$/.exec(spec) ||
    /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?#(v\d+\.\d+\.\d+)$/.exec(spec);
  return m ? { spec, owner: m[1], repo: m[2], tag: m[3] } : null;
}

/** A commit message as a changelog line: "v0.1.36: Photo fit; …" → { ref: v0.1.36, text }. */
export function changeLine(sha, message) {
  const subject = String(message || '').split('\n')[0];
  const m = /^(v\d+\.\d+\.\d+):\s*(.*)$/.exec(subject);
  const text = (m ? m[2] : subject).split(/;\s/)[0].trim();
  return {
    ref: m ? m[1] : String(sha).slice(0, 7),
    text: text.length > 60 ? `${text.slice(0, 59)}…` : text,
  };
}

async function gh(url) {
  const res = await fetch(`https://api.github.com${url}`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'ewcms' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${url}`);
  return res.json();
}

const readPkg = (root) => JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

export function createUpdater({ root, server, logger = console, fetchJSON = gh }) {
  let checked = null; // { at, body }
  let job = { state: 'idle', log: '', from: '', to: '' };

  async function check(force) {
    const dep = engineDep(readPkg(root));
    const fresh = checked && checked.tag === dep?.tag && Date.now() - checked.at < CHECK_TTL;
    if (!force && fresh) return { ...checked.body, boot: BOOT };
    const body = {
      current: dep?.tag || `v${ENGINE_VERSION}`,
      latest: '',
      available: false,
      changes: [],
    };
    if (dep) {
      const tags = await fetchJSON(`/repos/${dep.owner}/${dep.repo}/tags?per_page=100`);
      body.latest = newestTag(tags.map((t) => t.name));
      const cur = parseVersion(dep.tag);
      const lat = parseVersion(body.latest);
      body.available = !!(cur && lat && newer(lat, cur));
      if (body.available) {
        try {
          const cmp = await fetchJSON(
            `/repos/${dep.owner}/${dep.repo}/compare/${dep.tag}...${body.latest}`,
          );
          body.changes = (cmp.commits || [])
            .map((c) => changeLine(c.sha, c.commit?.message))
            .reverse()
            .slice(0, 6);
        } catch {
          // the versions alone
        }
      }
    }
    checked = { at: Date.now(), tag: dep?.tag, body };
    return { ...body, boot: BOOT };
  }

  function run(cmd, onLine) {
    return new Promise((resolve) => {
      const child = spawn(cmd, { cwd: root, shell: true, env: process.env });
      let out = '';
      const take = (d) => {
        out += d;
        const lines = out.trim().split('\n');
        onLine(lines.slice(-3).join('\n'));
      };
      child.stdout.on('data', take);
      child.stderr.on('data', take);
      child.on('close', (code) => resolve({ code, out }));
      child.on('error', (err) => resolve({ code: 1, out: err.message }));
    });
  }

  async function start(to) {
    if (job.state === 'installing' || job.state === 'restarting') return job;
    const file = path.join(root, 'package.json');
    const lock = path.join(root, 'package-lock.json');
    const pkgText = fs.readFileSync(file, 'utf8');
    const lockText = fs.existsSync(lock) ? fs.readFileSync(lock, 'utf8') : null;
    const dep = engineDep(JSON.parse(pkgText));
    if (!dep || !TAG.test(String(to))) {
      job = {
        state: 'error',
        log: `can't update: ewcms is not a GitHub tag in package.json`,
        from: dep?.tag || '',
        to,
      };
      return job;
    }
    const cmd = process.env.EWCMS_UPDATE_INSTALL || 'npm install';
    job = { state: 'installing', log: `${cmd} (ewcms ${to})`, from: dep.tag, to, at: Date.now() };
    const next = JSON.parse(pkgText);
    const key = next.dependencies?.ewcms ? 'dependencies' : 'devDependencies';
    next[key].ewcms = dep.spec.replace(/#v\d+\.\d+\.\d+$/, `#${to}`);
    fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    logger.info(`ewcms update: ${dep.tag} → ${to}: ${cmd}`);
    run(cmd, (log) => (job.log = log)).then(({ code, out }) => {
      if (code !== 0) {
        fs.writeFileSync(file, pkgText);
        if (lockText !== null) fs.writeFileSync(lock, lockText);
        job = { ...job, state: 'error', log: out.trim().split('\n').slice(-4).join('\n') };
        logger.warn(`ewcms update failed:\n${out}`);
        return;
      }
      job = { ...job, state: 'restarting', log: 'restarting the dev server…' };
      checked = null;
      if (!process.env.EWCMS_UPDATE_NO_RESTART) setTimeout(restart, 600);
    });
    return job;
  }

  // the same command again (the new engine's code), once this one let go of its port
  async function restart() {
    logger.info('ewcms update: restarting the dev server');
    try {
      await server?.close();
    } catch {
      // closing anyway
    }
    const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('spawn', () => process.exit(0));
  }

  return {
    check,
    start,
    status: () => ({ ...job, boot: BOOT }),
  };
}
