// The open header or footer, and the preview frame while a page is being edited: a 2px white
// line with a 1px black ring (inset on the part, outside the iframe; box-shadow, so nothing
// moves). Browse keeps the 1px hairline. Widget selection and inline text stay on the accent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

function injectedCss() {
  const b = read('editor/preview-runtime.js');
  return b.slice(b.indexOf('const INJECTED_CSS = `'), b.indexOf('`;', b.indexOf('const INJECTED_CSS')));
}

function frameCss() {
  const app = read('editor/svelte/App.svelte');
  return app.slice(app.indexOf('  .ed-frame {'), app.indexOf('  .ed-stage.is-phone .ed-frame'));
}

test('an open header or footer gets an inset white line with a black ring, not the accent outline', () => {
  const css = injectedCss();
  // on a ::after overlay, so a child with its own background (a footer section, a filled nav)
  // cannot cover the ring. The host stays as it is (the header is position: fixed).
  assert.match(
    css,
    /:is\(\[data-header\], \[data-footer\]\)\[data-ed-open\]::after \{ content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 2147483645; box-shadow: inset 0 0 0 1px \$\{T\.black\}, inset 0 0 0 3px \$\{T\.white\}; \}/,
  );
  assert.doesNotMatch(css, /\[data-ed-open\] \{[^}]*box-shadow:/);
  assert.doesNotMatch(css, /\[data-ed-open\] \{[^}]*outline:/);
  assert.doesNotMatch(css, /\[data-header\][^{]*\{[^}]*position:\s*relative/);
});

test('widget selection and inline text keep the accent outline', () => {
  const css = injectedCss();
  assert.match(
    css,
    /\[data-edit-inline\]\[contenteditable\] \{ outline: 1\.5px solid \$\{T\.accent\};/,
  );
  assert.match(css, /\.__ed-box--sel \{ border: 1\.5px solid \$\{T\.accent\};/);
});

test('the preview frame gets the same ring while editing, the hairline while browsing', () => {
  const app = read('editor/svelte/App.svelte');
  assert.match(app, /class=\{\['ed-frame', editing && 'is-edit'\]\}/);
  const frame = frameCss();
  assert.match(frame, /border: 0;/);
  assert.match(
    frame,
    /box-shadow:\s*0 0 0 1px var\(--c-fill-active\),\s*0 30px 80px -30px var\(--c-scrim\);/,
  );
  assert.match(
    frame,
    /&\.is-edit \{\s*box-shadow:\s*0 0 0 2px var\(--white\),\s*0 0 0 3px var\(--black\),\s*0 30px 80px -30px var\(--c-scrim\);/,
  );
});
