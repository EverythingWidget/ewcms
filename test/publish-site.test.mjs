/**
 * The local data layer's git side on temp repos with a bare "origin": status lists every
 * changed file in the site folder, and Publish commits and pushes them safely
 * (src/editor/server/local-data-layer.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { useTestEnv } from '../scripts/test-layout.mjs';
import { MAX_FILE_BYTES, siteStatus } from '../src/editor/server/local-data-layer.mjs';

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

  const s = await siteStatus(root);
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
  const s = await siteStatus(root);
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
  const s = await siteStatus(root);
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
