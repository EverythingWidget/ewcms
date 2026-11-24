/**
 * The site folder's git: status (every changed file, branch and push state) and publish
 * (commit + rebase + push). The local data layer (local-data-layer.mjs) calls these; the
 * editor never talks to git itself.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { repoEnv } from './git-env.mjs';
import { loadSiteConfig, repoUrl } from '../../cli/site-config.mjs';
import { countEdits } from '../lib/edit-count.js';
import { isContentFile } from '../../render/files.js';
import { contentFilePath } from '../../cli/content.mjs';

const contentRel = (root) => loadSiteConfig(root).contentRel;
const diskRel = (root, file) =>
  path.relative(root, contentFilePath(root, file)).split(path.sep).join('/');

// ---------------------------------------------------------------- status and publish

/**
 * Run git without a shell, on the repo at `root` only (repoEnv: a GIT_DIR or GIT_INDEX_FILE a
 * hook exported can't send it to another repo). Never prompts in the terminal (a missing login
 * fails fast).
 */
function git(root, args, { timeout = 30_000 } = {}) {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd: root,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        env: repoEnv(process.env, { GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }),
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: String(stdout),
          stderr: String(stderr),
          output: `${stdout}${stderr}`.trim() || (err ? err.message : ''),
          timedOut: !!err?.killed,
        });
      },
    );
  });
}

const parseJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** The order of the groups in status (and the Publish window). */
export const GROUPS = ['content', 'sources', 'templates', 'theme', 'media', 'other'];

/** Over this, GitHub rejects or warns about a file (100 MB hard limit): Publish refuses it. */
export const MAX_FILE_BYTES = 95 * 1024 * 1024;

/** Names that look like secrets: never committed, even if the site's .gitignore misses them. */
const SECRET = /^(\.env|\.env\..*|\.dev\.vars|.*\.pem|.*\.key|id_rsa.*|.*\.p12)$/i;

/** Why `file` ({ path, size }) must not be published, or ''. */
export function blockedReason(file) {
  const base = file.path.split('/').pop();
  if (SECRET.test(base) && base.toLowerCase() !== '.env.example')
    return 'looks like a secret (keys, passwords): add it to .gitignore or remove it';
  if (file.size > MAX_FILE_BYTES)
    return `is ${(file.size / 1024 / 1024).toFixed(1)} MB, over the 95 MB limit (GitHub refuses 100 MB): add it to .gitignore or make it smaller`;
  return '';
}

/** The group of a changed site file: its content file name, else where it is. */
function groupOf(root, p, name) {
  if (name)
    return name.startsWith('templates/')
      ? 'templates'
      : name.startsWith('sources/')
        ? 'sources'
        : 'content';
  const { themeDir, mediaDir } = loadSiteConfig(root);
  const under = (dir) => {
    if (!dir) return false;
    const rel = path.relative(root, dir).split(path.sep).join('/');
    return !!rel && !rel.startsWith('..') && (p === rel || p.startsWith(`${rel}/`));
  };
  return under(themeDir) ? 'theme' : under(mediaDir) ? 'media' : 'other';
}

