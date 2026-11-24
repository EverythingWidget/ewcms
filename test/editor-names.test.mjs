// One name per thing in the editor's labels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (f) => readFileSync(new URL(`../src/editor/svelte/${f}`, import.meta.url), 'utf8');

test('names: Auto height in both places, Edit text on the widget, Templates', () => {
  assert.match(src('WidgetLayout.svelte'), /<\/i>\s*Auto height\s*<\/button>/);
  assert.match(src('WidgetToolbar.svelte'), /aria-label="Auto height"/);
  assert.match(src('WidgetToolbar.svelte'), /<span>Edit text<\/span>/);
  assert.match(src('TemplateActions.svelte'), /template editor \(Templates\)/);
  assert.doesNotMatch(src('App.svelte'), /people, places, projects/);
  assert.doesNotMatch(src('EntrancePageCurtain.svelte'), /Curtain for this page'/);
});
