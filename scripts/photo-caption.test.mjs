// The Photo caption is edited in the settings popup only; photo picking stays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { photo } from '../src/site/widgets/photo/index.js';

const src = readFileSync(new URL('../src/site/widgets/photo/index.js', import.meta.url), 'utf8');

test('photo caption has no inline-edit marker, the photo keeps its picker', () => {
  assert.doesNotMatch(src, /widget\.ed\('caption'\)/);
  assert.match(src, /widget\.ed\('src', 'image'\)/);
});

test('photo popup has a Caption text field', () => {
  const f = photo.fields.find((x) => x.key === 'caption');
  assert.ok(f);
  assert.match(f.label, /^Caption/);
  assert.equal(f.type, undefined);
});

test('rendered caption carries no edit attribute', () => {
  const widget = { ed: (k) => ` data-ed="${k}"` };
  const out = String(photo.render({ src: '', caption: 'Hi' }, {}, widget));
  assert.match(out, /<figcaption class="label muted">Hi<\/figcaption>/);
});
