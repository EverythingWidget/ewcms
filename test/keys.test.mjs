// The editor's keyboard shortcuts, all in one place (src/editor/keys.js): the editor's window
// and the preview's forwarded keys go through one handler; no other file listens for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

/** keys.js loaded with its imports stubbed: `calls` records what each key did. */
async function loadKeys() {
  const code = src('keys.js').replace(/^import [\s\S]*?from '[^']+';\n/gm, '');
  const stubs = `
    export const calls = [];
    export const ui = { mod: false, link: null, widget: null, multi: [], picked: null, section: null, selSection: null, target: null, viewport: 'desktop' };
    export const state = { clicks: 'arrange', modal: null };
    const previewClicks = () => state.clicks;
    const pickElement = (el) => calls.push(['pick', el]);
    const selectLink = (id) => calls.push(['selectLink', id]);
    const selectWidgets = (ids) => calls.push(['selectWidgets', ids]);
    const deselect = () => calls.push(['deselect']);
    const setMod = (on) => ((ui.mod = on), calls.push(['mod', on]));
    const closeModal = () => calls.push(['closeModal']);
    const topModal = () => state.modal;
    const undoToast = (s, msg) => calls.push(['toast', msg]);
    const layerWidget = (s, f, at, j, d) => calls.push(['layer', d]);
    const removeWidgets = (s, f, at, ids) => (calls.push(['remove', ids]), true);
    const targetFile = () => 'pages/index.json';
    const nudgeStep = (big) => (big ? 4 : 1);
    const selectedIds = (u) => (u.multi.length ? u.multi : u.widget ? [u.widget] : []);
    class Element {}
    globalThis.document ??= {};
  `;
  const f = join(mkdtempSync(join(tmpdir(), 'keys-')), 'keys.mjs');
  writeFileSync(f, stubs + code);
  return import(f);
}

/** A keydown as the handler sees it (target: a node that is no field). */
function key(k, mods = {}, target = { closest: () => null }) {
  const e = { key: k, target, defaultPrevented: false, ...mods };
  e.preventDefault = () => (e.defaultPrevented = true);
  return e;
}

