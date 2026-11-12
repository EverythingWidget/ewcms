// The ewcms command's pieces (scripts/cli.mjs) and the engine paths (scripts/engine.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkContentOf, newSite, siteCode, themeWarning } from './cli.mjs';
import { loadSiteConfig } from './site-config.mjs';
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
  fs.writeFileSync(path.join(root, 'content', 'site.json'), '{ "version": 1,');
  const problems = await checkContentOf(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /content\/site\.json/);
});

test('check: a leftover content/en/settings/ folder is an error that says where its files go', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-check-'));
  fs.cpSync(path.join(FIXTURE, 'content'), path.join(root, 'content'), { recursive: true });
  fs.mkdirSync(path.join(root, 'content', 'en', 'settings'));
  fs.renameSync(
    path.join(root, 'content', 'header.json'),
    path.join(root, 'content', 'en', 'settings', 'nav.json'),
  );
  const problems = await checkContentOf(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /content\/en\/settings\/ is no longer read: its files go to content\//);
  assert.match(problems[0], /nav\.json is now header\.json/);
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
    'content/site.json',
    'public/favicon.svg',
  ])
    assert.ok(fs.existsSync(path.join(dir, f)), f);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-site');
  assert.match(pkg.dependencies.ewcms, /^github:EverythingWidget\/ewcms#v\d/);
  assert.deepEqual(await checkContentOf(dir), []);
  // the theme: layers over the engine's (a name and a tokens stub), no copy of its styles
  assert.deepEqual(fs.readdirSync(path.join(dir, 'theme')).sort(), ['theme.json', 'tokens.scss']);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(dir, 'theme/theme.json'), 'utf8')).name,
    'My Site',
  );
  assert.equal(themeWarning(loadSiteConfig(dir)), '');
  assert.throws(() => newSite(dir), /not empty/);
});

test('check: a warning for a full-copy theme, none for layers or none', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-copy-'));
  fs.mkdirSync(path.join(dir, 'theme/styles'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'theme/styles/_look.scss'), '');
  assert.match(themeWarning(loadSiteConfig(dir)), /theme\/ is a full copy.*THEME-MIGRATION/);
  assert.equal(themeWarning(loadSiteConfig(fs.mkdtempSync(path.join(os.tmpdir(), 'e-')))), '');
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

test('siteCode: config, functions/ and content are no reason to warn; own JS and SCSS are', () => {
  const site = (files) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-code-'));
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    return root;
  };
  const base = {
    'site.config.mjs': 'export default {};\n',
    'functions/api/contact.js': '// x\n',
    'content/en/x.js': '',
    'public/a.js': '',
    'dist/assets/b.js': '',
    'node_modules/p/index.js': '',
    '.generated/c.mjs': '',
  };
  const a = site(base);
  const b = site({ ...base, 'widgets/quote/index.js': '', 'theme/styles/_look.scss': 'a {}\n' });
  try {
    // like eeliyarasta-website: config + one function, no theme of its own: nothing to warn about
    assert.deepEqual(siteCode(a, loadSiteConfig(a)), { js: [], scss: [] });
    const code = siteCode(b, loadSiteConfig(b));
    assert.deepEqual(code.js, ['widgets/quote/index.js']);
    assert.deepEqual(code.scss, ['theme/styles/_look.scss']);
  } finally {
    for (const r of [a, b]) fs.rmSync(r, { recursive: true, force: true });
  }
});
