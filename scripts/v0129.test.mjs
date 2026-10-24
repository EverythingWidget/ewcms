// v0.1.29: one thing selected at a time: a section selected clears the widgets (and their
// pop-up), a widget selected clears the section; in the panel and in the preview
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileModule } from 'svelte/compiler';

const url = (f) => new URL(`../src/editor/${f}`, import.meta.url);
const src = (f) => readFileSync(url(f), 'utf8');

/** ui.svelte.js compiled (its runes) and loaded, its relative imports pointed at src/editor/svelte. */
async function loadUi() {
  const { js } = compileModule(src('svelte/ui.svelte.js'), { filename: 'ui.svelte.js' });
  const code = js.code.replace(
    /from '(\.\.?\/[^']+)'/g,
    (_, p) => `from '${new URL(p, url('svelte/'))}'`,
  );
  const f = join(mkdtempSync(join(tmpdir(), 'ui-')), 'ui.mjs');
  writeFileSync(
    f,
    code.replace(
      /from 'svelte\/internal\/client'/,
      `from '${import.meta.resolve('svelte/internal/client')}'`,
    ),
  );
  return import(f);
}

test('selecting a section clears any widget selection and closes the pop-up; and back', async () => {
  const { ui, selectWidgets, selectSection } = await loadUi();
  selectWidgets(['b-1']);
  ui.popup = true;
  selectSection('s-2');
  assert.equal(ui.selSection, 's-2');
  assert.equal(ui.widget, null);
  assert.deepEqual([...ui.multi], []);
  assert.equal(ui.popup, false);
  selectWidgets(['b-1', 'b-2']);
  selectSection('s-1');
  assert.deepEqual([...ui.multi], []);
  selectWidgets(['b-3']);
  assert.equal(ui.selSection, null);
  assert.equal(ui.widget, 'b-3');
});

test('the panel card and the preview both select a section through selectSection', () => {
  assert.match(src('svelte/SectionsList.svelte'), /onselect=\{\(\) => \{\s*selectSection\(s\.id\)/);
  const ov = src('overlay.js');
  assert.match(ov, /if \(!b\.box && !b\.mod\) onsectionpick\(b\.sec\.dataset\.sec\)/);
  assert.match(src('main.js'), /onsectionpick\(id\) \{\s*selectSection\(id\);/);
});
