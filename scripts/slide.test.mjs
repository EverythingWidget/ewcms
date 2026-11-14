// The editor's sideways slide: a page or a template opened comes in from the right,
// clipped to the panel so the outgoing view never peeks at the edge and then pops away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the pages list, a page and a template all slide inside a clipping view', () => {
  const panel = read('src/editor/svelte/ContentPanel.svelte');
  const open = panel.indexOf('class="ed-view"');
  const list = panel.indexOf('{#if ui.pagesWin.open}', open);
  const tpl = panel.indexOf("ui.target?.kind === 'item-template'", open);
  const close = panel.indexOf('</div>', open);
  assert.ok(open > 0 && list > open && tpl > list && tpl < close);
  assert.match(panel, /swapView\(view, viewEls\(\)\)/);
  assert.match(panel, /overflow:\s*clip/);
  assert.match(read('src/editor/lib/slide.js'), /prefers-reduced-motion/);
});

test('swapView slides clipped copies and hides the live incoming view', () => {
  const slide = read('src/editor/lib/slide.js');
  assert.match(slide, /inset: '0'/);
  assert.match(slide, /overflow: 'clip'/);
  assert.match(slide, /visibility = 'hidden'/);
  assert.match(slide, /if \(!host \|\| !els\.length \|\| still\(\)\) return \(\) => \{\}/);
});
