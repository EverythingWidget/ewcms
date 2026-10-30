// v0.1.40: the editor's update notice (scripts/update.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newestTag, engineDep, changeLine, createUpdater, BOOT } from './update.mjs';

test('v0.1.40: newest tag, the site dependency, changelog lines', () => {
  assert.equal(newestTag(['v0.1.9', 'v0.1.38', 'v0.1.10', 'latest', 'v0.2.0-rc']), 'v0.1.38');
  assert.deepEqual(
    engineDep({ dependencies: { ewcms: 'github:EverythingWidget/ewcms#v0.1.36' } }),
    {
      spec: 'github:EverythingWidget/ewcms#v0.1.36',
      owner: 'EverythingWidget',
      repo: 'ewcms',
      tag: 'v0.1.36',
    },
  );
  assert.equal(engineDep({ dependencies: { ewcms: 'file:../ewcms' } }), null);
  assert.deepEqual(changeLine('fa15000abc', 'v0.1.36: Image fit; more\n\nbody'), {
    ref: 'v0.1.36',
    text: 'Image fit',
  });
  assert.deepEqual(changeLine('fa15000abc', 'Hero title wraps'), {
    ref: 'fa15000',
    text: 'Hero title wraps',
  });
});

function site(spec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'upd-'));
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ dependencies: { ewcms: spec } }),
  );
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lock":1}');
  return root;
}
const fetchJSON = async (url) =>
  url.includes('/tags')
    ? [{ name: 'v0.1.36' }, { name: 'v0.1.38' }, { name: 'v0.1.37' }]
    : {
        commits: [
          { sha: 'a', commit: { message: 'v0.1.37: a' } },
          { sha: 'b', commit: { message: 'v0.1.38: b' } },
        ],
      };
const quiet = { info() {}, warn() {} };
const until = async (u, states) => {
  for (let i = 0; i < 100 && !states.includes(u.status().state); i++)
    await new Promise((r) => setTimeout(r, 20));
  return u.status();
};

test('v0.1.40: check offers the newest tag, update bumps package.json and installs', async () => {
  process.env.EWCMS_UPDATE_NO_RESTART = '1';
  process.env.EWCMS_UPDATE_INSTALL = 'echo installed';
  const root = site('github:EverythingWidget/ewcms#v0.1.36');
  const u = createUpdater({ root, logger: quiet, fetchJSON });
  const c = await u.check();
  assert.equal(c.current, 'v0.1.36');
  assert.equal(c.latest, 'v0.1.38');
  assert.equal(c.available, true);
  assert.equal(c.boot, BOOT);
  assert.deepEqual(
    c.changes.map((x) => x.ref),
    ['v0.1.38', 'v0.1.37'],
  );
  await u.start('v0.1.38');
  const s = await until(u, ['restarting', 'error']);
  assert.equal(s.state, 'restarting');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.ewcms, 'github:EverythingWidget/ewcms#v0.1.38');
  assert.equal((await u.check()).available, false);
});

test('v0.1.40: a failed install puts package.json and the lockfile back', async () => {
  process.env.EWCMS_UPDATE_NO_RESTART = '1';
  process.env.EWCMS_UPDATE_INSTALL = 'echo "npm ERR! 401" >&2; exit 1';
  const root = site('github:EverythingWidget/ewcms#v0.1.36');
  const before = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const u = createUpdater({ root, logger: quiet, fetchJSON });
  await u.start('v0.1.38');
  const s = await until(u, ['restarting', 'error']);
  assert.equal(s.state, 'error');
  assert.match(s.log, /401/);
  assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), before);
  assert.equal(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'), '{"lock":1}');
  assert.equal(
    (await createUpdater({ root: site('file:../e'), logger: quiet, fetchJSON }).check()).available,
    false,
  );
});
