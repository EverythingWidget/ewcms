import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/editor/store.js';

import { appendImages } from '../src/editor/lib/image-list.js';

test('multi-pick: images appended in pick order, as items or keys; one undo step', () => {
  assert.deepEqual(appendImages(['a'], ['c', 'b']), ['a', 'c', 'b']);
  assert.deepEqual(appendImages(undefined, ['x']), ['x']);
  const item = { src: '', layer: 'front' };
  const out = appendImages([{ src: 'a' }], ['c', 'b'], { item, image: 'src' });
  assert.deepEqual(out, [{ src: 'a' }, { src: 'c', layer: 'front' }, { src: 'b', layer: 'front' }]);
  assert.equal(item.src, ''); // the template untouched
  const store = createStore();
  const F = 'pages/x/index.json';
  store.load({
    [F]: { version: 1, kind: 'page', id: 'pg-t200', backdrop: { transition: 'fade' } },
  });
  store.set(F, '/backdrop/images', appendImages(store.get(F, '/backdrop/images'), ['p1', 'p2']));
  assert.deepEqual(store.get(F, '/backdrop'), { transition: 'fade', images: ['p1', 'p2'] });
  store.undo();
  assert.deepEqual(store.get(F, '/backdrop'), { transition: 'fade' });
});
