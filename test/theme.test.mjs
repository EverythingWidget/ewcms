// The theme (ewcms.config.mjs themeDir: meta.json, tokens.scss, fonts.scss, overrides.scss): its
// part of the page head, and where loadSiteConfig finds it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { editorConfigModule, themeMetaHead, writeThemeLayers } from '../src/cli/vite-plugin-static-site.mjs';
import { loadSiteConfig, DEFAULT_SITE_THEME } from '../src/cli/site-config.mjs';
import { themeWarning } from '../src/cli/cli.mjs';
import { enginePath } from '../src/cli/engine.mjs';

const meta = {
  colorScheme: 'dark',
  preloads: [
    { href: '/fonts/a.woff2', as: 'font', type: 'font/woff2', crossorigin: true },
    { href: '/img/b.webp', as: 'image' },
  ],
};

test('themeMetaHead: theme-color and color-scheme (theme.json color), preloads', () => {
  assert.deepEqual(themeMetaHead(meta, '#050505', 'dark'), {
    meta: '<meta name="theme-color" content="#050505" />\n    <meta name="color-scheme" content="dark" />',
    preloads:
      '<link rel="preload" href="/fonts/a.woff2" as="font" type="font/woff2" crossorigin />\n    <link rel="preload" href="/img/b.webp" as="image" />',
  });
  // meta.json's own themeColor and colorScheme are not used: one source (content/theme.json)
  assert.doesNotMatch(themeMetaHead({ ...meta, themeColor: '#123456' }).meta, /theme-color/);
  assert.doesNotMatch(themeMetaHead(meta, '#050505').meta, /color-scheme/);
  assert.deepEqual(themeMetaHead({}), { meta: '', preloads: '' });
  assert.deepEqual(themeMetaHead({}, '', 'light').meta, '<meta name="color-scheme" content="light" />');
});

test('loadSiteConfig: the site theme folder, its style files and meta.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  fs.mkdirSync(path.join(root, 'theme'));
  fs.writeFileSync(path.join(root, 'theme/tokens.scss'), ':root { --bg: #fff; }\n');
  fs.writeFileSync(path.join(root, 'theme/meta.json'), JSON.stringify(meta));
  const site = loadSiteConfig(root);
  assert.equal(site.themeDir, path.join(root, 'theme'));
  assert.deepEqual(site.themeLayers, ['tokens.scss']);
  assert.deepEqual(site.themeMeta, meta); // the site's alone: the engine has no theme of its own
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
  assert.deepEqual(none.themeMeta, {});
  const stubs = writeThemeLayers(none);
  assert.doesNotMatch(fs.readFileSync(path.join(stubs, '_tokens.scss'), 'utf8'), /@use/);
  for (const d of [root, other, bare]) fs.rmSync(d, { recursive: true, force: true });
});

test('theme/theme.json is theme/meta.json: a leftover one is not read, and check names it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  fs.mkdirSync(path.join(root, 'theme'));
  fs.writeFileSync(path.join(root, 'theme/theme.json'), JSON.stringify(meta));
  const site = loadSiteConfig(root);
  assert.deepEqual(site.themeMeta, {});
  assert.equal('theme' in site, false); // `theme` is content/theme.json only
  assert.match(
    themeWarning(site),
    /theme\/theme\.json is now theme\/meta\.json .*git mv theme\/theme\.json theme\/meta\.json/,
  );
  fs.renameSync(path.join(root, 'theme/theme.json'), path.join(root, 'theme/meta.json'));
  assert.doesNotMatch(themeWarning(loadSiteConfig(root)), /theme\/theme\.json/);
  // a themeColor or colorScheme left in meta.json: named (they are content/theme.json "color" now)
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-'));
  fs.mkdirSync(path.join(other, 'theme'));
  fs.writeFileSync(
    path.join(other, 'theme/meta.json'),
    JSON.stringify({ ...meta, themeColor: '#000000' }),
  );
  assert.match(
    themeWarning(loadSiteConfig(other)),
    /theme\/meta\.json "themeColor" is not used: the theme-color is content\/theme\.json/,
  );
  // meta already has colorScheme (the fixture): named too
  assert.match(
    themeWarning(loadSiteConfig(other)),
    /theme\/meta\.json "colorScheme" is not used: the color-scheme is content\/theme\.json/,
  );
  fs.rmSync(other, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
});

