// Switching areas (Pages, back to the areas, Theme, ...) tells the preview what its clicks do
// (main.js setPanel → applyClicks → bridge.clicksChanged). The page's animations stop
// (api.freeze) only into arrange clicks and play again (api.unfreeze) only out of them: both
// revert and play the page's animations again, which looked like a reload of the preview on
// every area switch while the clicks stayed the visitor's.
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
      if (url.endsWith('?raw')) {
        const text = await readFile(fileURLToPath(url.slice(0, -4)), 'utf8');
        return { format: 'module', source: 'export default ' + JSON.stringify(text), shortCircuit: true };
      }
      if (!url.endsWith('.svelte.js')) return next(url, context);
      const file = fileURLToPath(url);
      const { js } = compileModule(await readFile(file, 'utf8'), { filename: file, generate: 'client' });
      return { format: 'module', source: js.code, shortCircuit: true };
    }`),
  import.meta.url,
);
const { parseHTML } = await import('linkedom');
globalThis.window ??= globalThis; // the bridge's hook for the site (window.__siteEditor)
globalThis.CSS ??= { escape: (s) => String(s) };
const { createBridge } = await import('../src/editor/preview-runtime.js');

/** A stand-in preview connected in `mode` clicks: set(mode) and clicksChanged(), what the site's api was asked. */
function preview(mode) {
  const { window: win } = parseHTML(
    '<html><head></head><body><main data-router-view><section data-sec="s1"></section></main></body></html>',
  );
  Object.assign(win, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });
  const calls = [];
  const bridge = createBridge({ store: { current: {} }, labelFor: () => '', clicks: () => mode });
  const api = {
    setAnimations() {},
    freeze: () => calls.push('freeze'),
    unfreeze: () => calls.push('unfreeze'),
    hooks: { beforeMount: new Set(), afterMount: new Set() },
    resolve: () => null,
    scrollRange: () => ({ start: 0, end: 100, max: 1000 }),
    scrollTop: () => 0,
  };
  globalThis.window.__siteEditor.connect(api, win);
  const to = (next) => {
    mode = next;
    bridge.clicksChanged();
    return calls.splice(0);
  };
  return { calls, to, bridge };
}

test('area switches in browse (visitor clicks before and after) never replay the page', () => {
  const p = preview('visitor');
  assert.deepEqual(p.calls.splice(0), []);
  // Pages, back to the areas, Theme, Animations, ...: each one clicksChanged, the clicks the same
  for (let i = 0; i < 6; i++) assert.deepEqual(p.to('visitor'), [], `switch ${i + 1}`);
});

test('the animations stop into arrange clicks and play again only out of them', () => {
  const p = preview('visitor');
  assert.deepEqual(p.to('arrange'), ['freeze']); // Edit: the Sections tab
  assert.deepEqual(p.to('arrange'), []); // still arranging (another pop-up, a tab of the same)
  assert.deepEqual(p.to('visitor'), ['unfreeze']); // Done: browse
  assert.deepEqual(p.to('visitor'), []); // another area: already playing
  assert.deepEqual(p.to('arrange'), ['freeze']);
  assert.deepEqual(p.to('visitor'), ['unfreeze']); // Done, or another area
});

test('a page connected while arranging starts frozen; leaving arrange plays it once', () => {
  const p = preview('arrange');
  assert.deepEqual(p.calls.splice(0), ['freeze']);
  assert.deepEqual(p.to('arrange'), []);
  assert.deepEqual(p.to('visitor'), ['unfreeze']);
  assert.deepEqual(p.to('visitor'), []);
});

// The Sections tab is arrange clicks: the page stands still for arranging, yet a widget's Replay
// and its Scroll field play its animations (thaw: unfreeze once); they stop again (settle:
// freeze) when its motion closes, an edit in place starts or the clicks change.
test('arranging: Replay and Scroll play the page once; settle stops it again', () => {
  globalThis.requestAnimationFrame ??= () => 0;
  const p = preview('arrange');
  assert.deepEqual(p.calls.splice(0), ['freeze']);
  p.bridge.replay(null);
  assert.deepEqual(p.calls.splice(0), ['unfreeze']);
  p.bridge.replay(null); // already playing
  p.bridge.scrubTo(null, 0.5);
  assert.deepEqual(p.calls.splice(0), []);
  assert.equal(p.bridge.settle(), true); // the motion closed
  assert.deepEqual(p.calls.splice(0), ['freeze']);
  assert.equal(p.bridge.settle(), false); // already still
  assert.deepEqual(p.calls.splice(0), []);
  p.bridge.scrubTo(null, 0.2); // the Scroll field
  assert.deepEqual(p.calls.splice(0), ['unfreeze']);
  // a clicks change while playing: arranging again stops it
  assert.deepEqual(p.to('arrange'), ['freeze']);
  assert.deepEqual(p.to('visitor'), ['unfreeze']);
  // with visitor clicks the page plays anyway: nothing to thaw or settle
  p.bridge.replay(null);
  assert.equal(p.bridge.settle(), false);
  assert.deepEqual(p.calls.splice(0), []);
});

test('an edit in place stops the animations first; the motion views settle when closed', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
  assert.match(read('preview-runtime.js'), /beforeEdit: \(\) => bridge\.settle\(\),/);
  const pe = read('preview-edit.js');
  assert.match(pe, /function settled\(el\) \{/);
  assert.match(pe, /function startEdit\(el[^)]*\) \{\s*el = settled\(el\);/);
  for (const f of ['svelte/WidgetMotion.svelte', 'svelte/AnimEditor.svelte'])
    assert.match(read(f), /\$effect\(\(\) => \(\) => bridge\.settle\?\.\(\)\);/, f);
});
