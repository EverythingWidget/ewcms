// A selected field (.tf.is-selected): no blue fill, a whitish label, the one focus ring on the input.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/editor/styles/editor.scss', import.meta.url), 'utf8');
const block = (sel) => {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, sel);
  let d = 0;
  for (let j = css.indexOf('{', i); j < css.length; j++) {
    if (css[j] === '{') d++;
    if (css[j] === '}' && --d === 0) return css.slice(i, j + 1);
  }
};

test('selected field has no background or accent', () => {
  const b = block('.tf.is-selected');
  assert.doesNotMatch(b, /background|c-accent/);
  assert.match(b, /\.tf__label \{\s*color: var\(--text-strong\);/);
  assert.match(b, /\.tf__input \{\s*box-shadow: var\(--focus-ring\);/);
});

test('field rows carry no fill transition and the accent-bg token is gone', () => {
  assert.doesNotMatch(block('.tf'), /transition/);
  const tokens = readFileSync(
    new URL('../src/editor/styles/_tokens.scss', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(tokens + css, /--c-accent-bg/);
});
