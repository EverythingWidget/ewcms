// A number field (Field.svelte type="number"): the value, then − and + (32 x 32, flush right),
// stepping from the value shown (an inherited placeholder too), clamped to min / max.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { atLimit, shownNumber, stepNumber } from '../src/editor/lib/number-step.js';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('a click steps the value by its step, clamped to min / max', () => {
  assert.equal(stepNumber({ value: 8, min: 1, max: 30, dir: 1 }), 9);
  assert.equal(stepNumber({ value: 8, min: 1, max: 30, dir: -1 }), 7);
  assert.equal(stepNumber({ value: 10, step: 5, dir: 1 }), 15);
  // past a limit: the limit; at it: nothing to do
  assert.equal(stepNumber({ value: 40, max: 30, dir: -1 }), 30);
  assert.equal(stepNumber({ value: 1, min: 1, dir: -1 }), null);
  assert.equal(stepNumber({ value: 30, max: 30, dir: 1 }), null);
  // a step that isn't a positive number: 1
  assert.equal(stepNumber({ value: 2, step: 0, dir: 1 }), 3);
});

test('decimal steps round away float noise', () => {
  assert.equal(stepNumber({ value: 0.1, step: 0.1, dir: 1 }), 0.2);
  assert.equal(stepNumber({ value: 0.2, step: 0.1, dir: 1 }), 0.3);
  assert.equal(stepNumber({ value: 1.15, step: 0.05, dir: -1 }), 1.1);
  assert.equal(stepNumber({ value: 0.92, step: 0.05, dir: 1 }), 0.97);
});

test('an empty field steps from its inherited placeholder, else from min (or 0)', () => {
  // phone rows follow desktop 8 (placeholder "8"): + stores 9, − stores 7
  assert.equal(stepNumber({ value: undefined, placeholder: '8', min: 1, dir: 1 }), 9);
  assert.equal(stepNumber({ value: undefined, placeholder: '8', min: 1, dir: -1 }), 7);
  // a placeholder that is not a number ("Theme's"): + gives min + step, − gives min
  assert.equal(stepNumber({ placeholder: "Theme's", min: 1, max: 30, dir: 1 }), 2);
  assert.equal(stepNumber({ placeholder: "Theme's", min: 1, max: 30, dir: -1 }), 1);
  assert.equal(stepNumber({ dir: 1 }), 1);
  // an inherited value at the limit: − still stores the limit (it becomes the field's own)
  assert.equal(stepNumber({ placeholder: '0', min: 0, dir: -1 }), 0);
  assert.equal(shownNumber('', '8'), 8);
  assert.equal(shownNumber(3, '8'), 3);
  assert.equal(shownNumber(undefined, 'abc'), null);
});

test('− is disabled at min, + at max (the shown value, inherited too)', () => {
  assert.equal(atLimit({ value: 1, min: 1, dir: -1 }), true);
  assert.equal(atLimit({ value: 2, min: 1, dir: -1 }), false);
  assert.equal(atLimit({ value: 30, max: 30, dir: 1 }), true);
  assert.equal(atLimit({ placeholder: '30', max: 30, dir: 1 }), true);
  assert.equal(atLimit({ placeholder: "Theme's", min: 1, dir: -1 }), false);
  assert.equal(atLimit({ value: 5, dir: 1 }), false);
});

test('Field draws a number as the value then − / +, out of the tab order, always there', () => {
  const f = read('src/editor/svelte/Field.svelte');
  assert.match(f, /\{:else if type === 'number'\}\s*<!--[\s\S]*?-->\s*<span class=\{\['nf'/);
  assert.match(f, /class="tf__input nf__input"\s+type="number"/);
  assert.match(f, /\{min\}\s+\{max\}\s+\{step\}/);
  assert.match(
    f,
    /aria-label="Decrease \{label\}"[\s\S]*?tabindex="-1"\s+disabled=\{disabled \|\| atMin\}/,
  );
  assert.match(
    f,
    /aria-label="Increase \{label\}"[\s\S]*?tabindex="-1"\s+disabled=\{disabled \|\| atMax\}/,
  );
  // a click keeps the focus where it is, shows the new value and goes through onvalue (the
  // caller's undo key joins quick clicks into one step)
  assert.match(f, /onmousedown=\{\(e\) => e\.preventDefault\(\)\}/);
  assert.match(f, /if \(numEl\) numEl\.value = String\(next\);\s*onvalue\(next\);/);
  assert.match(f, /step = 1,/);
  // no divider
  assert.doesNotMatch(f, /has-divider|nf__divider/);
});

test('the number field CSS: line over the hover fill, ring around it all, no spinners', () => {
  const css = read('src/editor/styles/editor.scss');
  const nf = css.slice(css.indexOf('\n.nf {'), css.indexOf('\n.nf__step {') + 2000);
  assert.match(nf, /height: var\(--size-control\);\s*overflow: hidden;/);
  assert.match(
    nf,
    /&::after \{[^}]*inset: 0;[^}]*box-shadow: inset 0 0 0 1px var\(--c-line\);[^}]*pointer-events: none;[^}]*z-index: 1;/,
  );
  assert.match(nf, /&:focus-within::after \{\s*box-shadow: var\(--focus-ring\);/);
  assert.match(nf, /appearance: textfield;/);
  assert.match(
    nf,
    /&::-webkit-inner-spin-button,\s*&::-webkit-outer-spin-button \{\s*appearance: none;/,
  );
  assert.match(nf, /\.nf__step \{[^}]*width: var\(--size-control\);\s*height: 100%;/);
  assert.match(nf, /&:last-child \{\s*border-radius: 0 var\(--radius-md\) var\(--radius-md\) 0;/);
  assert.match(
    nf,
    /&:hover:not\(:disabled\) \{\s*color: var\(--c-text\);\s*background: var\(--field-hover\);/,
  );
  assert.match(nf, /&:disabled \{\s*opacity: var\(--o-disabled\);/);
  assert.match(css, /\.tf\.is-selected \.nf::after \{\s*box-shadow: var\(--focus-ring\);/);
  assert.doesNotMatch(nf, /border-left|divider/);
});

test('number fields pass their limits; the motion numbers beside sliders are left as they are', () => {
  const header = read('src/editor/svelte/HeaderPart.svelte');
  assert.equal(
    (header.match(/type="number"\s+min=\{1\}\s+max=\{MAX_HEADER_ROWS\}/g) || []).length,
    2,
  );
  const theme = read('src/editor/svelte/ThemePanel.svelte');
  assert.match(theme, /type="number"\s+min=\{CONTAINED_MIN\}\s+max=\{COLS\}/);
  assert.equal((theme.match(/type="number"\s+min=\{0\}\s+max=\{MAX_MIN_ROWS\}/g) || []).length, 2);
  assert.match(theme, /min=\{key === 'line' \? 0\.05 : 1\}\s+step=\{key === 'line' \? 0\.05 : 1\}/);
  const sec = read('src/editor/svelte/SectionSettings.svelte');
  assert.match(sec, /type="number"\s+min=\{0\}\s+max=\{MAX_MIN_ROWS\}/);
  assert.match(sec, /type="number"\s+min=\{1\}\s+max=\{MAX_MIN_ROWS\}/);
  const wl = read('src/editor/svelte/WidgetLayout.svelte');
  assert.match(wl, /min=\{c\.min\}\s+max=\{c\.max\}\s+step=\{c\.step \?\? 1\}/);
  const motion = read('src/editor/svelte/MotionField.svelte');
  assert.match(motion, /class="f__num"/);
  assert.doesNotMatch(motion, /nf__/);
});
