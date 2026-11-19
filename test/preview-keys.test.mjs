// The preview's keys go through keys.js as the editor's do (preview-edit.js attach() forwards
// them, 'key'): the arrows nudge the picked widgets, Enter or a letter edits a picked Text; a
// text edited in place keeps its arrows (the caret) and Enter. The forward runs before the
// key's preventDefault, so keys.js sees it as one pressed in the editor (G14 kept: the
// browser's own action is still prevented).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
    import { readFile } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';
    import { compileModule } from '${import.meta.resolve('svelte/compiler')}';
    export async function load(url, context, next) {
      if (!url.endsWith('.svelte.js')) return next(url, context);
      const file = fileURLToPath(url);
      const { js } = compileModule(await readFile(file, 'utf8'), { filename: file, generate: 'client' });
      return { format: 'module', source: js.code, shortCircuit: true };
    }`),
  import.meta.url,
);
// (a preview's nodes are no Element of the editor's window: its fields' checks skip them)
globalThis.Element ??= class {};
globalThis.document ??= {};
const { createEdit } = await import('../src/editor/preview-edit.js');
const { createKeys } = await import('../src/editor/keys.js');
const { ui } = await import('../src/editor/svelte/ui.svelte.js');

/** The preview's editing attached to a stand-in document, its forwarded keys into keys.js. */
function preview() {
  const on = {};
  const doc = {
    addEventListener: (t, fn) => ((on[t] ??= []), on[t].push(fn)),
    createElement: () => ({}),
  };
  const did = { nudge: [], edit: [], undo: 0 };
  const onKey = createKeys({
    store: { undo: () => did.undo++, redo: () => {} },
    bridge: { path: () => '/', doc, editWidget: (id, t) => (did.edit.push([id, t]), true) },
    overlay: { deleteLink: () => false, nudge: (dc, dr) => (did.nudge.push([dc, dr]), true) },
    save: () => {},
    widgetAt: () => null,
  });
  const edit = createEdit({
    store: {},
    emit: (name, e) => name === 'key' && onKey(e),
    clicks: () => 'arrange',
    reveal: () => {},
    markApplied: () => {},
  });
  edit.connect(doc, {});
  edit.attach();
  /** A keydown in the preview on `target` (the page's body: no field). */
  const press = (key, target = { closest: () => null }, mods = {}) => {
    const e = { key, target, defaultPrevented: false, ...mods };
    e.preventDefault = () => (e.defaultPrevented = true);
    e.stopPropagation = () => (e.stopped = true);
    for (const fn of on.keydown) fn(e);
    return e;
  };
  return { did, press };
}

test("the preview's arrows nudge the picked widgets, as the editor's do", () => {
  Object.assign(ui, { mode: 'edit', pageTab: 'sections', widget: 'w-1', multi: [], link: null });
  const { did, press } = preview();
  const e = press('ArrowRight');
  assert.deepEqual(did.nudge, [[1, 0]]);
  assert.ok(e.defaultPrevented, "the page doesn't scroll");
  press('ArrowDown', undefined, { shiftKey: true });
  assert.equal(did.nudge.length, 2);
  // several picked: all of them
  Object.assign(ui, { widget: null, multi: ['w-1', 'w-2'] });
  press('ArrowLeft');
  assert.deepEqual(did.nudge.at(-1), [-1, 0]);
  // nothing picked: nothing moves
  Object.assign(ui, { widget: null, multi: [] });
  press('ArrowLeft');
  assert.equal(did.nudge.length, 3);
});

test('Enter or a letter in the preview edits a picked Text (G14), as in the editor', () => {
  Object.assign(ui, { mode: 'edit', pageTab: 'sections', widget: 'w-9', multi: [], link: null });
  const { did, press } = preview();
  assert.ok(press('Enter').defaultPrevented);
  press('q');
  assert.deepEqual(did.edit, [
    ['w-9', ''],
    ['w-9', 'q'],
  ]);
  // Ctrl+Z: the store's undo, the iframe's own prevented (G14)
  const z = press('z', undefined, { ctrlKey: true });
  assert.equal(did.undo, 1);
  assert.ok(z.defaultPrevented);
});

test('a text edited in place keeps its arrows (the caret) and its Enter', () => {
  Object.assign(ui, { mode: 'edit', pageTab: 'sections', widget: 'w-9', multi: [], link: null });
  const { did, press } = preview();
  const text = {
    dataset: { editType: 'multiline' },
    closest: (s) => (/contenteditable/.test(s) ? text : null),
  };
  for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    const e = press(k, text);
    assert.equal(e.defaultPrevented, false, `${k}: the caret moves`);
  }
  assert.deepEqual(did.nudge, []);
  assert.deepEqual(did.edit, []);
});
