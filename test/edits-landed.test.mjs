// A save waits for edits on their way to the store (F103): Add widget waits for the preview to
// settle before it adds the widget, and a Ctrl+S pressed meanwhile used to find nothing to save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const { editComing, editsLanded } = await import('../src/editor/svelte/ui.svelte.js');
const read = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('editsLanded waits for every edit on its way, also one started while it waits', async () => {
  const store = [];
  let release;
  const slow = new Promise((r) => (release = r));
  editComing(async () => {
    await slow;
    store.push('widget');
    editComing(async () => store.push('follow-up')); // started by the first
  });
  let landed = false;
  const waiting = editsLanded().then(() => (landed = true));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(landed, false); // the widget isn't in yet: the save waits
  release();
  await waiting;
  assert.deepEqual(store, ['widget', 'follow-up']);
  await editsLanded(); // nothing coming: at once
});

test('a failed edit on its way doesn\'t block a save', async () => {
  const failed = editComing(async () => {
    throw new Error('render failed');
  });
  await editsLanded();
  await assert.rejects(failed, /render failed/);
});

test('save waits for edits on their way first; Add widget is one (F103)', () => {
  const main = read('main.js');
  const save = main.match(/async function save\([\s\S]*?\n\}/)[0];
  assert.ok(save.indexOf('await editsLanded()') >= 0);
  assert.ok(save.indexOf('await editsLanded()') < save.indexOf('store.dirtyFiles()'));
  const panel = read('svelte/ContentPanel.svelte');
  assert.match(
    panel,
    /const addTo = \(at, type\) =>\s*editComing\(async \(\) => \{\s*await hooks\.settled\(\);\s*selectWidgets\(\[addWidget\(/,
  );
});


test('G17: Add widget closes the picker and focuses the preview, so Enter edits the new widget', () => {
  const modal = read('svelte/WidgetsModal.svelte');
  assert.match(modal, /dialog\.querySelector\('\.widgets-search'\)\?\.blur\(\)/);
  const panel = read('svelte/ContentPanel.svelte');
  assert.match(panel, /bridge\?\.doc\?\.defaultView\?\.focus\(\)/);
});
