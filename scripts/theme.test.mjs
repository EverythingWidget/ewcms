// The theme (site.config.mjs themeDir: theme.json and styles/): its part of the page head, and
// where loadSiteConfig finds it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { themeHead } from './vite-plugin-static-site.mjs';
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

test('loadSiteConfig: the theme folder and its theme.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  fs.writeFileSync(path.join(root, 'site.config.mjs'), "export default { themeDir: 'looks/a' };\n");
  fs.mkdirSync(path.join(root, 'looks/a'), { recursive: true });
  fs.writeFileSync(path.join(root, 'looks/a/theme.json'), JSON.stringify(theme));
  const site = loadSiteConfig(root);
  assert.equal(site.themeDir, path.join(root, 'looks/a'));
  assert.deepEqual(site.theme, theme);
  // no theme folder: the engine's theme-default, and its theme.json
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  assert.equal(loadSiteConfig(bare).themeDir, DEFAULT_THEME);
  assert.equal(loadSiteConfig(bare).theme.version, 1);
  // a theme folder without theme.json: {}
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  fs.mkdirSync(path.join(empty, 'theme'));
  assert.deepEqual(loadSiteConfig(empty).theme, {});
});