test('keys: one handler, in the editor window and for the preview (its forwarded keys)', () => {
  const main = src('main.js');
  assert.match(main, /const onKey = createKeys\(\{ store, bridge, overlay, save, widgetAt \}\);/);
  assert.match(main, /window\.addEventListener\('keydown', onKey\);\s*bridge\.on\('key', onKey\);/);
  assert.match(main, /watchMod\(window\);/);
  assert.match(
    main,
    /pointer\.attach\(bridge\.doc\.defaultView\);\s*watchMod\(bridge\.doc\.defaultView\);/,
  );
  // no second dispatcher, Ctrl/Cmd tracker or Delete-link handler elsewhere
  assert.doesNotMatch(main, /function selectionKey|const trackMod|overlay\.deleteLink\(\)/);
  const app = src('svelte/App.svelte');
  assert.doesNotMatch(app, /function onKey|onkeydown=|bridge\.on\('key'/);
  // (the overlay and its parts: overlay-*.js)
  for (const f of readdirSync(new URL('../src/editor/', import.meta.url)).filter((n) =>
    /^overlay(-[\w-]+)?\.js$/.test(n),
  )) {
    assert.doesNotMatch(src(f), /trackMod|function onkeydown|addEventListener\('keyup'/, f);
    assert.doesNotMatch(src(f), /setMod/, f);
  }
  // preview-edit.js attach() forwards what keys.js calls a shortcut
  assert.match(src('preview-edit.js'), /import \{ isShortcut \} from '\.\/keys\.js';/);
  for (const f of ['preview-runtime.js', 'preview-edit.js', 'preview-pointer.js'])
    assert.doesNotMatch(src(f), /const isShortcut =|const typing =/, f);
  // the order: a selected link's Delete, the selection's keys, then the app's
  assert.match(src('keys.js'), /linkKey\(e\);\s*selectionKey\(e\);\s*appKey\(e\);/);
});

test("keys: isShortcut forwards the editor's keys, never a key typed into text", async () => {
  const { isShortcut, typing } = await loadKeys();
  const field = { closest: (s) => (/input|contenteditable/.test(s) ? {} : null) };
  assert.ok(isShortcut(key('z', { ctrlKey: true })));
  assert.ok(isShortcut(key('K', { metaKey: true })));
  assert.ok(isShortcut(key('Escape', {}, field)));
  assert.ok(isShortcut(key('ArrowLeft')));
  assert.ok(isShortcut(key('a')));
  assert.ok(isShortcut(key('[')));
  for (const k of ['a', 'Enter', 'ArrowLeft', 'Delete', ']'])
    assert.ok(!isShortcut(key(k, {}, field)), k);
  assert.ok(!isShortcut(key('b', { ctrlKey: true })));
  assert.ok(typing(field) && !typing(null) && !typing({ closest: () => null }));
});

test('keys: Delete removes the selected link (here or in the preview), then nothing else', async () => {
  const { createKeys, ui, calls } = await loadKeys();
  let deleted = 0;
  const onKey = createKeys({
    store: {},
    bridge: { path: () => '/', doc: null, editWidget: () => false },
    overlay: { deleteLink: () => deleted++, nudge: () => true },
    save: () => calls.push(['save']),
    widgetAt: () => ({ file: 'f', at: 0, j: 0 }),
  });
  Object.assign(ui, { link: 'w-2', widget: 'w-1', multi: ['w-1', 'w-3'] });
  const e = key('Delete');
  onKey(e);
  assert.equal(deleted, 1);
  assert.ok(e.defaultPrevented);
  assert.deepEqual(calls, []); // the widgets stay
  // typing in a field: the field's own Delete
  onKey(key('Delete', {}, { closest: () => ({}) }));
  assert.equal(deleted, 1);
});

test('keys: Esc closes the modal in front, else drops the selection; a Header stays open', async () => {
  const { createKeys, ui, state, calls } = await loadKeys();
  const onKey = createKeys({
    store: {},
    bridge: { path: () => '/', doc: null, editWidget: () => false },
    overlay: { deleteLink: () => {}, nudge: () => false },
    save: () => {},
    widgetAt: () => null,
  });
  state.modal = 'media';
  onKey(key('Escape'));
  assert.deepEqual(calls.splice(0), [['closeModal']]);
  state.modal = null;
  Object.assign(ui, { widget: 'w-1', picked: { el: {} } });
  onKey(key('Escape'));
  assert.deepEqual(calls.splice(0), [['pick', null], ['deselect']]);
  // browse clicks: the pick only
  state.clicks = 'visitor';
  onKey(key('Escape'));
  assert.deepEqual(calls.splice(0), [['pick', null]]);
});

test('keys: Ctrl+S saves, Ctrl+Z undoes, Ctrl+Shift+Z / Ctrl+Y redo; Enter types into a picked Text', async () => {
  const { createKeys, ui, calls } = await loadKeys();
  const store = { undo: () => calls.push(['undo']), redo: () => calls.push(['redo']) };
  const typed = [];
  const onKey = createKeys({
    store,
    bridge: { path: () => '/', doc: null, editWidget: (id, t) => (typed.push([id, t]), true) },
    overlay: { deleteLink: () => {}, nudge: () => false },
    save: () => calls.push(['save']),
    widgetAt: () => null,
  });
  onKey(key('s', { ctrlKey: true }));
  onKey(key('z', { metaKey: true }));
  onKey(key('Z', { ctrlKey: true, shiftKey: true }));
  onKey(key('y', { ctrlKey: true }));
  assert.deepEqual(calls.splice(0), [['save'], ['undo'], ['redo'], ['redo']]);
  ui.widget = 'w-9';
  const e = key('Enter');
  onKey(e);
  onKey(key('q'));
  assert.deepEqual(typed, [
    ['w-9', ''],
    ['w-9', 'q'],
  ]);
  assert.ok(e.defaultPrevented);
});

test('keys: Ctrl/Cmd held is tracked in one place, for both windows', async () => {
  const { watchMod, ui } = await loadKeys();
  const on = {};
  const win = {
    document: { addEventListener: (t, fn, capture) => (on[t] = [fn, capture]) },
    addEventListener: (t, fn) => (on[`win:${t}`] = [fn]),
  };
  watchMod(win);
  assert.equal(on.keydown[1], true);
  on.keydown[0]({ ctrlKey: true });
  assert.equal(ui.mod, true);
  on.keyup[0]({ ctrlKey: false, metaKey: false });
  assert.equal(ui.mod, false);
  on.keydown[0]({ metaKey: true });
  on['win:blur'][0]();
  assert.equal(ui.mod, false);
});
