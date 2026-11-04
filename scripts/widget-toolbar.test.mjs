// The widget toolbar: its buttons and order, collapsing by the preview width, its menus, drags.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
const bar = readFileSync(
  new URL('../src/editor/svelte/WidgetToolbar.svelte', import.meta.url),
  'utf8',
);
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('one widget selected: the section toolbar has its actions and a gear; rows have none', () => {
  const st = src('svelte/SectionToolbar.svelte');
  for (const s of [
    'location-crosshairs',
    'copy',
    'angles-down',
    'angles-up',
    'trash',
    'onclick={openPopup}',
  ])
    assert.ok(st.includes(s), s);
  const row = src('svelte/WidgetRow.svelte');
  assert.doesNotMatch(row, /<Button|onduplicate|ondelete|onshow/);
});

test('one widget: toolbar order gear, locate, eye, copy, trash; layers only for several', () => {
  const st = src('svelte/SectionToolbar.svelte');
  const body = st.slice(st.indexOf('{:else if group}'), st.indexOf('{:else if s}'));
  const icons = [...body.matchAll(/icon=(?:"([a-z-]+)"|\{allOff \? 'eye-slash' : '(eye)'\})/g)].map(
    (m) => m[2] || m[1],
  );
  assert.deepEqual(icons, [
    'gear',
    'location-crosshairs',
    'eye',
    'copy',
    'angles-down',
    'angles-up',
    'trash',
  ]);
  assert.match(body, /\{#if !one\}\s*<Button\s+size="small"\s+icon="angles-down"/);
});

test('the marks go into … by the frame width only', () => {
  const s = src('svelte/WidgetToolbar.svelte');
  assert.match(s, /const room = box\.frameRight - box\.frameLeft - 16;/);
  assert.doesNotMatch(s, /Math\.max\(box\.w, 280\)/);
});

test('every widget gets the toolbar: divider (text only), Auto, its size', () => {
  const s = src('svelte/WidgetToolbar.svelte');
  assert.match(s, /const shown = \$derived\(!!\(where && widget && pos && !peeking\)\)/);
  assert.match(s, /\{#if hasText\}<span class="btb__div"/);
  assert.match(s, /fa-solid fa-up-down/);
  assert.match(s, /class="btb__size"/);
  assert.match(s, /width: 16ch;/);
});

test('the toolbar stays shown while a widget is dragged', () => {
  assert.match(bar, /const shown = \$derived\(!!\(where && widget && pos && !peeking\)\);/);
  assert.match(bar, /if \(drag !== dragging\) dragging = drag;/);
});

test('while dragging the bar is see-through for the pointer', () => {
  assert.match(bar, /dragging && 'is-dragging'/);
  assert.match(bar, /&\.is-dragging \{\s*pointer-events: none;\s*\}/);
});

test('the text toolbar menu: out of the flow, over the bar when there is no room under it', () => {
  const bar = read('src/editor/svelte/WidgetToolbar.svelte');
  assert.match(bar, /popUp = need > below && above > below/);
  assert.match(bar, /Math\.min\(stage\.bottom, innerHeight\)/);
  assert.match(bar, /\.btb__pop \{[^}]*position: absolute;/);
});

test('the widget pop-up: a 1px white ring at 50% in front of a deep drop shadow (its own token)', () => {
  const tokens = readFileSync(
    new URL('../src/editor/styles/_tokens.scss', import.meta.url),
    'utf8',
  );
  const pop = readFileSync(
    new URL('../src/editor/svelte/WidgetPopup.svelte', import.meta.url),
    'utf8',
  );
  const sec = readFileSync(
    new URL('../src/editor/svelte/SectionPopup.svelte', import.meta.url),
    'utf8',
  );
  assert.match(
    tokens.replace(/\s+/g, ' '),
    /--shadow-pop-widget: 0 0 0 1px var\(--white-a50\), 0 2px 4px var\(--black-a50\), 0 16px 40px var\(--black-a65\), 0 40px 96px var\(--black-a80\);/,
  );
  assert.match(tokens, /--white-a50: rgb\(255 255 255 \/ 0\.5\);/);
  assert.match(pop, /\.wpop \{[^}]*box-shadow: var\(--shadow-pop-widget\);/);
  // only the widget pop-up: the section pop-up keeps the shared pop shadow
  assert.match(sec, /box-shadow: var\(--shadow-pop\);/);
});