/** Whether a file looks binary (a NUL byte in its first 8000 bytes, as git checks). */
function isBinary(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(8000);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.subarray(0, n).includes(0);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Every changed file in the site folder that differs from HEAD (new, modified, deleted;
 * ignored files never show), plus branch and push state. Content files get their editor name
 * and the number of edits; the others +/- lines, or bytes when binary. blocked: the changed
 * files Publish refuses (blockedReason).
 */
export async function status(root) {
  const inside = await git(root, ['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok)
    return { git: false, error: 'Not a git repository', files: [], blocked: [], ahead: 0 };
  const [branchR, prefixR, remoteR] = await Promise.all([
    git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(root, ['rev-parse', '--show-prefix']),
    git(root, ['remote', 'get-url', 'origin']),
  ]);
  const branch = branchR.stdout.trim();
  const prefix = prefixR.stdout.trim();

  // `.`: the site folder only, even inside a bigger repo
  const st = await git(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--',
    '.',
  ]);
  const files = [];
  const entries = st.stdout.split('\0').filter(Boolean);
  const { templatesRel: tRel, contentRootRel: rRel } = loadSiteConfig(root);
  const add = (repoPath, status) => {
    const p = repoPath.startsWith(prefix) ? repoPath.slice(prefix.length) : repoPath;
    const name = p.startsWith(`${tRel}/`)
      ? `templates/${p.slice(tRel.length + 1)}`
      : p.startsWith(`${contentRel(root)}/`)
        ? p.slice(contentRel(root).length + 1)
        : rRel === '.'
          ? p
          : p.slice(rRel.length + 1);
    const content = isContentFile(name) && p === diskRel(root, name);
    files.push({
      ...(content && { name }),
      path: p,
      group: groupOf(root, p, content && name),
      status,
    });
  };
  for (let i = 0; i < entries.length; i++) {
    const code = entries[i].slice(0, 2);
    const status =
      code === '??' || code[0] === 'R' || code[0] === 'C'
        ? 'new'
        : code.includes('D')
          ? 'deleted'
          : code.includes('A')
            ? 'new'
            : 'modified';
    add(entries[i].slice(3), status);
    // A rename or copy is followed by its source path: a rename (git mv) deletes it.
    if (code[0] === 'R' || code[0] === 'C') {
      i++;
      if (code[0] === 'R') add(entries[i], 'deleted');
    }
  }
  await Promise.all(
    files.map(async (f) => {
      const abs = path.join(root, f.path);
      const size = fs.existsSync(abs) ? fs.statSync(abs).size : 0;
      if (size > MAX_FILE_BYTES) return (f.bytes = size); // not read: too big (blocked)
      const binary = size > 0 && isBinary(abs);
      const [numstat, head] = await Promise.all([
        git(root, ['diff', '--numstat', 'HEAD', '--', `:(literal)${f.path}`]),
        f.name ? git(root, ['show', `HEAD:${prefix}${f.path}`]) : null,
      ]);
      const [added, removed] = numstat.stdout.trim().split(/\s+/);
      if (binary || added === '-') {
        f.bytes = size;
        return;
      }
      f.added =
        Number(added) ||
        (f.status === 'new' && size ? fs.readFileSync(abs, 'utf8').split('\n').length - 1 : 0);
      f.removed = Number(removed) || 0;
      if (!f.name) return;
      const disk = fs.existsSync(abs) ? parseJSON(fs.readFileSync(abs, 'utf8')) : undefined;
      const before = head.ok ? parseJSON(head.stdout) : undefined;
      f.changes = before === undefined || disk === undefined ? 1 : countEdits(before, disk, f.name);
    }),
  );
  const order = (f) => GROUPS.indexOf(f.group);
  files.sort((a, b) => order(a) - order(b) || (a.name || a.path).localeCompare(b.name || b.path));
  const blocked = files
    .filter((f) => f.status !== 'deleted')
    .map((f) => ({
      path: f.path,
      reason: blockedReason({ path: f.path, size: f.bytes ?? 0 }),
    }))
    .filter((b) => b.reason);

  // Commits on this branch that origin doesn't have yet (e.g. a publish whose push failed).
  let upstream = (
    await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  ).stdout.trim();
  if (
    !upstream &&
    branch !== 'HEAD' &&
    (await git(root, ['rev-parse', '--verify', '-q', `refs/remotes/origin/${branch}`])).ok
  )
    upstream = `origin/${branch}`;
  const ahead = upstream
    ? Number((await git(root, ['rev-list', '--count', `${upstream}..HEAD`])).stdout.trim()) || 0
    : 0;
  const unpushed = ahead
    ? (await git(root, ['log', '--format=%h%x09%s', '-n', '20', `${upstream}..HEAD`])).stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => ({
          hash: line.split('\t')[0],
          subject: line.split('\t').slice(1).join('\t'),
        }))
    : [];

  return {
    git: true,
    branch,
    detached: branch === 'HEAD',
    upstream: upstream || null,
    ahead,
    unpushed,
    remote: remoteR.ok ? remoteR.stdout.trim() : null,
    repoUrl: repoUrl(remoteR.stdout.trim(), loadSiteConfig(root).config),
    files,
    blocked,
  };
}

/** Readable hint for common push failures. */
function pushHint(output) {
  if (
    /could not read Username|Authentication failed|terminal prompts disabled|Permission denied|403|invalid credentials|could not read Password/i.test(
      output,
    )
  ) {
    return "Git on this machine has no working GitHub login. In this repo's terminal run `gh auth login` (HTTPS) and `gh auth setup-git`, then click Publish again to push. Your commit is kept locally.";
  }
  if (/non-fast-forward|fetch first|rejected/i.test(output)) {
    return "GitHub has commits you don't have yet. Run `git pull --rebase` in the terminal, then click Publish again to push.";
  }
  if (/Could not resolve host|unable to access|timed out/i.test(output))
    return 'Could not reach GitHub. Check the connection and try again.';
  return '';
}

const split0 = (out) => out.split('\0').filter(Boolean);

/** Why Publish can't start in this repo state (detached, mid-rebase/merge), or ''. */
async function repoStateProblem(root, s) {
  if (s.detached) return 'HEAD is detached: check out a branch before publishing.';
  for (const p of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD']) {
    const r = await git(root, ['rev-parse', '--git-path', p]);
    if (r.ok && fs.existsSync(path.resolve(root, r.stdout.trim())))
      return 'A rebase, merge or cherry-pick is in progress: finish or abort it in the terminal first.';
  }
  return '';
}

/** The commit author git will use: from the environment or git config. Publish never sets one. */
async function hasIdentity(root) {
  const env = process.env;
  const config = async (key) => (await git(root, ['config', key])).stdout.trim();
  const name = env.GIT_AUTHOR_NAME || (await config('user.name'));
  const email = env.GIT_AUTHOR_EMAIL || (await config('user.email'));
  return !!(name && email);
}

const IDENTITY_HINT =
  'In this repo\'s terminal run `git config user.name "Your Name"` and `git config user.email "you@example.com"`, then click Publish again.';

/**
 * Commit every changed file in the site folder in one commit, bring in origin's new commits
 * (fetch + rebase, aborted on a conflict) and push the branch. Refuses (nothing staged) when a
 * changed file is blocked, the repo is mid-rebase or detached, or there is no identity. A failed
 * commit unstages only what Publish staged; after the commit, a failure keeps it (a later
 * Publish pushes it). Never forces, skips hooks, stashes, resets or cleans.
 */
export async function publish(root, message) {
  const s = await status(root);
  if (!s.git) return { status: 400, body: { error: s.error } };
  const problem = await repoStateProblem(root, s);
  if (problem) return { status: 409, body: { error: problem } };
  if (s.blocked.length)
    return {
      status: 409,
      body: {
        error: `Not published: ${s.blocked.map((b) => `${b.path} ${b.reason}`).join('; ')}.`,
        blocked: s.blocked,
      },
    };
  if (!s.files.length && !s.ahead)
    return {
      status: 400,
      body: { error: 'Nothing to publish: no saved changes and no unpushed commits.' },
    };

  let committed = false;
  const steps = [];
  const files = s.files.map((f) => f.path);
  const run = async (args, opts) => {
    const r = await git(root, args, opts);
    steps.push({
      cmd: `git ${args.map((a) => (a === message ? '<message>' : a)).join(' ')}`,
      ...r,
    });
    return r;
  };
  if (s.files.length) {
    const msg = String(message || '').trim();
    if (!msg) return { status: 400, body: { error: 'A commit message is required.' } };
    if (msg.length > 5000) return { status: 400, body: { error: 'Commit message is too long.' } };
    if (!(await hasIdentity(root)))
      return {
        status: 400,
        body: {
          error: 'Git has no name and email for the commit on this machine.',
          hint: IDENTITY_HINT,
        },
      };
    message = msg;
    // what was staged before: a failed commit unstages only what Publish added
    const before = new Set(
      split0((await git(root, ['diff', '--cached', '--name-only', '-z', '--', '.'])).stdout),
    );
    const unstage = async () => {
      const staged = split0(
        (await git(root, ['diff', '--cached', '--name-only', '-z', '--', '.'])).stdout,
      );
      const ours = staged.filter((p) => !before.has(p));
      if (ours.length)
        await git(root, ['reset', '-q', '--', ...ours.map((p) => `:(top,literal)${p}`)]);
    };
    // the site folder only, following .gitignore (never -f)
    const add = await run(['add', '-A', '--', '.']);
    if (!add.ok) {
      await unstage();
      return { status: 500, body: { error: 'git add failed', output: add.output, steps } };
    }
    // `-- .`: only the site folder is committed, even if something outside it is staged
    const commit = await run(['commit', '-m', msg, '--', '.']);
    if (!commit.ok) {
      await unstage();
      return { status: 500, body: { error: 'git commit failed', output: commit.output, steps } };
    }
    committed = true;
  }

  const head = async () => (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
  const kept = async (status, body) => {
    const hash = await head();
    return {
      status,
      body: {
        ...body,
        committed,
        // a commit is on this machine, not on origin yet: Publish again pushes it
        kept: true,
        hash,
        short: hash.slice(0, 7),
        url: `${s.repoUrl}/commit/${hash}`,
        branch: s.branch,
        files,
        steps,
      },
    };
  };

  // Bring in origin's new commits first: only this machine's unpushed commits are replayed.
  let pulled = false;
  if (s.upstream) {
    const fetch = await run(['fetch', 'origin', s.branch], { timeout: 60_000 });
    if (!fetch.ok)
      return kept(502, {
        error: fetch.timedOut ? 'git fetch timed out' : 'git fetch failed',
        output: fetch.output,
        hint: pushHint(fetch.output),
      });
    const behind =
      Number(
        (await git(root, ['rev-list', '--count', `HEAD..origin/${s.branch}`])).stdout.trim(),
      ) || 0;
    if (behind) {
      const dirty = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=no']);
      if (split0(dirty.stdout).length)
        return kept(409, {
          error: `Files changed in the repo while publishing, so GitHub's ${behind} new ${behind === 1 ? 'commit' : 'commits'} could not be brought in.`,
          hint: 'Your commit is kept on this machine. Run `git pull --rebase` in the terminal, then click Publish again.',
          output: dirty.stdout.replace(/\0/g, '\n').trim(),
        });
      const rebase = await run(['rebase', `origin/${s.branch}`], { timeout: 60_000 });
      if (!rebase.ok) {
        const conflicts = split0(
          (await git(root, ['diff', '--name-only', '--diff-filter=U', '-z'])).stdout,
        );
        await run(['rebase', '--abort']);
        return kept(409, {
          error: `GitHub has changes to the same files: ${conflicts.join(', ') || 'see the output'}.`,
          hint: 'Your commit is kept on this machine: resolve it in the terminal (git pull --rebase) or ask the developer.',
          conflicts,
          output: rebase.output,
        });
      }
      pulled = true;
    }
  }

  // a branch with no upstream yet: -u sets origin/<the same branch>
  const tracked = (await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']))
    .ok;
  const push = await run(['push', ...(tracked ? [] : ['-u']), 'origin', s.branch], {
    timeout: 120_000,
  });
  if (!push.ok)
    return kept(502, {
      error: push.timedOut ? 'git push timed out' : 'git push failed',
      output: push.output,
      hint: pushHint(push.output),
      pulled,
    });
  const hash = await head();
  return {
    status: 200,
    body: {
      ok: true,
      committed,
      pulled,
      pushed: true,
      hash,
      short: hash.slice(0, 7),
      url: `${s.repoUrl}/commit/${hash}`,
      branch: s.branch,
      files,
      output: push.output,
    },
  };
}
