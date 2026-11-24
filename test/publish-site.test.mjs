/**
 * The local data layer's git side on temp repos with a bare "origin": status lists every
 * changed file in the site folder, and Publish commits and pushes them safely
 * (src/editor/server/site-git.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { useTestEnv } from '../scripts/test-layout.mjs';
import { Readable } from 'node:stream';
import { MAX_FILE_BYTES, publish, status } from '../src/editor/server/local-data-layer.mjs';
import { editorMiddleware } from '../src/editor/server/editor-server.mjs';

// Only the temp repos: GIT_DIR & co. from a hook are dropped, and the identity is the test one.
useTestEnv();

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const real = (p) => fs.realpathSync(p);
const write = (root, file, text = '{}\n') => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};

/**
 * A site (in `sub` of the repo when given) with a page, a theme file, a photo and a
 * .gitignore, committed and pushed to a bare origin. Answers { repo, root, origin }.
 */
function siteRepo({ sub = '' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-site-'));
  const origin = path.join(dir, 'origin.git');
  const repo = path.join(dir, 'repo');
  const root = path.join(repo, sub);
  git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  git(dir, 'init', '-q', '-b', 'main', repo);
  assert.equal(real(git(repo, 'rev-parse', '--show-toplevel')), real(repo));
  write(root, 'content/en/pages/index.json', '{ "title": "Home" }\n');
  write(root, 'content/en/pages/about/index.json', '{ "title": "About" }\n');
  write(root, 'theme/tokens.scss', '$accent: red;\n');
  write(root, 'media/old.jpg', Buffer.from([0xff, 0xd8, 0, 1, 2]));
  write(root, '.gitignore', 'node_modules\ndist\npublic/media\n.generated\n.env\n');
  if (sub) write(repo, 'outside.txt', 'not the site\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'init');
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', '-u', 'origin', 'main');
  return { repo, root, origin };
}

test('status lists every changed site file, grouped; ignored files never show', async () => {
  const { root } = siteRepo();
  write(root, 'content/en/pages/about/index.json', '{ "title": "About us" }\n');
  write(root, 'content/en/pages/work/[slug]/index.json', '{ "title": "One" }\n');
  write(root, 'content/en/sources/people.json', '[]\n');
  write(root, 'content/templates/t-card.json', '{ "name": "Card" }\n');
  write(root, 'theme/tokens.scss', '$accent: blue;\n$gap: 8px;\n');
  write(root, 'media/my photo.jpg', Buffer.from([0xff, 0xd8, 0, 9, 9, 9]));
  fs.rmSync(path.join(root, 'media/old.jpg'));
  write(root, 'functions/api.js', 'export default 1;\n');
  // ignored: never listed
  write(root, 'public/media/x.jpg', 'x');
  write(root, '.env', 'R2_SECRET=1\n');
  write(root, 'dist/index.html', '<p>');

  const s = await status(root);
  assert.deepEqual(
    s.files.map((f) => `${f.group} ${f.status} ${f.path}`),
    [
      'content modified content/en/pages/about/index.json',
      'content new content/en/pages/work/[slug]/index.json',
      'sources new content/en/sources/people.json',
      'templates new content/templates/t-card.json',
      'theme modified theme/tokens.scss',
      'media new media/my photo.jpg',
      'media deleted media/old.jpg',
      'other new functions/api.js',
    ],
  );
  const by = Object.fromEntries(s.files.map((f) => [f.path, f]));
  assert.equal(by['content/en/pages/about/index.json'].name, 'pages/about/index.json');
  assert.equal(by['content/en/pages/about/index.json'].changes, 1);
  assert.equal(by['content/en/pages/work/[slug]/index.json'].name, 'pages/work/[slug]/index.json');
  assert.equal(by['theme/tokens.scss'].name, undefined);
  assert.deepEqual([by['theme/tokens.scss'].added, by['theme/tokens.scss'].removed], [2, 1]);
  assert.equal(by['media/my photo.jpg'].bytes, 6);
  assert.equal(by['media/my photo.jpg'].added, undefined);
  assert.equal(by['functions/api.js'].added, 1);
  assert.deepEqual(s.blocked, []);
});

test('status in a site that is a subfolder of the repo: only its files, paths from the site', async () => {
  const { repo, root } = siteRepo({ sub: 'site' });
  write(repo, 'outside.txt', 'changed\n');
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  write(root, 'content/en/pages/index.json', '{ "title": "Start" }\n');
  const s = await status(root);
  assert.deepEqual(
    s.files.map((f) => `${f.group} ${f.path} ${f.name}`),
    ['content content/en/pages/index.json pages/index.json', 'theme theme/tokens.scss undefined'],
  );
});

test('status: blocked lists secret-looking files and files over 95 MB, never deleted ones', async () => {
  const { root } = siteRepo();
  write(root, '.env.production', 'KEY=1\n');
  write(root, '.env.example', 'KEY=\n');
  write(root, 'keys/site.pem', 'x\n');
  write(root, '.dev.vars', 'x\n');
  write(root, 'id_rsa', 'x\n');
  const big = path.join(root, 'media/film.mov');
  fs.writeFileSync(big, '');
  fs.truncateSync(big, 96 * 1024 * 1024); // sparse: nothing is written
  write(root, 'media/fine.jpg', Buffer.from([0xff, 0, 1]));
  const s = await status(root);
  assert.deepEqual(s.blocked.map((b) => b.path).sort(), [
    '.dev.vars',
    '.env.production',
    'id_rsa',
    'keys/site.pem',
    'media/film.mov',
  ]);
  assert.match(
    s.blocked.find((b) => b.path === 'media/film.mov').reason,
    /96\.0 MB, over the 95 MB limit.*\.gitignore/,
  );
  assert.match(s.blocked.find((b) => b.path === 'id_rsa').reason, /secret.*\.gitignore/);
  assert.equal(s.files.find((f) => f.path === 'media/film.mov').bytes, 96 * 1024 * 1024);
  assert.ok(MAX_FILE_BYTES < 96 * 1024 * 1024);
  assert.ok(s.files.some((f) => f.path === '.env.example'));
});

// ---------------------------------------------------------------- publish

const IDENTITY = [
  'GIT_AUTHOR_NAME',
  'GIT_AUTHOR_EMAIL',
  'GIT_COMMITTER_NAME',
  'GIT_COMMITTER_EMAIL',
];

/** Run fn with no identity in the environment (only git config, if any). */
async function withoutEnvIdentity(fn) {
  const saved = Object.fromEntries(IDENTITY.map((k) => [k, process.env[k]]));
  for (const k of IDENTITY) delete process.env[k];
  try {
    return await fn();
  } finally {
    Object.assign(process.env, saved);
  }
}

const tree = (origin, branch = 'main') =>
  git(origin, 'ls-tree', '-r', '--name-only', branch).split('\n');
const staged = (repo) => git(repo, 'diff', '--cached', '--name-only');
const count = (repo, range = 'HEAD') => Number(git(repo, 'rev-list', '--count', range));

/** A second clone of origin that commits `files` and pushes: GitHub moved on. */
function remoteCommit(origin, files) {
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-other-'));
  git(other, 'clone', '-q', origin, 'c');
  const dir = path.join(other, 'c');
  for (const [f, text] of Object.entries(files)) write(dir, f, text);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'from GitHub');
  git(dir, 'push', '-q', 'origin', 'main');
  return git(dir, 'rev-parse', 'HEAD');
}

test('publish commits every changed site file in one commit; ignored files stay out', async () => {
  const { repo, root, origin } = siteRepo();
  write(root, 'content/en/pages/work/[slug]/index.json', '{ "title": "One" }\n');
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  write(root, 'media/my photo.jpg', Buffer.from([0xff, 0xd8, 0, 7]));
  fs.rmSync(path.join(root, 'media/old.jpg'));
  write(root, 'functions/api.js', 'export default 1;\n');
  write(root, 'public/media/x.jpg', 'generated');
  write(root, '.env', 'R2_SECRET=1\n');
  const r = await publish(root, 'Everything');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.committed, true);
  assert.equal(r.body.pushed, true);
  assert.equal(r.body.hash, git(origin, 'rev-parse', 'main'));
  assert.deepEqual(r.body.files.sort(), [
    'content/en/pages/work/[slug]/index.json',
    'functions/api.js',
    'media/my photo.jpg',
    'media/old.jpg',
    'theme/tokens.scss',
  ]);
  const files = tree(origin);
  assert.ok(files.includes('media/my photo.jpg') && !files.includes('media/old.jpg'));
  assert.ok(files.includes('content/en/pages/work/[slug]/index.json'));
  assert.ok(!files.includes('.env') && !files.includes('public/media/x.jpg'));
  assert.equal(count(repo), 2);
  assert.equal(
    git(repo, 'log', '-1', '--format=%s %an <%ae>'),
    'Everything Test <test@example.com>',
  );
  // ignored files untouched, nothing left to publish
  assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), 'R2_SECRET=1\n');
  assert.equal(git(repo, 'status', '--porcelain'), '');
});

