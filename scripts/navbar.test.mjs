// The first section's grid below the navbar (v0.1.19): --nav-h from the real header.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { watchNavHeight } from '../src/client/modules/navbar.js';

function fakeDoc(head) {
  const props = {};
  const on = {};
  const win = {
    getComputedStyle: () => head.cs,
    addEventListener: (t, f) => (on[t] = f),
    removeEventListener: (t) => delete on[t],
  };
  return {
    props,
    on,
    documentElement: { style: { setProperty: (k, v) => (props[k] = v) } },
    defaultView: win,
    querySelector: (sel) => (sel === '[data-header]' ? head.el : null),
  };
}

test('--nav-h: a fixed header’s height, kept in sync on resize', () => {
  const head = {
    el: { offsetTop: 0, offsetHeight: 76 },
    cs: { position: 'fixed', display: 'grid' },
  };
  const doc = fakeDoc(head);
  const off = watchNavHeight(doc);
  assert.equal(doc.props['--nav-h'], '76px');
  head.el.offsetHeight = 64; // the phone breakpoint
  doc.on.resize();
  assert.equal(doc.props['--nav-h'], '64px');
  off();
  assert.equal(doc.on.resize, undefined);
});

test('--nav-h: 0 when the header does not float over the page (or there is none)', () => {
  const doc = fakeDoc({
    el: { offsetTop: 0, offsetHeight: 76 },
    cs: { position: 'static', display: 'block' },
  });
  watchNavHeight(doc)();
  assert.equal(doc.props['--nav-h'], '0px');
  const none = fakeDoc({ el: null, cs: null });
  watchNavHeight(none)();
  assert.equal(none.props['--nav-h'], '0px');
});

test('the first visible section of a page pads its grid by --nav-h; the others do not', () => {
  const css = readFileSync(new URL('../src/client/styles/_layout.scss', import.meta.url), 'utf8');
  assert.match(
    css,
    /\[data-router-view\] > \.sec:nth-child\(1 of :not\(\[hidden\]\)\) \{\s*padding-top: var\(--nav-h\);/,
  );
  assert.match(css, /--nav-h: var\(--header-h, 0px\);/);
});
