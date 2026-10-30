// The Image caption is edited in the settings popup only; image picking stays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { image } from '../src/site/widgets/image/index.js';

const src = readFileSync(new URL('../src/site/widgets/image/index.js', import.meta.url), 'utf8');

test('image caption has no inline-edit marker, the image keeps its picker', () => {
  assert.doesNotMatch(src, /widget\.ed\('caption'\)/);
  assert.match(src, /widget\.ed\('src', 'image'\)/);
});

test('image popup has a Caption text field', () => {
  const f = image.fields.find((x) => x.key === 'caption');
  assert.ok(f);
  assert.match(f.label, /^Caption/);
  assert.equal(f.type, undefined);
});

test('rendered caption carries no edit attribute', () => {
  const widget = { ed: (k) => ` data-ed="${k}"` };
  const out = String(image.render({ src: '', caption: 'Hi' }, {}, widget));
  assert.match(out, /<figcaption class="label muted">Hi<\/figcaption>/);
});
