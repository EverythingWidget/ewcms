// F80: a failed save went unnoticed and a reload threw the whole List build away. Unsaved edits
// are copied to localStorage per site and file (draft-copy.js) and offered back on load; a failed
// save is a window that stays until dismissed. Not autosave: content/ changes only on Ctrl+S.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/editor/store.js';
import {
  applyDraft,
  clearDraft,
  draftKey,
  hashOf,
  readDraft,
  writeDraft,
} from '../src/editor/draft-copy.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const F = 'pages/galerij/index.json';
const H = 'header.json';
const files = () => ({
  [F]: { version: 1, kind: 'page', id: 'pg-t080', sections: [] },
  [H]: { version: 1, header: [] },
});
const memory = () => {
  const m = new Map();
  return {
    m,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};
const KEY = draftKey('http://localhost:5173', 'Unic Derma');

test('F80: unsaved edits copied per site and file; nothing unsaved: no copy', () => {
  assert.notEqual(draftKey('http://localhost:5173', 'A'), draftKey('http://localhost:5173', 'B'));
  const store = createStore();
  store.load(files());
  const s = memory();
  assert.deepEqual(writeDraft(store, s, KEY), []);
  assert.equal(s.m.size, 0);
  store.set(F, '/sections', [{ id: 's-aaaa', widgets: [{ id: 'w-aaaa', type: 'list' }] }]);
  assert.deepEqual(writeDraft(store, s, KEY, { now: 5, page: '/galerij/' }), [F]);
  const d = readDraft(s, KEY);
  assert.equal(d.t, 5);
  assert.equal(d.page, '/galerij/');
  assert.deepEqual(Object.keys(d.files), [F]);
  assert.equal(d.files[F].base, hashOf(files()[F]));
  // saved: the copy goes
  store.markSaved([F]);
  writeDraft(store, s, KEY);
  assert.equal(readDraft(s, KEY), null);
});

test('F80: a reload offers the copy back; Restore puts it back unsaved, one undo step', () => {
  const s = memory();
  const before = createStore();
  before.load(files());
  before.set(F, '/sections', [{ id: 's-aaaa', widgets: [{ id: 'w-aaaa', type: 'list' }] }]);
  before.set(H, '/header', [{ label: 'Galerij', page: 'pg-t080' }]);
  writeDraft(before, s, KEY);
  // the reload: the files from disk, the edits gone from memory
  const store = createStore();
  store.load(files());
  const { restored, skipped } = applyDraft(store, readDraft(s, KEY));
  assert.deepEqual(restored.sort(), [F, H].sort());
  assert.deepEqual(skipped, []);
  assert.deepEqual(store.current[F], before.current[F]);
  assert.deepEqual(store.dirtyFiles().sort(), [F, H].sort()); // unsaved, not saved
  store.undo();
  assert.deepEqual(store.dirtyFiles(), []);
});

test('F80: a file changed on disk since is not put back; Discard clears the copy', () => {
  const s = memory();
  const before = createStore();
  before.load(files());
  before.set(F, '/meta', { title: 'Galerij' });
  before.set(H, '/header', [{ label: 'X', page: 'pg-t080' }]);
  writeDraft(before, s, KEY);
  const store = createStore();
  store.load({ ...files(), [F]: { ...files()[F], curtainText: 'changed on disk' } });
  const { restored, skipped } = applyDraft(store, readDraft(s, KEY));
  assert.deepEqual(restored, [H]);
  assert.deepEqual(skipped, [F]);
  assert.equal(store.current[F].meta, undefined);
  clearDraft(s, KEY);
  assert.equal(readDraft(s, KEY), null);
  // a broken copy is no copy
  s.setItem(KEY, '{nope');
  assert.equal(readDraft(s, KEY), null);
});

test('F80: storage full or blocked: nothing thrown, nothing kept', () => {
  const store = createStore();
  store.load(files());
  store.set(F, '/meta', { title: 'x' });
  const full = {
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {},
    getItem: () => null,
  };
  assert.deepEqual(writeDraft(store, full, KEY), []);
});

test('F80: a failed save is a window until dismissed (not a toast); the copy is wired, no autosave', () => {
  const main = read('src/editor/main.js');
  const save = main.slice(
    main.indexOf('async function save('),
    main.indexOf(
      '// ---------------------------------------------------------------- changes on disk',
    ),
  );
  assert.match(save, /openSaveFailed\(\{ message: err\.message, files: dirty \}\)/);
  assert.doesNotMatch(save, /toast\(`Save failed/);
  // the copy: written on edits, cleared by a save that leaves nothing unsaved or by Discard
  assert.match(main, /store\.on\(\(\) => \{\s*clearTimeout\(copyTimer\);/);
  assert.match(main, /function discardDraft\(\) \{[^}]*clearDraft\(localStorage, draftAt\)/);
  assert.match(main, /readDraft\(localStorage, draftAt\)/);
  // never a save of its own: only save() calls dataLayer.save
  assert.equal(main.match(/dataLayer\.save\(/g).length, 1);
  assert.match(main, /offering = true;\s*openUnsavedEdits\(\{/);
  const failed = read('src/editor/svelte/SaveFailedModal.svelte');
  assert.match(failed, /role="alertdialog"/);
  assert.match(failed, /\{@attach modal\('saveFailed'\)\}/);
  const offer = read('src/editor/svelte/UnsavedEditsModal.svelte');
  assert.match(offer, /pick\(args\.onrestore\)/);
  assert.match(offer, /pick\(args\.ondiscard\)/);
  assert.match(offer, /oncancel=\{\(e\) => e\.preventDefault\(\)\}/);
});