test("publish: the author is git's configured identity; without one it refuses", async () => {
  const { repo, root, origin } = siteRepo();
  write(root, 'theme/tokens.scss', '$accent: green;\n');
  await withoutEnvIdentity(async () => {
    const r = await publish(root, 'No identity');
    assert.equal(r.status, 400);
    assert.match(r.body.hint, /git config user\.name/);
    assert.equal(staged(repo), '');
    assert.equal(count(repo), 1);
    git(repo, 'config', 'user.name', 'Site Owner');
    git(repo, 'config', 'user.email', 'owner@example.com');
    const ok = await publish(root, 'With identity');
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
  });
  assert.equal(
    git(origin, 'log', '-1', '--format=%an <%ae> %cn', 'main'),
    'Site Owner <owner@example.com> Site Owner',
  );
});

test('publish in a site in a subfolder: commits only the site folder', async () => {
  const { repo, root, origin } = siteRepo({ sub: 'site' });
  write(repo, 'outside.txt', 'changed\n');
  write(repo, 'staged-outside.txt', 'staged\n');
  git(repo, 'add', 'staged-outside.txt');
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  const r = await publish(root, 'Site only');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.files, ['theme/tokens.scss']);
  assert.deepEqual(git(origin, 'show', '--name-only', '--format=', 'main').split('\n'), [
    'site/theme/tokens.scss',
  ]);
  // outside the site: as it was (modified, and staged)
  assert.equal(git(repo, 'status', '--porcelain'), 'M outside.txt\nA  staged-outside.txt');
});

