// The pages list's head in a folder: the page head's square back, the path, Back to /parent/, a
// square +; at the top the area's head (AreaHead.svelte: Back to areas, Pages) with the same +.
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
  // one + (the addPage snippet) in a folder and at the top, where the area's head holds it
  assert.equal(src.match(/label="Add page"/g).length, 1);
  assert.match(src, /\{#snippet trailing\(\)\}\{@render addPage\(\)\}\{\/snippet\}/);
  assert.match(src, /\{:else\}\s*<AreaHead id="pages" \{actions\} trailing=\{addPage\} \/>/);
  assert.doesNotMatch(src, /pl-top__path|crumbsOf/);
});

test("BackHead is the page head's square back beside a two-line title, with the arrow icon", () => {
  assert.match(head, /icon="arrow-left" square label=\{backLabel\}/);
  assert.match(head, /class="bh__title"/);
  assert.match(head, /align-items: center/);
  assert.match(head, /min-height: var\(--size-control\)/);
  assert.match(page, /<BackHead \{backLabel\} backTitle=\{backLabel\}/);
  // the arrow is Button's icon, same control the page head uses
  assert.match(head, /<Button icon="arrow-left" square/);
});

test('G18: the whole page row drags, and Remove from menu unlinks without deleting', () => {
  assert.match(src, /Remove from menu: the page stays, under Not linked/);
  assert.match(src, /const removeFromMenu = \(row\) =>\s*setNav\(unlinkPage\(/);
  assert.match(
    src,
    /if \(e\.target\.closest\('\.btn, \.prow__in, \.prow__own, \.prow__ask, input, select, a, label'\)\)/,
  );
  assert.match(src, /onpointerdown=\{\(e\) => \{\s*if \(j < 0\) return;/);
});

test('F114: picking Header or Footer under Site opens it for editing', () => {
  assert.match(src, /if \(row\.part && !row\.itemTemplate\) return open\(row\);/);
  assert.match(src, /title=\{r\.part\s*\? `Open the \$\{r\.title\}`/);
});
