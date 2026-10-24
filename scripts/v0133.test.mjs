// v0.1.33: a long hero name wraps between words and its longest word fits the screen
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sass from 'sass';
import { longestWord } from '../src/site/widgets/hero/index.js';

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
