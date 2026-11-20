import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickVariants, variantFile } from '../sandbox/kit/variants.js';

const VARIANTS = [{ name: 'few' }, { name: 'many', props: { pages: 'many' } }];

test('a mock without variants is drawn once, as before', () => {
  assert.deepEqual(pickVariants(undefined), [{ name: null, props: {} }]);
  assert.deepEqual(pickVariants([], 'few'), [{ name: null, props: {} }]);
});

test('variants: all of them, or the one asked for; an unknown one is an error', () => {
  assert.deepEqual(
    pickVariants(VARIANTS).map((v) => [v.name, v.props]),
    [
      ['few', {}],
      ['many', { pages: 'many' }],
    ],
  );
  assert.deepEqual(pickVariants(VARIANTS, 'many'), [{ name: 'many', props: { pages: 'many' } }]);
  assert.throws(
    () => pickVariants(VARIANTS, 'some', 'siteparts'),
    /No variant "some" in siteparts/,
  );
});

test("a variant's PNG: -<variant> before .png (also on --out paths without .png)", () => {
  assert.equal(variantFile('/m/siteparts.png', 'few'), '/m/siteparts-few.png');
  assert.equal(variantFile('/m/shot', 'many'), '/m/shot-many.png');
  assert.equal(variantFile('/m/siteparts.png', ''), '/m/siteparts.png');
});
