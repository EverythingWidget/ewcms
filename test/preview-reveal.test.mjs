// Scroll into view in the preview, in one place (src/editor/reveal.js; the site's scroll
// reveal animation: reveal.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OUT_OF_VIEW, reveal } from '../src/editor/reveal.js';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');

/** An element of a 600px-tall preview at `top`..`bottom`; `scrolled` records its scroll. */
function el(top, bottom) {
  const e = {
    scrolled: [],
    ownerDocument: { defaultView: { innerHeight: 600 } },
    getBoundingClientRect: () => ({ top, bottom }),
    scrollIntoView: (o) => e.scrolled.push(o),
  };
  return e;
}

test('reveal: what counts as out of view, by use', () => {
  // a text: within 60px of leaving
  assert.equal(OUT_OF_VIEW.edge({ top: -100, bottom: 70 }, 600), false);
  assert.equal(OUT_OF_VIEW.edge({ top: -100, bottom: 50 }, 600), true);
  assert.equal(OUT_OF_VIEW.edge({ top: 550, bottom: 700 }, 600), true);
  // a widget: any of it off-screen
  assert.equal(OUT_OF_VIEW.part({ top: 10, bottom: 200 }, 600), false);
  assert.equal(OUT_OF_VIEW.part({ top: -5, bottom: 200 }, 600), true);
  assert.equal(OUT_OF_VIEW.part({ top: 500, bottom: 700 }, 600), true);
  // an animation played again: its top below 80%, or above the view
  assert.equal(OUT_OF_VIEW.play({ top: 470, bottom: 700 }, 600), false);
  assert.equal(OUT_OF_VIEW.play({ top: 490, bottom: 700 }, 600), true);
  assert.equal(OUT_OF_VIEW.play({ top: -90, bottom: -1 }, 600), true);
});

test('reveal: centred, smooth or instant, only when out of view; nothing without an element', () => {
  const a = el(-300, 20);
  assert.equal(reveal(a), true);
  assert.deepEqual(a.scrolled, [{ block: 'center', behavior: 'smooth' }]);
  const b = el(100, 200);
  assert.equal(reveal(b, { when: 'part' }), false);
  assert.deepEqual(b.scrolled, []);
  const c = el(590, 900);
  reveal(c, { when: 'play', smooth: false });
  assert.deepEqual(c.scrolled, [{ block: 'center', behavior: 'instant' }]);
  assert.equal(reveal(null), false);
});

test('reveal: the bridge and the overlay scroll through it; Locate lives beside it', () => {
  const b = src('preview-runtime.js');
  assert.match(b, /import \{ reveal \} from '\.\/reveal\.js';/);
  assert.match(b, /reveal\(el, \{ when: 'play', smooth: false \}\)/);
  assert.doesNotMatch(b, /api\.scrollTo\(|scrollIntoView/);
  const o = src('overlay.js');
  assert.match(o, /reveal\(doc && widgetEl\(id\), \{ when: 'part' \}\);/);
  assert.doesNotMatch(o, /scrollIntoView/);
  assert.match(src('main.js'), /hooks\.reveal = \(id\) => overlay\.reveal\(id\);/);
  for (const f of ['ViewTop', 'SectionToolbar', 'ContentPanel', 'WidgetPopup', 'SectionPopup'])
    assert.match(src(`svelte/${f}.svelte`), /import \{ locate \} from '\.\.\/reveal\.js';/, f);
});
