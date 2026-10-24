// v0.1.27: the selected widget's tag, boxes around what shows, an idle overlay, the widget toolbar
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tagParts, tagHtml, shownPlace } from '../src/editor/widget-tag.js';
import { boxOf } from '../src/site/layout/geometry.js';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('tag: size and place only, a changed part highlighted while dragged', () => {
  const p = { col: 88, span: 13, row: 154, rows: 7 };
  assert.equal(tagHtml(p), '13×7 · 154:88');
  assert.deepEqual(tagParts(p, { ...p }), {
    size: '13×7',
    pos: '154:88',
    sizeCh: false,
    posCh: false,
  });
  assert.equal(tagHtml(p, { ...p, col: 80 }), '13×7 · <b class="ch">154:88</b>');
  assert.equal(tagHtml(p, { ...p, rows: 6 }), '<b class="ch">13×7</b> · 154:88');
  const el = { style: { getPropertyValue: (k) => ({ '--fr': '154', '--frs': '' })[k] ?? '' } };
  const win = {
    getComputedStyle: () => ({
      gridColumnStart: '88',
      gridColumnEnd: 'span 13',
      gridRowStart: '3',
      gridRowEnd: '10',
    }),
  };
  assert.deepEqual(shownPlace(el, win), { col: 88, span: 13, row: 154, rows: 7 });
});

test('the i button is gone: its place in the tag, its link in the pop-up', () => {
  const tb = src('svelte/WidgetToolbar.svelte');
  assert.doesNotMatch(tb, /infoButton|infoPanel/);
  assert.match(src('svelte/WidgetLayout.svelte'), /Follows \{leader\}/);
  assert.match(src('overlay.js'), /tagHtml\(\s*dragging \? drag\.pos : shownPlace\(sel, win\)/);
});

test('boxes wrap what shows: a child over the edge counts, a clipping one does not', () => {
  const R = (left, top, w, h) => ({
    left,
    top,
    right: left + w,
    bottom: top + h,
    width: w,
    height: h,
  });
  const kid = { getBoundingClientRect: () => R(90, 100, 113, 40), children: [] };
  const el = { getBoundingClientRect: () => R(100, 100, 85, 40), children: [kid] };
  const win = { scrollX: 0, scrollY: 50, getComputedStyle: () => ({ overflow: 'visible' }) };
  assert.deepEqual(boxOf(el, win), { x: 90, y: 150, w: 113, h: 40 });
  const clip = { ...win, getComputedStyle: (n) => ({ overflow: n === el ? 'hidden' : 'visible' }) };
  assert.deepEqual(boxOf(el, clip), { x: 100, y: 150, w: 85, h: 40 });
  const ov = src('overlay.js');
  assert.doesNotMatch(ov, /rectOf\((sel|el|lead|n|hover)\b/, 'widgets boxed with boxOf');
});

test('links: kept paths by id, d set on change, no innerHTML; the loop idles', () => {
  const ov = src('overlay.js');
  const draw = ov.slice(ov.indexOf('function drawLinks'), ov.indexOf('function drawLinks') + 3000);
  assert.doesNotMatch(draw, /innerHTML/);
  assert.match(ov, /const linkEls = new Map\(\)/);
  assert.match(ov, /attr\(e\.line, 'd', d\)/);
  assert.match(ov, /if \(size !== svgSize\)/);
  assert.match(ov, /text-anchor', 'end'/, 'the gap label left of the line, clear of the tag');
  assert.match(ov, /anims > 0 \|\| now\(\) < idleUntil/);
  assert.match(ov, /new win\.MutationObserver\(kick\)/);
  assert.match(ov, /new win\.ResizeObserver\(kick\)/);
  assert.doesNotMatch(ov, /if \(shown\(\)\) raf = win\.requestAnimationFrame/);
});

test('one widget selected: the section toolbar has its actions and a gear; rows have none', () => {
  const st = src('svelte/SectionToolbar.svelte');
  for (const s of [
    'location-crosshairs',
    'copy',
    'angles-down',
    'angles-up',
    'trash',
    'ui.popup = true',
  ])
    assert.ok(st.includes(s), s);
  const row = src('svelte/WidgetRow.svelte');
  assert.doesNotMatch(row, /<Button|onduplicate|ondelete|onshow/);
});
