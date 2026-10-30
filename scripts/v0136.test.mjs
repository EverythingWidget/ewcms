// v0.1.36: a Save marks what it sent (not what is there when it returns), a disk load equal
// once tidied isn't a change; the Media pane fits its column
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

test('the Media pane: one column, its head (Use this image) sticky', () => {
  const m = readFileSync(
    new URL('../src/editor/svelte/MediaModal.svelte', import.meta.url),
    'utf8',
  );
  assert.match(m, /\.md-detail \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(m, /\.md-detail__head \{[^}]*position: sticky/);
});

test('the dev server tells the editor’s own writes apart by their content', () => {
  const p = readFileSync(new URL('./vite-plugin-static-site.mjs', import.meta.url), 'utf8');
  assert.match(p, /ownWrites/);
  assert.match(p, /server: \{ fs: \{ allow: engineAllow/);
});
