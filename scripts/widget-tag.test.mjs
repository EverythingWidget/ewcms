// The widget's size / place readout (widget-tag.js): parts, the Auto toggle, the size text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tagParts, tagHtml, shownPlace } from '../src/editor/widget-tag.js';

// the tag's parts after its Auto toggle (v0.1.49)
const parts = (...a) => tagHtml(...a).replace(/^<i class="auto[^]*?<\/i>/, '');
const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

test('tag: size and place only, a changed part highlighted while dragged', () => {
  const p = { col: 88, span: 13, row: 154, rows: 7 };
  assert.equal(parts(p), '13×7 · 154:88');
  assert.deepEqual(tagParts(p, { ...p }), {
    size: '13×7',
    pos: '154:88',
    sizeCh: false,
    posCh: false,
  });
  assert.equal(parts(p, { ...p, col: 80 }), '13×7 · <b class="ch">154:88</b>');
  assert.equal(parts(p, { ...p, rows: 6 }), '<b class="ch">13×7</b> · 154:88');
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

test('the tag shows the place; the pop-up links to the leader', () => {
  assert.match(src('svelte/WidgetLayout.svelte'), /Follows \{leader\}/);
  assert.match(src('overlay.js'), /tagHtml\(\s*dragging \? drag\.pos : shownPlace\(sel, win\)/);
});

test('the preview tag starts with the Auto toggle: off, on (`64×auto`), a fixed box', () => {
  const p = { col: 1, span: 64, row: 4, rows: 29 };
  const off = tagHtml(p);
  assert.match(off, /^<i class="auto" data-auto [^>]*><svg viewBox="0 0 320 512"/);
  assert.match(off, /<\/i>64×29 · 4:1$/);
  const on = tagHtml(p, null, true);
  assert.match(on, /^<i class="auto is-on" data-auto /);
  assert.match(on, /<\/i>64×auto · 4:1$/);
  // auto: a drag changing only its rows doesn't mark its size changed
  assert.match(tagHtml(p, { ...p, rows: 3 }, true), /<\/i>64×auto · 4:1$/);
  const css = src('overlay.js');
  assert.match(css, /\.label \.auto \{[^}]*width: 20px; height: 16px;/);
  assert.match(css, /\.label \.auto svg \{ position: static;/);
  assert.match(css, /\.label \.auto:hover \{ background: rgb\(0 0 0 \/ \.14\)/);
  assert.match(
    css,
    /\.sel\.is-auto \.handle:not\(\[data-h='e'\]\):not\(\[data-h='w'\]\) \{ display: none; \}/,
  );
  // a click: Auto ↔ Rows (the rows it shows), one setWidget (one undo step)
  assert.match(css, /onsize\(ui\.widget, auto \? 'rows' : 'auto'/);
  assert.match(src('main.js'), /onsize\(id, size, rows\) \{[^]*?setWidget\(store/);
});

test('the size text', () => {
  const p = { col: 1, span: 64, row: 4, rows: 22 };
  assert.equal(tagParts(p).size, '64×22');
  assert.equal(tagParts(p, null, true).size, '64×auto');
});

test('the on-widget tag is hidden', () => {
  assert.match(src('overlay.js'), /\.label \{ display: none;/);
});
