// v0.1.39: the photo widget's Fit (cover / contain) and Position (a 3 x 3 grid of spots).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { photo, PHOTO_FITS, PHOTO_SPOTS } from '../src/site/widgets/photo/index.js';

const ctx = { site: {}, media: {} };
const b = { ed: () => '' };
const styleOf = (s) => /style="([^"]*)"/.exec(photo.render({ src: '', ...s }, ctx, b))[1];

test('photo: Fit and Position fields, nine spots row by row', () => {
  const keys = photo.fields.map((f) => [f.key, f.type]);
  assert.deepEqual(keys.slice(-2), [
    ['photoFit', 'seg'],
    ['photoPos', 'spot'],
  ]);
  assert.deepEqual(
    PHOTO_FITS.map(([v]) => v),
    ['cover', 'contain'],
  );
  assert.equal(PHOTO_SPOTS.length, 9);
  assert.equal(PHOTO_SPOTS[2][0], 'right top');
  assert.equal(PHOTO_SPOTS[4][0], 'center');
});

test('photo: --fit / --pos from photoFit / photoPos, else cover, centred', () => {
  assert.equal(styleOf({}), '--fit:cover;--pos:center');
  assert.equal(
    styleOf({ photoFit: 'contain', photoPos: 'right top' }),
    '--fit:contain;--pos:right top',
  );
  assert.equal(styleOf({ photoFit: 'nope', photoPos: 'x;color:red' }), '--fit:cover;--pos:center');
});

test('layout: the fill reads --fit / --pos; a Rows photo widget fills its rows', () => {
  const scss = readFileSync(new URL('../src/client/styles/_layout.scss', import.meta.url), 'utf8');
  assert.match(scss, /object-fit: var\(--fit, cover\)/);
  assert.match(scss, /object-position: var\(--pos, center\)/);
  assert.match(scss, /\.wgt--photo:not\(\.wgt--auto, \.wgt--aspect\) \{[^}]*@include fill/);
});
