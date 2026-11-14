// Unsaved edits kept over a dev-server reload (keep-unsaved.js); content writes never full-reload.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';
import { addSection } from '../src/editor/layout-ops.js';
import { KEY, keepUnsaved, keptForReload, restoreUnsaved } from '../src/editor/keep-unsaved.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const F = 'pages/index.json';
const fresh = () => {
  const store = createStore();
  store.load({ [F]: { version: 1, kind: 'page', id: 'pg-t145', sections: [] } });
  return store;
};
const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};

test('unsaved edits kept over a dev-server reload, put back as one undo step', () => {
  const store = fresh();
  addSection(store, F, 'photo');
  store.markSaved([F]);
  store.set(F, '/meta', { title: 'Typed, not saved' });
  const s = memory();
  assert.equal(keptForReload(), false);
  assert.equal(keepUnsaved(store, s, 1000), true);
  assert.equal(keptForReload(), true); // no "Reload site?" prompt now
  const saved = structuredClone(store.base);
  const next = createStore();
  next.load(saved);
  assert.deepEqual(restoreUnsaved(next, s, 2000), [F]);
  assert.equal(next.current[F].meta.title, 'Typed, not saved');
  assert.deepEqual(next.dirtyFiles(), [F]);
  assert.equal(s.getItem(KEY), null); // once
  next.undo();
  assert.equal(next.current[F].meta, undefined);
  // stale (another visit): dropped
  keepUnsaved(store, s, 0);
  const later = createStore();
  later.load(saved);
  assert.deepEqual(restoreUnsaved(later, s, 120_000), []);
  // nothing unsaved: nothing kept
  assert.equal(keepUnsaved(later, memory()), false);
});

test('content writes never full-reload; the editor wires the keep', () => {
  const plugin = read('scripts/vite-plugin-static-site.mjs');
  assert.match(plugin, /if \(content\) return \[\];/);
  const main = read('src/editor/main.js');
  assert.match(main, /vite:beforeFullReload', \(\) => keepUnsaved\(store, sessionStorage\)/);
  assert.match(main, /restoreUnsaved\(store, sessionStorage\)/);
  assert.match(read('src/editor/svelte/App.svelte'), /!keptForReload\(\)/);
});