test('publish refuses, changing nothing: detached, mid-rebase, nothing to publish, no message', async () => {
  const { repo, root } = siteRepo();
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  assert.match((await publish(root, '')).body.error, /message is required/);
  assert.match((await publish(root, 'x'.repeat(5001))).body.error, /too long/);

  fs.mkdirSync(path.join(repo, '.git/rebase-merge'));
  const mid = await publish(root, 'Mid rebase');
  assert.equal(mid.status, 409);
  assert.match(mid.body.error, /rebase, merge or cherry-pick is in progress/);
  fs.rmdirSync(path.join(repo, '.git/rebase-merge'));
  fs.writeFileSync(path.join(repo, '.git/MERGE_HEAD'), git(repo, 'rev-parse', 'HEAD'));
  assert.equal((await publish(root, 'Mid merge')).status, 409);
  fs.rmSync(path.join(repo, '.git/MERGE_HEAD'));

  git(repo, 'checkout', '-q', '--detach');
  const detached = await publish(root, 'Detached');
  assert.equal(detached.status, 409);
  assert.match(detached.body.error, /detached/);
  git(repo, 'checkout', '-q', 'main');
  assert.equal(staged(repo), '');
  assert.equal(count(repo), 1);
  assert.equal(git(repo, 'status', '--porcelain'), 'M theme/tokens.scss');

  git(repo, 'checkout', '--', 'theme/tokens.scss');
  const nothing = await publish(root, 'Nothing');
  assert.equal(nothing.status, 400);
  assert.match(nothing.body.error, /Nothing to publish/);
});

