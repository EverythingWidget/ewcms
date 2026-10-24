// v0.1.31: a text widget's text fills the widget's width (no reading measure inside the grid)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sass from 'sass';

test('inside a widget no text style keeps a max-width (64ch / 1280px are for outside text)', () => {
  const css = sass.compile(new URL('../src/client/styles/_layout.scss', import.meta.url).pathname, {
    loadPaths: [new URL('../src/client/styles/', import.meta.url).pathname],
  }).css;
  assert.match(css, /\.wgt \.ts \{\s*max-width: none;/);
  const text = readFileSync(new URL('../src/client/styles/_text.scss', import.meta.url), 'utf8');
  // .wgt .ts (0,2,0) outranks every .ts--style (0,1,0) that sets one
  for (const m of text.matchAll(/^\.(ts--[a-z]+) \{[^}]*max-width/gm)) assert.ok(m[1]);
});
