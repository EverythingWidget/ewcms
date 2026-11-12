import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { useTestEnv } from './test-layout.mjs';
import { contentStatus, publish } from './editor-server.mjs';

// Run from a git hook (pre-push), GIT_DIR & co. point at the real repo: every git here (and the
// editor's, which inherits this process's environment) must only see the temp repos.
useTestEnv();

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const real = (p) => fs.realpathSync(p);

/** A repo with content/en/pages/a/index.json and c/index.json, pushed to a bare "origin". */
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-'));
  const origin = path.join(dir, 'origin.git');
  const root = path.join(dir, 'site');
  git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  git(dir, 'init', '-q', '-b', 'main', root);
  // before any write: git sees the temp repo, nothing else
  assert.equal(real(git(root, 'rev-parse', '--show-toplevel')), real(root));
  assert.equal(real(path.resolve(root, git(root, 'rev-parse', '--git-dir'))), real(`${root}/.git`));
  for (const f of ['a/index.json', 'c/index.json', 'index.json']) {
    const file = path.join(root, 'content/en/pages', f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `{ "title": "${f}" }\n`);
  }
  fs.writeFileSync(path.join(root, 'notes.txt'), 'x\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'init');
  git(root, 'remote', 'add', 'origin', origin);
  git(root, 'push', '-q', '-u', 'origin', 'main');
  return { root, origin };
}

test('publish: a git mv rename commits the new path and the removal of the old one', async () => {
  const { root, origin } = repo();
  git(root, 'mv', 'content/en/pages/a', 'content/en/pages/b');
  fs.rmSync(path.join(root, 'content/en/pages/c'), { recursive: true });
  fs.appendFileSync(path.join(root, 'notes.txt'), 'staged, not content\n');
  git(root, 'add', 'notes.txt');

  const s = await contentStatus(root);
  assert.deepEqual(
    s.files.map((f) => `${f.status} ${f.name}`),
    ['deleted pages/a/index.json', 'new pages/b/index.json', 'deleted pages/c/index.json'],
  );
  const r = await publish(root, 'Rename a to b');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const files = git(origin, 'ls-tree', '-r', '--name-only', 'main').split('\n');
  assert.deepEqual(files, [
    'content/en/pages/b/index.json',
    'content/en/pages/index.json',
    'notes.txt',
  ]);
  // the staged non-content change stays staged, out of the commit
  assert.equal(git(root, 'status', '--porcelain'), 'M  notes.txt');
});

test('status and publish: the shared files at the content root (content/header.json)', async () => {
  const { root, origin } = repo();
  fs.writeFileSync(path.join(root, 'content/header.json'), '{ "version": 1, "header": [] }\n');
  fs.writeFileSync(path.join(root, 'content/site.json'), '{ "version": 1, "name": "S" }\n');
  // not content: a stray file next to them
  fs.writeFileSync(path.join(root, 'content/notes.json'), '{}\n');
  const s = await contentStatus(root);
  assert.deepEqual(
    s.files.map((f) => `${f.status} ${f.name} ${f.path}`),
    ['new header.json content/header.json', 'new site.json content/site.json'],
  );
  const r = await publish(root, 'Shared files');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const files = git(origin, 'ls-tree', '-r', '--name-only', 'main').split('\n');
  assert.ok(files.includes('content/header.json') && files.includes('content/site.json'));
  assert.ok(!files.includes('content/notes.json'));
});
