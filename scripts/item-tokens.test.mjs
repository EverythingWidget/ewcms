// Item theme tokens (--item-*): what a list's items look like, themeable; today's look by default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sass from 'sass';

const dir = (p) => new URL(p, import.meta.url).pathname;
const css = sass.compileString("@use 'tokens';", {
  loadPaths: [dir('../theme-default/styles/')],
  importers: [
    {
      findFileUrl: (u) =>
        u.startsWith('site-core/')
          ? new URL(`../src/client/styles/_${u.slice(10)}.scss`, import.meta.url)
          : null,
    },
  ],
}).css;
const root = Object.fromEntries(
  [...css.matchAll(/(--item-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
);

test('the theme defines every item token', () => {
  for (const k of [
    'radius',
    'border',
    'shadow',
    'shadow-s',
    'shadow-m',
    'shadow-l',
    'pad',
    'pad-s',
    'pad-m',
    'pad-l',
    'gap',
    'bg',
    'bg-hover',
  ])
    assert.ok(root[`--item-${k}`], `--item-${k}`);
});

test("the defaults are today's cards: no box, 4px radius, 16px gap; paddings on the 4px grid", () => {
  assert.equal(root['--item-radius'], '4px');
  assert.equal(root['--item-gap'], '16px');
  assert.deepEqual(
    [root['--item-border'], root['--item-shadow'], root['--item-pad'], root['--item-bg']],
    ['none', 'none', '0', 'transparent'],
  );
  assert.equal(root['--item-bg-hover'], 'var(--item-bg)');
  for (const k of ['pad-s', 'pad-m', 'pad-l'])
    assert.equal(parseInt(root[`--item-${k}`]) % 4, 0, k);
});
