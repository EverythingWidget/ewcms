// The theme (ewcms.config.mjs themeDir: theme.json, tokens.scss, fonts.scss, overrides.scss): its
// part of the page head, and where loadSiteConfig finds it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { themeHead, writeThemeLayers } from '../src/cli/vite-plugin-static-site.mjs';
import { loadSiteConfig, DEFAULT_SITE_THEME } from '../src/cli/site-config.mjs';
import { enginePath } from '../src/cli/engine.mjs';

const theme = {
  themeColor: '#050505',
  colorScheme: 'dark',
  preloads: [
    { href: '/fonts/a.woff2', as: 'font', type: 'font/woff2', crossorigin: true },
    { href: '/img/b.webp', as: 'image' },
  ],
};

test('themeHead: theme-color (site.json first), color-scheme, preloads', () => {
  assert.deepEqual(themeHead(theme), {
    meta: '<meta name="theme-color" content="#050505" />\n    <meta name="color-scheme" content="dark" />',
    preloads:
      '<link rel="preload" href="/fonts/a.woff2" as="font" type="font/woff2" crossorigin />\n    <link rel="preload" href="/img/b.webp" as="image" />',
  });
  assert.match(themeHead(theme, '#fff').meta, /content="#fff"/);
  assert.deepEqual(themeHead({}), { meta: '', preloads: '' });
});

test('loadSiteConfig: the site theme folder, its style files and theme.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  fs.mkdirSync(path.join(root, 'theme'));
  fs.writeFileSync(path.join(root, 'theme/tokens.scss'), ':root { --bg: #fff; }\n');
  fs.writeFileSync(path.join(root, 'theme/theme.json'), JSON.stringify(theme));
  const site = loadSiteConfig(root);
  assert.equal(site.themeDir, path.join(root, 'theme'));
  assert.deepEqual(site.themeLayers, ['tokens.scss']);
  assert.deepEqual(site.theme, theme); // the site's alone: the engine has no theme of its own
  // the site-layer stubs: its tokens used, the other two empty
  const dir = writeThemeLayers(site);
  assert.match(
    fs.readFileSync(path.join(dir, '_tokens.scss'), 'utf8'),
    /@use '\.\.\/\.\.\/theme\/tokens';/,
  );
  assert.doesNotMatch(fs.readFileSync(path.join(dir, '_overrides.scss'), 'utf8'), /@use/);
  // another folder (ewcms.config.mjs themeDir)
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  fs.writeFileSync(
    path.join(other, 'ewcms.config.mjs'),
    "export default { themeDir: 'looks/a' };\n",
  );
  fs.mkdirSync(path.join(other, 'looks/a'), { recursive: true });
  fs.writeFileSync(path.join(other, 'looks/a/fonts.scss'), '');
  assert.equal(loadSiteConfig(other).themeDir, path.join(other, 'looks/a'));
  assert.deepEqual(loadSiteConfig(other).themeLayers, ['fonts.scss']);
  // no theme folder: no theme, empty stubs
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  const none = loadSiteConfig(bare);
  assert.equal(none.themeDir, null);
  assert.deepEqual(none.themeLayers, []);
  assert.deepEqual(none.theme, {});
  const stubs = writeThemeLayers(none);
  assert.doesNotMatch(fs.readFileSync(path.join(stubs, '_tokens.scss'), 'utf8'), /@use/);
  for (const d of [root, other, bare]) fs.rmSync(d, { recursive: true, force: true });
});

test('the default site theme: every colour in its tokens; the engine styles none of its own', () => {
  const defaultSite = JSON.parse(
    fs.readFileSync(path.join(DEFAULT_SITE_THEME, 'theme.json'), 'utf8'),
  );
  assert.equal(defaultSite.version, 1);
  assert.equal(defaultSite.colorScheme, 'dark');
  // what was the engine's theme-default: its chrome and the widgets' looks read the site's tokens
  const files = [
    'src/client/styles/_chrome.scss',
    'src/client/styles/_glass.scss',
    ...['hero', 'photo', 'form', 'album'].map((w) => `src/render/widgets/${w}/style.scss`),
  ].map((f) => enginePath(f));
  for (const f of files) {
    const code = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, f);
  }
  assert.equal(fs.existsSync(enginePath('theme-default')), false);
});
