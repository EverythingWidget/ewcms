// v0.1.34: the Hero's Style (beside | behind | scattered; scattered when unset)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sass from 'sass';
import { hero, HERO_STYLES } from '../src/site/widgets/hero/index.js';
import { bindTypeOf } from '../src/site/layout/bindings.js';

const ctx = { site: { name: 'Site' }, media: {}, strings: {}, lang: 'en' };
const b = { ed: () => '' };
const photos = [
  { src: '', x: 1, y: 1, w: 10 },
  { src: 'a/one.jpg', x: 10, y: 10, w: 16, depth: 1 },
  { src: 'a/two.jpg', x: 50, y: 20, w: 16, depth: 1 },
];
const out = (s) => hero.render({ title: 'Noor', photos, ...s }, ctx, b);

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
  assert.doesNotMatch(hero.render({ style: 'beside', photos: [] }, ctx, b), /hero__photo"/);
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