test('the default site theme: every colour in its tokens; the engine styles none of its own', () => {
  const defaultSite = JSON.parse(
    fs.readFileSync(path.join(DEFAULT_SITE_THEME, 'meta.json'), 'utf8'),
  );
  assert.equal(defaultSite.version, 1);
  assert.equal(defaultSite.colorScheme, undefined);
  const defaultTheme = JSON.parse(
    fs.readFileSync(new URL('../default-site/content/theme.json', import.meta.url), 'utf8'),
  );
  assert.equal(defaultTheme.color.scheme, 'dark');
  assert.deepEqual(
    defaultSite.fonts.map((f) => f.family),
    ['DM Mono', 'Momo Trust Display'],
  );
  assert.match(defaultSite.fonts[0].fallback, /ui-monospace/);
  // what was the engine's theme-default: its chrome and the widgets' looks read the site's tokens
  const files = [
    'src/client/styles/_chrome.scss',
    'src/client/styles/_glass.scss',
    ...['hero', 'photo', 'form'].map((w) => `src/widgets/${w}/style.scss`),
  ].map((f) => enginePath(f));
  for (const f of files) {
    const code = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, f);
  }
});

test('theme/meta.json fonts: check warns when the list is missing or typography names an unknown family', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-fonts-'));
  fs.mkdirSync(path.join(root, 'theme'));
  fs.mkdirSync(path.join(root, 'content'));
  fs.writeFileSync(path.join(root, 'theme/tokens.scss'), ':root { --bg: #fff; }\n');
  // tokens incomplete: look warning, but no fonts warning without meta.json
  assert.doesNotMatch(themeWarning(loadSiteConfig(root)), /"fonts"/);
  fs.writeFileSync(path.join(root, 'theme/meta.json'), JSON.stringify({ name: 'X' }));
  assert.match(
    themeWarning(loadSiteConfig(root)),
    /meta\.json should list "fonts".*family/,
  );
  fs.writeFileSync(
    path.join(root, 'theme/meta.json'),
    JSON.stringify({
      name: 'X',
      fonts: [
        { family: 'DM Mono', fallback: 'monospace' },
        { family: 'Momo Trust Display' },
      ],
    }),
  );
  // loadSiteConfig caches per root: a new folder for the listed case
  const listed = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-fonts-'));
  fs.mkdirSync(path.join(listed, 'theme'));
  fs.mkdirSync(path.join(listed, 'content'));
  fs.writeFileSync(path.join(listed, 'theme/tokens.scss'), ':root { --bg: #fff; }\n');
  fs.writeFileSync(
    path.join(listed, 'theme/meta.json'),
    JSON.stringify({
      name: 'X',
      fonts: [
        { family: 'DM Mono', fallback: 'monospace' },
        { family: 'Momo Trust Display' },
      ],
    }),
  );
  assert.doesNotMatch(themeWarning(loadSiteConfig(listed)), /"fonts"/);
  fs.writeFileSync(
    path.join(listed, 'content/theme.json'),
    JSON.stringify({ typography: { heading: { font: 'Comic Sans' }, fonts: { body: 'Comic Sans' } } }),
  );
  const w = themeWarning(loadSiteConfig(listed));
  assert.match(
    w,
    /content\/theme\.json "typography\.heading\.font" "Comic Sans" is not a font this theme provides \(DM Mono, Momo Trust Display\)/,
  );
  assert.match(w, /"typography\.fonts\.body" "Comic Sans"/);
  fs.writeFileSync(
    path.join(listed, 'content/theme.json'),
    JSON.stringify({ typography: { heading: { font: 'DM Mono' } } }),
  );
  assert.doesNotMatch(themeWarning(loadSiteConfig(listed)), /not a font this theme provides/);
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(listed, { recursive: true, force: true });
});

test("editorConfig includes the theme's fonts list (family and stack)", () => {
  const src = editorConfigModule({
    contentRel: 'content',
    mediaUrl: '/media',
    config: { repo: {} },
    themeMeta: { fonts: [{ family: 'DM Mono', fallback: 'monospace' }] },
  });
  assert.match(src, /"family":"DM Mono"/);
  assert.match(src, /"stack":"'DM Mono', monospace"/);
  assert.match(
    editorConfigModule({ contentRel: 'c', mediaUrl: '/', config: { repo: {} } }),
    /"fonts":\[\]/,
  );
});