test('publish: a failing commit hook unstages only what Publish staged', async () => {
  const { repo, root, origin } = siteRepo();
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  write(root, 'functions/api.js', 'export default 1;\n');
  write(root, 'notes.md', 'staged by me\n');
  git(repo, 'add', 'notes.md');
  const hook = path.join(repo, '.git/hooks/pre-commit');
  fs.writeFileSync(hook, '#!/bin/sh\necho "lint failed" >&2\nexit 1\n', { mode: 0o755 });
  const r = await publish(root, 'Blocked by hook');
  assert.equal(r.status, 500);
  assert.match(r.body.output, /lint failed/);
  assert.equal(count(repo), 1);
  assert.equal(staged(repo), 'notes.md');
  assert.equal(fs.readFileSync(path.join(root, 'theme/tokens.scss'), 'utf8'), '$accent: blue;\n');
  assert.ok(fs.existsSync(path.join(root, 'functions/api.js')));
  assert.equal(count(origin, 'main'), 1);
});

test('publish: GitHub has new commits on other files: rebased on them, then pushed', async () => {
  const { repo, root, origin } = siteRepo();
  const theirs = remoteCommit(origin, {
    'content/en/pages/about/index.json': '{ "title": "Theirs" }\n',
  });
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  const r = await publish(root, 'Mine');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.pulled, true);
  assert.equal(git(origin, 'rev-parse', 'main'), git(repo, 'rev-parse', 'HEAD'));
  assert.equal(git(repo, 'rev-parse', 'HEAD~1'), theirs); // linear: mine on top of theirs
  assert.equal(
    git(origin, 'show', 'main:content/en/pages/about/index.json'),
    '{ "title": "Theirs" }',
  );
  assert.equal(git(repo, 'status', '--porcelain'), '');
});

test('publish: GitHub changed the same file: the rebase is aborted, the commit kept; a retry makes no new commit', async () => {
  const { repo, root, origin } = siteRepo();
  const theirs = remoteCommit(origin, { 'content/en/pages/index.json': '{ "title": "Theirs" }\n' });
  write(root, 'content/en/pages/index.json', '{ "title": "Mine" }\n');
  const r = await publish(root, 'Mine');
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.deepEqual(r.body.conflicts, ['content/en/pages/index.json']);
  assert.equal(r.body.committed, true);
  assert.equal(r.body.kept, true);
  assert.match(r.body.hint, /kept on this machine/);
  // no rebase left half done, the work tree as committed, origin unchanged
  assert.ok(!fs.existsSync(path.join(repo, '.git/rebase-merge')));
  assert.equal(git(repo, 'status', '--porcelain'), '');
  assert.equal(git(repo, 'log', '-1', '--format=%s'), 'Mine');
  assert.equal(
    fs.readFileSync(path.join(root, 'content/en/pages/index.json'), 'utf8'),
    '{ "title": "Mine" }\n',
  );
  assert.equal(git(origin, 'rev-parse', 'main'), theirs);
  const head = git(repo, 'rev-parse', 'HEAD');
  const again = await publish(root, '');
  assert.equal(again.status, 409);
  assert.equal(again.body.committed, false);
  assert.equal(git(repo, 'rev-parse', 'HEAD'), head);
});

test('publish: a rejected push keeps the commit; Publish again pushes it without a new commit', async () => {
  const { repo, root, origin } = siteRepo();
  const hook = path.join(origin, 'hooks/pre-receive');
  fs.writeFileSync(hook, '#!/bin/sh\necho "denied by policy" >&2\nexit 1\n', { mode: 0o755 });
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  const r = await publish(root, 'Rejected');
  assert.equal(r.status, 502, JSON.stringify(r.body));
  assert.equal(r.body.error, 'git push failed');
  assert.match(r.body.output, /denied by policy/);
  assert.match(r.body.hint, /git pull --rebase|login|reach/);
  assert.equal(r.body.committed, true);
  assert.equal(r.body.hash, git(repo, 'rev-parse', 'HEAD'));
  assert.equal((await status(root)).ahead, 1);

  fs.rmSync(hook);
  const retry = await publish(root, '');
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(retry.body.committed, false);
  assert.equal(retry.body.hash, r.body.hash);
  assert.equal(git(origin, 'rev-parse', 'main'), r.body.hash);
});

