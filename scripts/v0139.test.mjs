// v0.1.39: the image widget's Fit (cover / contain) and Position (a 3 x 3 grid of spots); since
// the content-box placement (src/site/layout/place.js) its widget's box and place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { image } from '../src/site/widgets/image/index.js';
import { widgetVars } from '../src/site/layout/index.js';
import { PLACES } from '../src/site/layout/place.js';

const vars = (w) =>
  widgetVars({ id: 'w-1', type: 'image', layout: { base: { col: 1, span: 10, row: 1 } }, ...w });

test('image: no Fit / Position fields of its own; nine places row by row', () => {
  assert.ok(!image.fields.some((f) => ['photoFit', 'photoPos'].includes(f.key)));
  assert.deepEqual(image.placement, { media: true, fill: true, place: 'center' });
  assert.equal(PLACES.length, 9);
  assert.equal(PLACES[2][0], 'right top');
  assert.equal(PLACES[4][0], 'center');
});

test('image: --fit / --pos from box / place, else the stylesheet (cover, centred)', () => {
  assert.doesNotMatch(vars({}), /--fit|--pos/);
  assert.match(vars({ box: 'fit', place: 'right top' }), /;--fit:contain;--pos:right top/);
  assert.match(vars({ box: 'nope', place: 'x;color:red' }), /;--fit:cover;--pos:center/);
});

test('layout: the fill reads --fit / --pos; a Rows image widget fills its rows', () => {
  const scss = readFileSync(new URL('../src/client/styles/_layout.scss', import.meta.url), 'utf8');
  assert.match(scss, /object-fit: var\(--fit, cover\)/);
  assert.match(scss, /object-position: var\(--pos, center\)/);
  assert.match(scss, /\.wgt--image:not\(\.wgt--auto, \.wgt--aspect\) \{[^}]*@include fill/);
});
