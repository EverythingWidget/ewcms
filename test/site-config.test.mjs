// ewcms.config.mjs and its paths (src/cli/site-config.mjs), and the GitHub link from a remote.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as siteConfig from '../src/cli/site-config.mjs';
import { check } from '../src/cli/cli.mjs';
import { loadContent } from '../src/cli/content.mjs';
import { CONTENT_DIR } from '../src/render/files.js';
import { SITE_A } from './fixtures/index.mjs';

const { DEFAULTS, loadSiteConfig, repoUrl } = siteConfig;

test('no ewcms.config.mjs: the defaults, resolved from the root', () => {
  const site = loadSiteConfig(SITE_A);
  assert.deepEqual(site.config, { ...DEFAULTS, repo: { ...DEFAULTS.repo } });
  assert.equal(site.contentDir, path.join(SITE_A, 'content/en'));
  assert.equal(site.manifest, path.join(SITE_A, '.generated/media.json'));
  assert.equal(site.publicMediaDir, path.join(SITE_A, 'public/media'));
  assert.equal(site.outDir, path.join(SITE_A, 'dist'));
  assert.equal(site.contentRel, 'content/en');
  assert.equal(site.mediaUrl, '/media');
});

test('an ewcms.config.mjs moves the folders: content, manifest, media URL, messages', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-config-'));
  fs.writeFileSync(
    path.join(root, 'ewcms.config.mjs'),
    `export default { contentDir: 'site/nl', generatedDir: 'gen', publicDir: 'static', publicMediaDir: 'static/img', outDir: 'out', repo: { owner: 'o' } };\n`,
  );
  fs.cpSync(path.join(SITE_A, 'content/en'), path.join(root, 'site/nl'), { recursive: true });
  // the shared files: at the content root, next to the language folder
  for (const f of ['site.json', 'header.json'])
    fs.copyFileSync(path.join(SITE_A, 'content', f), path.join(root, 'site', f));
  fs.mkdirSync(path.join(root, 'gen'));
  fs.writeFileSync(path.join(root, 'gen/media.json'), '{"a.jpg":{"width":1}}');
  const site = loadSiteConfig(root);
  assert.equal(site.contentDir, path.join(root, 'site/nl'));
  assert.equal(site.contentRootDir, path.join(root, 'site'));
  assert.equal(site.contentRootRel, 'site');
  assert.equal(site.mediaDir, path.join(root, 'media'), 'a key not set keeps its default');
  assert.equal(site.mediaUrl, '/img');
  assert.equal(site.outDir, path.join(root, 'out'));
  assert.deepEqual(site.config.repo, { owner: 'o', name: '' });
  const content = loadContent(root);
  assert.deepEqual(content.media, { 'a.jpg': { width: 1 } });
  assert.ok(content.pages.home);
  assert.ok(content.site.name, 'site.json read from the content root');
  assert.ok(content.header.header.length, 'header.json read from the content root');
  assert.equal(CONTENT_DIR, 'site/nl', 'messages name the configured folder');
  loadContent(SITE_A);
  assert.equal(CONTENT_DIR, 'content/en');
});

test('repoUrl: the git remote first, then the config, else none', () => {
  const repo = { owner: 'Me', name: 'site' };
  assert.equal(repoUrl('git@github.com:A/b.git', { repo }), 'https://github.com/A/b');
  assert.equal(repoUrl('https://github.com/A/b', { repo }), 'https://github.com/A/b');
  assert.equal(repoUrl('https://gitlab.com/A/b.git', { repo }), 'https://github.com/Me/site');
  assert.equal(repoUrl('', { repo }), 'https://github.com/Me/site');
  assert.equal(repoUrl(''), '');
});

test('a leftover site.config.mjs: not read, no warning (ewcms.config.mjs only)', async () => {
  const leftover = fs.mkdtempSync(path.join(os.tmpdir(), 'ewcms-legacy-config-'));
  fs.writeFileSync(path.join(leftover, 'site.config.mjs'), "export default { outDir: 'old' };\n");
  try {
    assert.equal('legacyConfigWarning' in siteConfig, false);
    assert.equal(loadSiteConfig(leftover).config.outDir, DEFAULTS.outDir);
    const warned = [];
    const orig = console.warn;
    console.warn = (m) => warned.push(String(m));
    try {
      await check(leftover, { lint: false });
    } finally {
      console.warn = orig;
    }
    assert.equal(warned.filter((m) => m.includes('site.config.mjs')).length, 0);
  } finally {
    fs.rmSync(leftover, { recursive: true, force: true });
  }
});