test('publish: an unreachable origin fails at the fetch and keeps the commit', async () => {
  const { repo, root } = siteRepo();
  git(repo, 'remote', 'set-url', 'origin', path.join(os.tmpdir(), 'no-such-origin.git'));
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  const r = await publish(root, 'Offline');
  assert.equal(r.status, 502);
  assert.equal(r.body.error, 'git fetch failed');
  assert.equal(r.body.committed, true);
  assert.equal(git(repo, 'log', '-1', '--format=%s'), 'Offline');
});

test('publish: a new branch is pushed with -u to the same name on origin', async () => {
  const { repo, root, origin } = siteRepo();
  git(repo, 'checkout', '-q', '-b', 'draft');
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  const r = await publish(root, 'On a branch');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(git(origin, 'rev-parse', 'draft'), git(repo, 'rev-parse', 'HEAD'));
  assert.equal(git(repo, 'rev-parse', '--abbrev-ref', '@{u}'), 'origin/draft');
  assert.equal(count(origin, 'main'), 1);
});

test('publish refuses blocked files (a secret, 96 MB) with nothing staged', async () => {
  const { repo, root, origin } = siteRepo();
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  write(root, '.env.production', 'KEY=1\n');
  const r = await publish(root, 'Leak');
  assert.equal(r.status, 409);
  assert.deepEqual(
    r.body.blocked.map((b) => b.path),
    ['.env.production'],
  );
  assert.match(r.body.error, /\.env\.production looks like a secret/);
  fs.rmSync(path.join(root, '.env.production'));
  const big = path.join(root, 'media/film.mov');
  fs.writeFileSync(big, '');
  fs.truncateSync(big, 96 * 1024 * 1024);
  const r2 = await publish(root, 'Big');
  assert.equal(r2.status, 409);
  assert.match(r2.body.error, /media\/film\.mov is 96\.0 MB/);
  assert.equal(staged(repo), '');
  assert.equal(count(repo), 1);
  assert.equal(count(origin, 'main'), 1);
});

test('POST /__editor/publish: one publish at a time', async () => {
  const { root, origin } = siteRepo();
  write(root, 'theme/tokens.scss', '$accent: blue;\n');
  const logger = { info() {}, warn() {}, error() {} };
  const handle = editorMiddleware({ root, logger });
  const request = () =>
    new Promise((resolve) => {
      const body = JSON.stringify({ message: 'Once' });
      const req = Object.assign(Readable.from([Buffer.from(body)]), {
        method: 'POST',
        url: '/publish',
        headers: { host: 'localhost:5186', 'content-type': 'application/json' },
        socket: { remoteAddress: '127.0.0.1' },
      });
      const res = {
        statusCode: 0,
        setHeader() {},
        end(text) {
          resolve({ status: this.statusCode, body: JSON.parse(text) });
        },
      };
      handle(req, res);
    });
  const results = await Promise.all([request(), request()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.match(results.find((r) => r.status === 409).body.error, /already running/);
  assert.equal(count(origin, 'main'), 2);
});

// ---------------------------------------------------------------- guards

test('guard: Publish never forces, skips hooks, stashes, resets or cleans', () => {
  for (const rel of ['../src/editor/server/site-git.mjs', '../src/editor/server/local-data-layer.mjs']) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''); // comments may name them
    for (const bad of [
      /--force/,
      /--no-verify/,
      /--tags/,
      /'--hard'/,
      /'clean'/,
      /'stash'/,
      /'-f'/,
      /'checkout'/,
      /'--autostash'/,
    ])
      assert.doesNotMatch(code, bad, rel);
  }
});

test('guard: only the data layer commits, pushes, fetches or rebases in the editor', () => {
  const dir = new URL('../src/editor/', import.meta.url).pathname;
  const walk = (d) =>
    fs
      .readdirSync(d, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const file of walk(dir).filter((f) => /\.(m?js|svelte)$/.test(f))) {
    if (file.endsWith('server/local-data-layer.mjs') || file.endsWith('server/site-git.mjs')) continue;
    const src = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /\bgit\(\s*\w+,\s*\[\s*'(commit|push|fetch|rebase|add|reset)'/, file);
    assert.doesNotMatch(src, /\b(execFile|spawn|exec)(Sync)?\(\s*['"]git['"]/, file);
  }
});
