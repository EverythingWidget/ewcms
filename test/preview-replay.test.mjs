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
  };
  globalThis.window.__siteEditor.connect(api, win);
  const to = (next) => {
    mode = next;
    bridge.clicksChanged();
    return calls.splice(0);
  };
  return { calls, to };
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
  assert.deepEqual(p.to('animate'), ['unfreeze']); // Element motion
  assert.deepEqual(p.to('visitor'), []); // back to browse: already playing
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
