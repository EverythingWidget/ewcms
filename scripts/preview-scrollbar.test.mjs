// The preview: square corners, and the editor's thin scrollbar inside its page (injected by
// bridge.js in the editor only; the site's own styles leave the browser's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('the preview frame has no border radius (the phone frame keeps its own)', () => {
  const app = read('editor/svelte/App.svelte');
  const frame = app.slice(
    app.indexOf('  .ed-frame {'),
    app.indexOf('  .ed-stage.is-mobile .ed-frame'),
  );
  assert.match(frame, /border-radius: 0;/);
});

test("the preview's page gets the editor's scrollbar, injected (editor only)", () => {
  const b = read('editor/bridge.js');
  const css = b.slice(
    b.indexOf('const INJECTED_CSS = `'),
    b.indexOf('`;', b.indexOf('const INJECTED_CSS')),
  );
  assert.match(
    css,
    /html \{ scrollbar-width: thin; scrollbar-color: rgb\(255 255 255 \/ \.2\) transparent; \}/,
  );
  assert.match(css, /html::-webkit-scrollbar \{ width: 8px; height: 8px; \}/);
  for (const f of ['client/styles/_base.scss']) assert.doesNotMatch(read(f), /scrollbar-width/);
});
