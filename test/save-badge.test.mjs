// The footer's save badge: Saved after a save until the next edit (F60, G16).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('after a save the footer says Saved until the next edit (F60)', () => {
  const app = readFileSync(new URL('../src/editor/svelte/App.svelte', import.meta.url), 'utf8');
  assert.match(app, /if \(unpublished\.length && ui\.saved\) return line\('pending', 'Saved'\);/);
  assert.match(app, /if \(live\.changes\) ui\.saved = false;/);
  const main = readFileSync(new URL('../src/editor/main.js', import.meta.url), 'utf8');
  assert.match(main, /ui\.saved = !store\.dirtyFiles\(\)\.length;/);
});

test("G16: Saved is set before markSaved, and the badge keeps Unsaved changes' width", () => {
  const main = readFileSync(new URL('../src/editor/main.js', import.meta.url), 'utf8');
  const save = main.slice(main.indexOf('await dataLayer.save(sent);'), main.indexOf('saves++;'));
  assert.ok(save.indexOf('ui.saved = true;') < save.indexOf('store.markSaved('));
  const app = readFileSync(new URL('../src/editor/svelte/App.svelte', import.meta.url), 'utf8');
  assert.match(app, /min-width: 16ch; \/\/ "Unsaved changes"/);
});
