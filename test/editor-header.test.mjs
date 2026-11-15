// The editor header: Edit / Done and Publish are 32px (Button size small), as the back arrow
// and the icon buttons; the actions row keeps 40px, so nothing under it moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/editor/svelte/App.svelte', import.meta.url), 'utf8');
const btn = readFileSync(new URL('../src/editor/svelte/Button.svelte', import.meta.url), 'utf8');

test('header: Edit / Done and Publish are small (32px); the row keeps 40px', () => {
  assert.match(app, /<Button\s+size="small"\s+data-edit-toggle/);
  assert.match(app, /<Button\s+size="small"\s+variant="primary"\s+title="Commit all saved/);
  assert.match(btn, /\.btn--small \{\s*height: 32px;/);
  assert.match(app, /\.ed-actions \{[^}]*min-height: 40px;/);
});
