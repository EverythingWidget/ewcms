// The Hero widget: its Style, the longest word, its widget area, an empty Hero rendering.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { longestWord, hero, HERO_STYLES } from '../src/site/widgets/hero/index.js';
import { bindTypeOf } from '../src/site/layout/bindings.js';
import { createStore } from '../src/editor/store.js';
import { addSection, addWidget } from '../src/editor/layout-ops.js';
import { renderOp } from './editor-server.mjs';
import * as render from '../src/site/render.js';

const ctx = { site: { name: 'Site' }, media: {}, strings: {}, lang: 'en' };
const widget = { ed: () => '' };
const photos = [
  { src: '', x: 1, y: 1, w: 10 },
  { src: 'a/one.jpg', x: 10, y: 10, w: 16, depth: 1 },
  { src: 'a/two.jpg', x: 50, y: 20, w: 16, depth: 1 },
];
const out = (s) => hero.render({ title: 'Noor', photos, ...s }, ctx, widget);
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const block = (css, sel) =>
  css.slice(css.indexOf(`${sel} {`), css.indexOf('\n}', css.indexOf(`${sel} {`)));
const SITE_A = path.join(path.dirname(fileURLToPath(import.meta.url)), '../test/fixtures/site-a');

test('longestWord: characters in the longest word (accents count once)', () => {
  assert.equal(longestWord('Onafhankelijke Tesla-garage in België'), 14);
  assert.equal(longestWord('Eeliya Rasta'), 6);
  assert.equal(longestWord('België'), 6);
  assert.equal(longestWord(''), 1);
});

test('the theme wraps the name and caps its size by the longest word', () => {
  const dir = new URL('../', import.meta.url).pathname;
  const src = readFileSync(`${dir}theme-default/styles/_home.scss`, 'utf8').replace(
    "@use 'site-core/tokens' as *;",
    '$bp-sm: 640px;',
  );
  const css = sass.compileString(src).css;
  const rule = (sel) => css.match(new RegExp(`${sel} \\{([^}]*)\\}`))[1];
  assert.match(rule('\\.hero__name'), /flex-wrap: wrap/);
  assert.doesNotMatch(rule('\\.hero__name'), /nowrap/);
  // the old size stays the upper bound: short names look the same
  assert.match(
    rule('\\.hero__title'),
    /font-size: min\(clamp\(64px, 14\.2vw, 270px\), (calc)?\(100vw - 2 \* var\(--pad\)\) \/ \(var\(--hero-word, 1\) \* 0\.6\)\)/,
  );
});

test('the Style field: a button group, scattered when unset, nothing to bind', () => {
  const f = hero.fields[0];
  assert.deepEqual([f.key, f.type, f.unset], ['style', 'seg', 'scattered']);
  assert.deepEqual(
    HERO_STYLES.map(([v]) => v),
    ['beside', 'behind', 'scattered'],
  );
  assert.equal(hero.fields[1].key, 'title'); // its own row, above Name
  assert.equal(bindTypeOf(f), null);
  assert.equal(hero.defaults.style, 'scattered');
});

test('unset or unknown: the scattered hero as before', () => {
  for (const s of [{}, { style: 'nope' }, { style: 'scattered' }]) {
    const h = out(s);
    assert.match(h, /class="hero hero--scattered"/);
    assert.equal((h.match(/class="scatter /g) || []).length, 2);
    assert.doesNotMatch(h, /hero__photo"/);
  }
});

test('beside / behind: the first photo with a file, alone, no scatter', () => {
  for (const look of ['beside', 'behind']) {
    const h = out({ style: look });
    assert.match(h, new RegExp(`class="hero hero--${look}"`));
    assert.match(h, /class="hero__photo"/);
    assert.match(h, /one/);
    assert.doesNotMatch(h, /two|scatter/);
  }
  assert.doesNotMatch(hero.render({ style: 'beside', photos: [] }, ctx, widget), /hero__photo"/);
});

test('the theme lays out beside (right half, 4px corners) and behind (gradient)', () => {
  const src = readFileSync(new URL('../theme-default/styles/_home.scss', import.meta.url), 'utf8');
  const css = sass.compileString(
    src.replace("@use 'site-core/tokens' as *;", '$bp-sm: 640px;'),
  ).css;
  assert.match(css, /\.hero--beside \.hero__photo \{[^}]*border-radius: 4px/);
  assert.match(css, /\.hero--beside \.hero__photo \{[^}]*width: calc\(50% - var\(--pad\) - 12px\)/);
  assert.match(
    css,
    /linear-gradient\(to top, var\(--shade-78\) 0%, var\(--shade-45\) 55%, var\(--shade-15\) 100%\)/,
  );
  assert.match(css, /@media \(max-width: 640px\)[^@]*\.hero--beside \.hero__title/);
});

test('the hero takes its widget area; an Auto hero what its section leaves', () => {
  const home = read('theme-default/styles/_home.scss');
  const hero = block(home, '\n.hero');
  assert.match(hero, /height: 100%;/);
  assert.doesNotMatch(hero, /svh|min-height/);
  assert.match(
    block(home, '.wgt--auto > .hero'),
    /min-height: calc\(var\(--sec-h, 100svh\) - var\(--nav-h, 0px\)\)/,
  );
  const layout = read('src/client/styles/_layout.scss');
  for (const h of ['third', 'half', 'full'])
    assert.match(layout, new RegExp(`&--h-${h} \\{\\s*--sec-h: `));
});

test('an unfilled Hero renders in the preview; no path is a plain error', () => {
  const file = 'pages/about/index.json';
  const data = JSON.parse(read('test/fixtures/site-a/content/en/pages/about/index.json'));
  const store = createStore();
  store.load({ [file]: data });
  addSection(store, file);
  const at = store.current[file].sections.length - 1;
  addWidget(store, file, at, 'hero');
  const s = store.current[file].sections[at];
  const r = renderOp(
    render,
    SITE_A,
    {},
    { path: '/about/', file, data: store.current[file], ids: [s.id] },
  );
  assert.equal(r.status, 200);
  assert.match(r.body.html[s.id], /class="hero hero--scattered"/);
  const none = renderOp(
    render,
    SITE_A,
    {},
    { path: null, file, data: store.current[file], ids: [s.id] },
  );
  assert.equal(none.status, 400);
  assert.equal(none.body.error, 'No page path');
  // the editor doesn't ask while the preview has no page (reloading)
  assert.match(
    read('src/editor/main.js'),
    /if \(!path \|\| !file \|\| !root\.isConnected\) return;/,
  );
});
