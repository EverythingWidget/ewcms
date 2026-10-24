// The theme (site.config.mjs themeDir: theme.json and styles/): its part of the page head, and
// where loadSiteConfig finds it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { themeHead, writeThemeLayers } from './vite-plugin-static-site.mjs';
import { loadSiteConfig, DEFAULT_THEME } from './site-config.mjs';

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

test('loadSiteConfig: a full-copy theme folder (styles/_look.scss) and its theme.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  fs.writeFileSync(path.join(root, 'site.config.mjs'), "export default { themeDir: 'looks/a' };\n");
  fs.mkdirSync(path.join(root, 'looks/a/styles'), { recursive: true });
  fs.writeFileSync(path.join(root, 'looks/a/styles/_look.scss'), '');
  fs.writeFileSync(path.join(root, 'looks/a/theme.json'), JSON.stringify(theme));
  const site = loadSiteConfig(root);
  assert.equal(site.themeDir, path.join(root, 'looks/a'));
  assert.equal(site.themeLayerDir, null);
  assert.deepEqual(site.theme, theme);
  // no theme folder: the engine's theme-default, and its theme.json
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  assert.equal(loadSiteConfig(bare).themeDir, DEFAULT_THEME);
  assert.equal(loadSiteConfig(bare).theme.version, 1);
});

test('loadSiteConfig: a layer theme folder over the engine theme, theme.json merged by key', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  fs.mkdirSync(path.join(root, 'theme'));
  fs.writeFileSync(path.join(root, 'theme/tokens.scss'), ':root { --bg: #fff; }\n');
  fs.writeFileSync(path.join(root, 'theme/theme.json'), '{ "name": "G", "themeColor": "#fff" }');
  const site = loadSiteConfig(root);
  assert.equal(site.themeDir, DEFAULT_THEME);
  assert.equal(site.themeLayerDir, path.join(root, 'theme'));
  assert.deepEqual(site.themeLayers, ['tokens.scss']);
  assert.equal(site.theme.name, 'G');
  assert.equal(site.theme.themeColor, '#fff');
  assert.equal(site.theme.colorScheme, 'dark'); // the engine's
  // the site-layer stubs: its tokens used, the other two empty
  const dir = writeThemeLayers(site);
  assert.match(
    fs.readFileSync(path.join(dir, '_tokens.scss'), 'utf8'),
    /@use '\.\.\/\.\.\/theme\/tokens';/,
  );
  assert.doesNotMatch(fs.readFileSync(path.join(dir, '_overrides.scss'), 'utf8'), /@use/);
  // an empty theme folder: the engine's theme as is
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  fs.mkdirSync(path.join(empty, 'theme'));
  assert.equal(loadSiteConfig(empty).theme.version, 1);
  assert.deepEqual(loadSiteConfig(empty).themeLayers, []);
});

test('theme-default: no colour outside its tokens', () => {
  const dir = path.join(DEFAULT_THEME, 'styles');
  for (const f of fs.readdirSync(dir).filter((f) => f !== '_tokens.scss')) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, f);
  }
});
