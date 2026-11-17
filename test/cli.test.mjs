// The ewcms command's pieces (src/cli/cli.mjs) and the engine paths (src/cli/engine.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkContentOf, siteCode, themeWarning } from '../src/cli/cli.mjs';
import { isSiteFolder, scaffoldSite } from '../src/cli/scaffold.mjs';
import { loadSiteConfig } from '../src/cli/site-config.mjs';
import { ENGINE, enginePath, fsUrl, withEngineUrls, ENGINE_MARK } from '../src/cli/engine.mjs';

const FIXTURE = enginePath('test', 'fixtures', 'site-a');

test('engine paths: /@fs URLs with "/" (also for a Windows path), %EWCMS% in html', () => {
  assert.ok(fs.existsSync(path.join(ENGINE, 'package.json')));
  assert.match(
    fsUrl(enginePath('src', 'render', 'render.js')),
    /^\/@fs\/.*\/src\/render\/render\.js$/,
  );
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

test('dev in a folder with no site: the starter, a site folder that passes check', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-new-')), 'My Site');
  assert.equal(isSiteFolder(dir), false);
  scaffoldSite(dir);
  assert.equal(isSiteFolder(dir), true);
  for (const f of [
    'ewcms.config.mjs',
    'package.json',
    '.gitignore',
    'README.md',
    'functions/api/contact.js',
    'theme/theme.json',
    'content/site.json',
    'public/favicon.svg',
    'media',
    'widgets',
    'content/templates',
    'content/en/sources',
    'media/.gitkeep',
    'widgets/.gitkeep',
    'content/templates/.gitkeep',
    'content/en/sources/.gitkeep',
  ])
    assert.ok(fs.existsSync(path.join(dir, f)), f);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-site');
  assert.match(pkg.dependencies.ewcms, /^github:EverythingWidget\/ewcms#v\d/);
  assert.deepEqual(await checkContentOf(dir), []);
  // the theme: the site's own copy of the starter's look (tokens, fonts, theme.json), named
  assert.deepEqual(fs.readdirSync(path.join(dir, 'theme')).sort(), [
    'fonts.scss',
    'theme.json',
    'tokens.scss',
  ]);
  const theme = JSON.parse(fs.readFileSync(path.join(dir, 'theme/theme.json'), 'utf8'));
  assert.equal(theme.name, 'My Site');
  assert.equal(theme.colorScheme, 'dark'); // the starter's
  assert.equal(
    fs.readFileSync(path.join(dir, 'theme/tokens.scss'), 'utf8'),
    fs.readFileSync(enginePath('starter/theme/tokens.scss'), 'utf8'),
  );
  assert.equal(themeWarning(loadSiteConfig(dir)), '');
  // no name yet: the editor asks for it (FirstRunModal.svelte)
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'content/site.json'), 'utf8')).name, '');
  // again: nothing left to make
  assert.deepEqual(scaffoldSite(dir), []);
});

test('dev in a folder with some files: only what is missing, nothing overwritten', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-part-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"mine"}\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'mine\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'mine\n');
  const made = scaffoldSite(dir);
  for (const f of ['package.json', 'README.md', '.gitignore']) {
    assert.ok(!made.includes(f), f);
    assert.match(fs.readFileSync(path.join(dir, f), 'utf8'), /mine/);
  }
  assert.ok(made.includes('ewcms.config.mjs'));
  assert.ok(made.includes('content/site.json'));
  assert.ok(!fs.existsSync(path.join(dir, 'gitignore')));
});

test('check: a warning for a theme that misses tokens of the look, none for a whole one', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-theme-'));
  // no theme folder (or an older full copy, styles/_look.scss): every token missing
  const bare = tmp();
  assert.match(
    themeWarning(loadSiteConfig(bare)),
    /theme\/tokens\.scss misses \d+ token\(s\) of the look \(--bg, --bg-2, .*starter\/theme.*THEME-MIGRATION/,
  );
  // a whole copy of the starter's tokens
  const part = tmp();
  fs.mkdirSync(path.join(part, 'theme'));
  fs.copyFileSync(enginePath('starter/theme/tokens.scss'), path.join(part, 'theme/tokens.scss'));
  assert.equal(themeWarning(loadSiteConfig(part)), '');
  // a partial layer (a site of before: only what differed from the engine's theme)
  const partial = tmp();
  fs.mkdirSync(path.join(partial, 'theme'));
  fs.writeFileSync(
    path.join(partial, 'theme/tokens.scss'),
    ':root { --bg: #fff; --bg-2: #eee; }\n',
  );
  const w = themeWarning(loadSiteConfig(partial));
  assert.match(w, /\(--fg, --muted,/);
  assert.doesNotMatch(w, /--bg\b/);
  // overrides.scss counts too
  fs.writeFileSync(
    path.join(partial, 'theme/overrides.scss'),
    fs.readFileSync(enginePath('starter/theme/tokens.scss'), 'utf8'),
  );
  assert.equal(themeWarning(loadSiteConfig(partial)), '');
  for (const d of [bare, part, partial]) fs.rmSync(d, { recursive: true, force: true });
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
    'ewcms.config.mjs': 'export default {};\n',
    'functions/api/contact.js': '// x\n',
    'content/en/x.js': '',
    'public/a.js': '',
    'dist/assets/b.js': '',
    'node_modules/p/index.js': '',
    '.generated/c.mjs': '',
  };
  const a = site(base);
  const b = site({ ...base, 'widgets/quote/index.js': '', 'theme/tokens.scss': ':root {}\n' });
  try {
    // like eeliyarasta-website: config + one function, no theme of its own: nothing to warn about
    assert.deepEqual(siteCode(a, loadSiteConfig(a)), { js: [], scss: [] });
    const code = siteCode(b, loadSiteConfig(b));
    assert.deepEqual(code.js, ['widgets/quote/index.js']);
    assert.deepEqual(code.scss, ['theme/tokens.scss']);
  } finally {
    for (const r of [a, b]) fs.rmSync(r, { recursive: true, force: true });
  }
});
