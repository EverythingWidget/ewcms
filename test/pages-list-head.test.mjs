// The pages list's head in a folder: the page head's square back, the path, Back to /parent/, a square +.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/editor/svelte/PagesList.svelte', import.meta.url), 'utf8');
const head = readFileSync(new URL('../src/editor/svelte/BackHead.svelte', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/editor/svelte/PageHead.svelte', import.meta.url), 'utf8');

test('in a folder: BackHead with a square back, the path as the name, Back to the parent, a square +', () => {
  assert.doesNotMatch(src, /pl-return|Return to/);
  assert.match(src, /<BackHead/);
  assert.match(src, /backLabel="Up one level"/);
  assert.match(src, /backTitle="Up one level \(Esc\)"/);
  assert.match(src, /title=\{L\.path\}/);
  assert.match(src, /onback=\{\(\) => go\(parentId\(level\)\)\}/);
  assert.match(src, /Back to \{shownPath\(parentId\(level\) \|\| 'home'\)\}/);
  assert.match(src, /icon="plus"\s*square\s*label="Add page"/);
  // at the top the bare + stays (no folder back)
  assert.match(src, /\{:else\}[\s\S]*icon="plus"\s*iconOnly\s*label="Add page"/);
});

test("BackHead is the page head's square back beside a two-line title, with the arrow icon", () => {
  assert.match(head, /icon="arrow-left" square label=\{backLabel\}/);
  assert.match(head, /class="bh__title"/);
  assert.match(head, /align-items: center/);
  assert.match(head, /min-height: var\(--size-control\)/);
  assert.match(page, /<BackHead backLabel="Back to pages"/);
  // the arrow is Button's icon, same control the page head uses
  assert.match(head, /<Button icon="arrow-left" square/);
});
