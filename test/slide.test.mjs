// The editor's sideways slide: a page, a template or a folder opened comes in from the right,
// one copy of the old view and one of the new, clipped to the panel's edge, so the outgoing
// view never peeks at the edge, isn't cropped, and the incoming one doesn't pop at the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the pages list, a page and a template all slide inside a clipping view', () => {
  const panel = read('src/editor/svelte/ContentPanel.svelte');
  const open = panel.indexOf('class="ed-view"');
  const list = panel.indexOf('{#if browsing}', open);
  const tpl = panel.indexOf("ui.target?.kind === 'item-template'", open);
  const close = panel.indexOf('</div>', open);
  assert.ok(open > 0 && list > open && tpl > list && tpl < close);
  // the whole view, one block: no list of its children to pick from
  assert.match(panel, /swapView\(view\)/);
  assert.match(panel, /play\(now \? -1 : 1\)/);
  assert.doesNotMatch(panel, /viewEls/);
  assert.match(panel, /overflow:\s*clip/);
  assert.match(read('src/editor/lib/slide.js'), /prefers-reduced-motion/);
});

test('a folder slides its whole .ed-body, padding too, in the view (the panel edge)', () => {
  const list = read('src/editor/svelte/PagesList.svelte');
  assert.match(list, /const body = root\.closest\('\.ed-body'\) \?\? root;/);
  assert.match(list, /swapView\(body\.parentElement, body\)/);
  assert.match(list, /play\(dir\)/);
  assert.doesNotMatch(list, /swapView\(root/);
});

test('a Theme part (Color, Typography, Layout) slides in and Back to Theme slides out, as a folder', () => {
  const theme = read('src/editor/svelte/ThemePanel.svelte');
  assert.match(theme, /import \{ swapView \} from '\.\.\/lib\/slide\.js';/);
  assert.match(theme, /<section class="ed-body" aria-label="Theme" bind:this=\{body\}>/);
  // the cards and a part share the one .ed-body: its whole block slides in the area (the panel edge)
  assert.match(theme, /const dir = next \? 1 : -1;/);
  assert.match(theme, /swapView\(body\.parentElement, body\)/);
  assert.match(theme, /tick\(\)\.then\(\(\) => play\(dir\)\)/);
});

test('swapView slides one old copy and one new copy, sized to the larger view', () => {
  const slide = read('src/editor/lib/slide.js');
  assert.match(slide, /export function swapView\(host, box = host\)/);
  assert.equal(slide.match(/cloneNode\(/g).length, 1); // in layer(): one copy per layer
  assert.equal(slide.match(/= layer\(host, box\)/g).length, 2); // the old and the new
  assert.doesNotMatch(slide, /inset: '0'/); // layers don't follow a shrinking host
  assert.match(slide, /Math\.max\(before\.w, host\.clientWidth\)/);
  assert.match(slide, /Math\.max\(before\.h, host\.clientHeight\)/);
  assert.match(slide, /overflow: 'clip'/); // the layer clips
  assert.match(slide, /overflow: 'hidden', \/\/ not clip/); // the copy can keep its scroll
  assert.doesNotMatch(slide, /containerType/);
  assert.match(slide, /host\.style\.visibility = 'hidden'/);
  assert.match(slide, /if \(!host \|\| !box \|\| still\(\)\) return \(\) => \{\}/);
});

test('a live view that changed while sliding fades in over the last 80ms, no pop', () => {
  const slide = read('src/editor/lib/slide.js');
  assert.match(slide, /export const FADE = 0\.08/);
  assert.match(slide, /if \(!inn\.changed\(\)\) return;/);
  assert.match(slide, /opacity: 0, duration: FADE/);
  assert.match(slide, /SLIDE\.duration - FADE/);
  assert.doesNotMatch(slide, /mask/);
});

test('a page opened shows its own sections at once, not the previous page behind the curtain', async () => {
  const { targetFile } = await import('../src/editor/layout-sync.js');
  // the preview still shows Home (its curtain runs): the page picked is what the panel edits
  const home = { querySelector: () => ({ dataset: { pageFile: 'pages/index.json' } }) };
  const about = 'pages/about/index.json';
  assert.equal(targetFile({ kind: 'page', path: '/about/', file: about }, home), about);
  // a page the preview went to by itself (a link, the URL): the preview's page
  assert.equal(targetFile({ kind: 'page', path: '/' }, home), 'pages/index.json');
  assert.equal(targetFile({ kind: 'page', path: '/' }, null), '');
  // pickTarget sets the page's file before the preview navigates; 'navigate' hands it back
  const main = read('src/editor/main.js');
  const pick = main.slice(main.indexOf('function pickTarget('));
  const set = pick.indexOf('ui.target = route ? { ...item, file: pageFile(route.id) } : item;');
  assert.ok(set > 0 && set < pick.indexOf('bridge.navigate(to)'));
  assert.match(main, /if \(ui\.target\?\.kind !== 'part'\) ui\.target = shownPage\(path\);/);
});
