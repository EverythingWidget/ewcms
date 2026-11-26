// The ewcms command's pieces (src/cli/cli.mjs) and the engine paths (src/cli/engine.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkContentOf, siteCode, themeWarning } from '../src/cli/cli.mjs';
import { enginePin, installedCommit, isSiteFolder, scaffoldSite } from '../src/cli/scaffold.mjs';
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

test("scaffold (dev's first run): the default site in a folder with no site, a site that passes check", async () => {
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
    'theme/meta.json',
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
  // the engine that runs: this checkout's commit (or its release tag when HEAD is one)
  assert.match(
    pkg.dependencies.ewcms,
    /^github:EverythingWidget\/ewcms#(v\d+\.\d+\.\d+|[0-9a-f]{40})$/,
  );
  assert.deepEqual(await checkContentOf(dir), []);
  // the theme: the site's own copy of the default site's look (tokens, fonts, meta.json), named
  assert.deepEqual(fs.readdirSync(path.join(dir, 'theme')).sort(), [
    'fonts.scss',
    'meta.json',
    'tokens.scss',
  ]);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'theme/meta.json'), 'utf8'));
  assert.equal(meta.name, 'My Site');
  assert.equal(meta.colorScheme, undefined); // color.scheme is content/theme.json now
  const theme = JSON.parse(fs.readFileSync(path.join(dir, 'content/theme.json'), 'utf8'));
  assert.equal(theme.color.scheme, 'dark'); // the default site's
  assert.equal(
    fs.readFileSync(path.join(dir, 'theme/tokens.scss'), 'utf8'),
    fs.readFileSync(enginePath('default-site/theme/tokens.scss'), 'utf8'),
  );
  assert.equal(themeWarning(loadSiteConfig(dir)), '');
  // no name yet: the editor asks for it (FirstRunModal.svelte)
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'content/site.json'), 'utf8')).name, '');
  // again: nothing left to make
  assert.deepEqual(scaffoldSite(dir), []);
});

test("scaffold (dev's first run) in a folder with some files: only what is missing, nothing overwritten", () => {
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
    /theme\/tokens\.scss misses \d+ token\(s\) of the look \(--error, --shade-15, .*default-site\/theme.*THEME-MIGRATION/,
  );
  // a whole copy of the default site's tokens
  const part = tmp();
  fs.mkdirSync(path.join(part, 'theme'));
  fs.copyFileSync(
    enginePath('default-site/theme/tokens.scss'),
    path.join(part, 'theme/tokens.scss'),
  );
  assert.equal(themeWarning(loadSiteConfig(part)), '');
  // a partial layer (a site of before: only what differed from the engine's theme)
  const partial = tmp();
  fs.mkdirSync(path.join(partial, 'theme'));
  fs.writeFileSync(
    path.join(partial, 'theme/tokens.scss'),
    ':root { --error: #f00; --shade-15: #0002; }\n',
  );
  const w = themeWarning(loadSiteConfig(partial));
  assert.match(w, /\(--shade-35, --shade-40,/);
  assert.doesNotMatch(w, /--error\b/);
  // colours are content/theme.json's palette now: never asked for
  assert.doesNotMatch(w, /--bg\b|--fg\b|--brand\b/);
  // overrides.scss counts too
  fs.writeFileSync(
    path.join(partial, 'theme/overrides.scss'),
    fs.readFileSync(enginePath('default-site/theme/tokens.scss'), 'utf8'),
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

test('site.json lang: its content/<lang>/ folder when there is one, else content/en/ and a warning', () => {
  const site = (lang, dirs = []) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-lang-'));
    for (const d of ['en', ...dirs])
      fs.mkdirSync(path.join(root, 'content', d), { recursive: true });
    fs.writeFileSync(path.join(root, 'content/site.json'), JSON.stringify({ version: 1, lang }));
    return loadSiteConfig(root);
  };
  const nl = site('nl', ['nl']);
  assert.equal(nl.contentRel, 'content/nl');
  assert.equal(nl.langWarning, '');
  assert.equal(site('nl-BE', ['nl']).contentRel, 'content/nl');
  const missing = site('de');
  assert.equal(missing.contentRel, 'content/en');
  assert.match(missing.langWarning, /lang "de" has no content\/de\/ folder: using content\/en\//);
  assert.ok(!fs.existsSync(path.join(missing.root, 'content/de'))); // nothing made
  assert.equal(site('en').langWarning, '');
  assert.equal(site('en-GB').contentRel, 'content/en');
});

test('the pin of a new site: the running engine (a checkout, an npm install), else its tag', () => {
  // a checkout: HEAD's commit or its tag
  const here = enginePin();
  assert.ok(here.exact);
  assert.match(here.ref, /^(v\d+\.\d+\.\d+|[0-9a-f]{40})$/);
  // an npm install (npx too): the commit in node_modules/.package-lock.json
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-pin-'));
  const engine = path.join(tmp, 'node_modules', 'ewcms');
  fs.mkdirSync(engine, { recursive: true });
  fs.writeFileSync(path.join(engine, 'package.json'), '{"name":"ewcms","version":"0.9.0"}');
  assert.equal(installedCommit(engine), '');
  assert.deepEqual(enginePin(engine, '0.9.0', { tagCommit: () => '' }), {
    ref: 'v0.9.0',
    exact: false,
  });
  const sha = 'a'.repeat(40);
  fs.writeFileSync(
    path.join(tmp, 'node_modules', '.package-lock.json'),
    JSON.stringify({
      packages: {
        'node_modules/ewcms': {
          resolved: `git+ssh://git@github.com/EverythingWidget/ewcms.git#${sha}`,
        },
      },
    }),
  );
  // the remote's tag: another commit (or offline, ''), the commit; that commit, the tag
  const pin = (tagged) => enginePin(engine, '0.9.0', { tagCommit: () => tagged });
  assert.deepEqual(pin(''), { ref: sha, exact: true });
  assert.deepEqual(pin('b'.repeat(40)), { ref: sha, exact: true });
  assert.deepEqual(pin(sha), { ref: 'v0.9.0', exact: true });
  // scaffold writes the pin it is given
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-pinned-'));
  scaffoldSite(site, { pin: { ref: sha } });
  const pkg = JSON.parse(fs.readFileSync(path.join(site, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.ewcms, `github:EverythingWidget/ewcms#${sha}`);
});
