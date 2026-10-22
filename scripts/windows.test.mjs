// Windows paths (path.win32), checked on any machine: the build's entry, /@fs/ URLs, and which
// ewcms runs a site in a workspace (scripts/locate.mjs, scripts/resolve-hook.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ENGINE, enginePath, fsUrl, posixPath, sameFile } from './engine.mjs';
import { isVirtualShell } from './vite-plugin-static-site.mjs';
import { workspaceEngine, preferredEngine } from './locate.mjs';
import { initialize, resolve } from './resolve-hook.mjs';

const W = path.win32;

test('Windows: the entry index.html in every spelling Vite and Rolldown use', () => {
  for (const root of [
    'S:/ewcms-dev/sites/eeliyarasta-website',
    'S:\\ewcms-dev\\sites\\eeliyarasta-website',
  ]) {
    for (const id of [
      'S:\\ewcms-dev\\sites\\eeliyarasta-website\\index.html', // Rolldown: the input as given
      'S:/ewcms-dev/sites/eeliyarasta-website/index.html', // Vite's ids
      's:/ewcms-dev/sites/Eeliyarasta-website/index.html', // drive letter and names: any case
      '/S:/ewcms-dev/sites/eeliyarasta-website/index.html',
      '/@fs/S:/ewcms-dev/sites/eeliyarasta-website/index.html',
      'S:/ewcms-dev/sites/eeliyarasta-website/index.html?html-proxy',
    ])
      assert.ok(isVirtualShell(id, root, W), `${id} (root ${root})`);
    for (const id of [
      'S:\\ewcms-dev\\ewcms\\index.html',
      'S:/ewcms-dev/sites/eeliyarasta-website/about/index.html',
      'T:/ewcms-dev/sites/eeliyarasta-website/index.html',
    ])
      assert.ok(!isVirtualShell(id, root, W), id);
  }
});

test('POSIX: the entry is case-sensitive and needs the exact folder', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-shell-'));
  assert.ok(isVirtualShell(path.join(root, 'index.html'), root));
  assert.ok(isVirtualShell(`/@fs${root}/index.html`, root));
  assert.ok(!isVirtualShell(path.join(root, 'INDEX.html'), root));
  // a site with its own index.html: Vite reads it, no stand-in
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
  assert.ok(!isVirtualShell(path.join(root, 'index.html'), root));
  assert.ok(sameFile(`${root}//index.html`, path.join(root, 'index.html')));
});

test('Windows: /@fs/ URLs and posix paths of S:\\ paths', () => {
  assert.equal(
    fsUrl('S:\\ewcms-dev\\ewcms\\src\\client\\main.js', W),
    '/@fs/S:/ewcms-dev/ewcms/src/client/main.js',
  );
  assert.equal(posixPath('S:\\ewcms-dev\\ewcms', W), 'S:/ewcms-dev/ewcms');
  assert.equal(fsUrl('/home/x/ewcms/a.js', path.posix), '/@fs/home/x/ewcms/a.js');
});

/** ewcms-dev/{package.json, ewcms -> this engine, sites/a, sites/a/node_modules/ewcms (a copy)} */
function workspace({ workspaces = ['ewcms', 'sites/*'] } = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-ws-')));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ private: true, workspaces }));
  // a junction on Windows, like npm's workspace links
  fs.symlinkSync(ENGINE, path.join(dir, 'ewcms'), 'junction');
  const site = path.join(dir, 'sites', 'a');
  fs.mkdirSync(site, { recursive: true });
  fs.writeFileSync(path.join(site, 'package.json'), JSON.stringify({ name: 'a' }));
  // npm's second copy (a git dependency): just enough of it to start
  const copy = path.join(site, 'node_modules', 'ewcms');
  fs.mkdirSync(path.join(copy, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(copy, 'scripts'));
  fs.writeFileSync(
    path.join(copy, 'package.json'),
    JSON.stringify({ name: 'ewcms', version: '0.0.0' }),
  );
  fs.copyFileSync(enginePath('bin', 'ewcms.mjs'), path.join(copy, 'bin', 'ewcms.mjs'));
  fs.copyFileSync(enginePath('scripts', 'locate.mjs'), path.join(copy, 'scripts', 'locate.mjs'));
  return { dir, site, copy };
}

test('locate: a site in a workspace runs the workspace ewcms, else its own', () => {
  const { site } = workspace();
  assert.equal(workspaceEngine(site), ENGINE);
  assert.equal(workspaceEngine(path.join(site, 'content')), ENGINE);
  const other = workspace({ workspaces: ['sites/*'] });
  assert.equal(workspaceEngine(other.site), null);
  assert.equal(preferredEngine(other.site, { EWCMS_ENGINE: ENGINE }), ENGINE);
  assert.throws(() => preferredEngine(other.site, { EWCMS_ENGINE: other.site }), /no ewcms/);
});

test("bin: the copy in the site's node_modules hands over to the workspace ewcms", () => {
  const { site, copy } = workspace();
  const out = execFileSync(process.execPath, [path.join(copy, 'bin', 'ewcms.mjs'), '--version'], {
    cwd: site,
    encoding: 'utf8',
    env: { ...process.env, EWCMS_VERBOSE: '1' },
  });
  const version = JSON.parse(fs.readFileSync(enginePath('package.json'), 'utf8')).version;
  assert.match(out, /hands over to/);
  assert.equal(out.trim().split('\n').at(-1), version);
});

test("resolve hook: ewcms/… from a site's files is the running engine's", async () => {
  initialize({ engine: ENGINE });
  const next = () => assert.fail('not passed on');
  const r = await resolve('ewcms/widget-api', {}, next);
  assert.equal(r.url, pathToFileURL(enginePath('src/site/widget-api.js')).href);
  assert.equal(
    (await resolve('ewcms/functions/contact', {}, next)).url,
    pathToFileURL(enginePath('functions/contact.js')).href,
  );
  assert.equal(await resolve('vite', {}, (s) => `next:${s}`), 'next:vite');
});

// v0.1.2: dev pages for clients without an Accept header, ASCII console text
import { wantsPage } from './vite-plugin-static-site.mjs';
import { toAscii, wantsAscii } from './term.mjs';

test('dev serves pages to clients that send no Accept (PowerShell Invoke-WebRequest)', () => {
  assert.equal(wantsPage('/', undefined), true);
  assert.equal(wantsPage('/', ''), true);
  assert.equal(wantsPage('/about', 'text/html,application/xhtml+xml'), true);
  assert.equal(wantsPage('/index.html', '*/*'), true);
  assert.equal(wantsPage('/v1.2/page', ''), true);
  assert.equal(wantsPage('/main.js', ''), false);
  assert.equal(wantsPage('/', 'application/json'), false);
});

test('console text is ASCII on Windows when output is piped', () => {
  assert.equal(
    toAscii('  Editor:  x?edit  ·  ewcms → ✓ ✗ ➜'),
    '  Editor:  x?edit  -  ewcms -> ok x >',
  );
  assert.equal(wantsAscii({}, 'win32', { isTTY: false }), true);
  assert.equal(wantsAscii({}, 'win32', { isTTY: true }), false);
  assert.equal(wantsAscii({}, 'linux', { isTTY: false }), false);
  assert.equal(wantsAscii({ EWCMS_ASCII: '1' }, 'linux', {}), true);
  assert.equal(wantsAscii({ EWCMS_ASCII: '0' }, 'win32', {}), false);
});
