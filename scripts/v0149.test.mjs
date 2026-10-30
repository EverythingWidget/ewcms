// v0.1.49: on phones, widgets without a phone layout of their own stack full width in reading
// order, each following the one before (so Auto heights never overlap).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phoneStack, widgetVars, widgetLinks } from '../src/site/layout/index.js';

const w = (id, base, extra = {}) => ({ id, type: 'text', layout: { base }, ...extra });

test('phone stack: reading order, full width, each following the one before', () => {
  const list = [
    w('w-dddd', { col: 61, span: 60, row: 20 }), // contact button, right of the email line
    w('w-aaaa', { col: 1, span: 30, row: 1 }), // image row: 4 thumbnails
    w('w-cccc', { col: 1, span: 60, row: 20 }), // email line
    w('w-bbbb', { col: 31, span: 30, row: 1 }),
  ];
  const st = phoneStack(list);
  assert.deepEqual(
    [...st.keys()],
    ['w-aaaa', 'w-bbbb', 'w-cccc', 'w-dddd'], // top, then left
  );
  for (const v of st.values()) assert.deepEqual([v.area.col, v.area.span], [1, 60]);
  assert.equal(st.get('w-aaaa').link, null);
  assert.deepEqual(st.get('w-dddd').link, { to: 'w-cccc', gap: 4 });
  assert.match(widgetVars(list[0], list), /--mc:1;--ms:60;/);
  assert.equal(widgetLinks(list[0], list)['data-mlink'], 'w-cccc 4');
});

test('phone stack: a follower overlapping its leader still comes after it; own phone layouts stay', () => {
  const list = [
    w('w-aaaa', { col: 1, span: 120, row: 1 }),
    w('w-bbbb', { col: 1, span: 120, row: 1, link: { to: 'w-aaaa', gap: -3 } }),
    w('w-cccc', { col: 1, span: 40, row: 9 }, {}),
  ];
  list[2].layout.phone = { col: 10, span: 20, row: 3 };
  const st = phoneStack(list);
  assert.deepEqual([...st.keys()], ['w-aaaa', 'w-bbbb']);
  assert.deepEqual(st.get('w-bbbb').link, { to: 'w-aaaa', gap: -2 }); // its desktop gap halved
  assert.match(widgetVars(list[2], list), /--mc:10;--ms:20;--mr:3;/);
});

import { readFileSync } from 'node:fs';
import { tagHtml } from '../src/editor/widget-tag.js';
const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

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
