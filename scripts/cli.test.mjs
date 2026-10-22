// The ewcms command's pieces (scripts/cli.mjs) and the engine paths (scripts/engine.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkContentOf, newSite } from './cli.mjs';
import { ENGINE, enginePath, fsUrl, withEngineUrls, ENGINE_MARK } from './engine.mjs';

const FIXTURE = enginePath('test', 'fixtures', 'site-a');

test('engine paths: /@fs URLs with "/" (also for a Windows path), %EWCMS% in html', () => {
  assert.ok(fs.existsSync(path.join(ENGINE, 'package.json')));
  assert.match(fsUrl(enginePath('src', 'site', 'render.js')), /^\/@fs\/.*\/src\/site\/render\.js$/);
  assert.doesNotMatch(fsUrl(enginePath('src', 'x.js')), /\\/);
  const html = withEngineUrls(`<script src="${ENGINE_MARK}/src/main.js"></script>`);
  assert.equal(html, `<script src="${fsUrl(enginePath('src', 'main.js'))}"></script>`);
});

test('check: the fixture site has no content problems', async () => {
  assert.deepEqual(await checkContentOf(FIXTURE), []);
});

test('check: a broken content file is named', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-check-'));
  fs.cpSync(path.join(FIXTURE, 'content'), path.join(root, 'content'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content', 'en', 'settings', 'site.json'), '{ "version": 1,');
  const problems = await checkContentOf(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /settings\/site\.json/);
});

test('new-site: a site folder that passes check', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-new-')), 'My Site');
  newSite(dir);
  for (const f of [
    'site.config.mjs',
    'package.json',
    '.gitignore',
    'functions/api/contact.js',
    'theme/theme.json',
    'content/en/settings/site.json',
    'public/favicon.svg',
  ])
    assert.ok(fs.existsSync(path.join(dir, f)), f);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-site');
  assert.match(pkg.dependencies.ewcms, /^github:EverythingWidget\/ewcms#v\d/);
  assert.deepEqual(await checkContentOf(dir), []);
  assert.throws(() => newSite(dir), /not empty/);
});

test('bin: ewcms --version and usage', () => {
  const bin = enginePath('bin', 'ewcms.mjs');
  const version = JSON.parse(fs.readFileSync(enginePath('package.json'), 'utf8')).version;
  assert.equal(
    execFileSync(process.execPath, [bin, '--version'], { encoding: 'utf8' }).trim(),
    version,
  );
  assert.match(execFileSync(process.execPath, [bin, 'help'], { encoding: 'utf8' }), /usage: ewcms/);
});
