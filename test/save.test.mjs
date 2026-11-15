// Save: what a Save marks as saved, and the dev server telling the editor's own writes apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';

const FILE = 'pages/index.json';
const page = () => ({ version: 1, kind: 'page', id: 'pg-a', title: 'A', sections: [] });

test('an edit made while a Save runs stays unsaved', () => {
  const store = createStore();
  store.load({ [FILE]: page() });
  store.set(FILE, '/title', 'B');
  const sent = { [FILE]: structuredClone(store.current[FILE]) };
  store.set(FILE, '/title', 'C'); // typed while the request runs
  store.markSaved([FILE], sent);
  assert.deepEqual(store.dirtyFiles(), [FILE]);
  assert.equal(store.base[FILE].title, 'B');
});

test('a Save with nothing typed meanwhile leaves nothing unsaved', () => {
  const store = createStore();
  store.load({ [FILE]: page() });
  store.set(FILE, '/title', 'B');
  store.markSaved([FILE], { [FILE]: structuredClone(store.current[FILE]) });
  assert.deepEqual(store.dirtyFiles(), []);
  // the saved file coming back from disk: no change, the undo history kept
  assert.deepEqual(store.rebase({ [FILE]: structuredClone(store.current[FILE]) }), []);
});

test('the dev server tells the editor’s own writes apart by their content', () => {
  const p = readFileSync(
    new URL('../src/cli/vite-plugin-static-site.mjs', import.meta.url),
    'utf8',
  );
  assert.match(p, /ownWrites/);
  assert.match(p, /server: \{ fs: \{ allow: engineAllow/);
});

test('store.batch inside a batch joins it: one undo step, no error (F20: Custom to None)', () => {
  const store = createStore();
  store.load({ 'a.json': { x: 1, y: 1, z: 1 } });
  store.batch(() => {
    store.set('a.json', '/x', 2);
    store.batch(() => store.set('a.json', '/y', 2));
    store.set('a.json', '/z', 2);
  });
  assert.deepEqual(store.current['a.json'], { x: 2, y: 2, z: 2 });
  store.undo();
  assert.deepEqual(store.current['a.json'], { x: 1, y: 1, z: 1 });
});

test('deleting one section marks no other section changed (F10: the changed dot)', () => {
  const store = createStore();
  const sec = (id) => ({ id, widgets: [] });
  store.load({ [FILE]: { ...page(), sections: [sec('s-a'), sec('s-b'), sec('s-c')] } });
  store.remove(FILE, '/sections/0');
  assert.equal(store.changedItem(FILE, '/sections', 's-b'), false);
  assert.equal(store.changedItem(FILE, '/sections', 's-c'), false);
  assert.equal(store.changedAt(FILE, '/sections/0'), true); // by index it would be
  store.set(FILE, '/sections/0/name', 'B');
  assert.equal(store.changedItem(FILE, '/sections', 's-b'), true);
});
