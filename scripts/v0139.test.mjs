// v0.1.39: the photo widget's Fit (cover / contain) and Position (a 3 x 3 grid of spots); since
// the content-box placement (src/site/layout/place.js) its widget's box and place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { photo } from '../src/site/widgets/photo/index.js';
import { widgetVars } from '../src/site/layout/index.js';
import { PLACES } from '../src/site/layout/place.js';

const vars = (w) =>
  widgetVars({ id: 'b-1', type: 'photo', layout: { base: { col: 1, span: 10, row: 1 } }, ...w });

test('photo: no Fit / Position fields of its own; nine places row by row', () => {
  assert.ok(!photo.fields.some((f) => ['photoFit', 'photoPos'].includes(f.key)));
  assert.deepEqual(photo.placement, { media: true, fill: true, place: 'center' });
  assert.equal(PLACES.length, 9);
  assert.equal(PLACES[2][0], 'right top');
  assert.equal(PLACES[4][0], 'center');
});

test('photo: --fit / --pos from box / place, else the stylesheet (cover, centred)', () => {
  assert.doesNotMatch(vars({}), /--fit|--pos/);
  assert.match(vars({ box: 'fit', place: 'right top' }), /;--fit:contain;--pos:right top/);
  assert.match(vars({ box: 'nope', place: 'x;color:red' }), /;--fit:cover;--pos:center/);
});

test('layout: the fill reads --fit / --pos; a Rows photo widget fills its rows', () => {
  const scss = readFileSync(new URL('../src/client/styles/_layout.scss', import.meta.url), 'utf8');
  assert.match(scss, /object-fit: var\(--fit, cover\)/);
  assert.match(scss, /object-position: var\(--pos, center\)/);
  assert.match(scss, /\.wgt--photo:not\(\.wgt--auto, \.wgt--aspect\) \{[^}]*@include fill/);
});
