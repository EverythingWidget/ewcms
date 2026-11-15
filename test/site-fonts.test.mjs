// F95: the toolbar's Style list previews each style in the site's fonts (read from the preview).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { siteFonts, absoluteUrls } from '../src/editor/lib/site-fonts.js';

const face = (family, url) => ({
  type: 5,
  cssText: `@font-face { font-family: ${family}; src: url(${url}) format("woff2"); font-weight: 400; }`,
  style: { getPropertyValue: (p) => (p === 'font-family' ? family : '') },
});
const doc = {
  baseURI: 'http://localhost:5185/over-mij/',
  documentElement: {},
  defaultView: {
    getComputedStyle: () => ({
      getPropertyValue: (n) =>
        ({
          '--f-display': ` Asap, 'Helvetica Neue', sans-serif`,
          '--f-body': `"Work Sans", Arial`,
        })[n],
    }),
  },
  styleSheets: [
    { href: null, cssRules: [face('Asap', '/fonts/asap.woff2')] },
    {
      href: 'http://localhost:5185/assets/main.css',
      cssRules: [{ cssRules: [face('"Work Sans"', '../fonts/ws.woff2')] }],
    },
    {
      get cssRules() {
        throw new Error('cross-origin');
      },
    },
  ],
};

test('siteFonts: the faces renamed, url()s absolute, the stacks pointing at them', () => {
  const f = siteFonts(doc);
  assert.equal(f.display, `"site Asap", 'Helvetica Neue', sans-serif`);
  assert.equal(f.body, `"site Work Sans", Arial`);
  assert.match(
    f.css,
    /font-family: "site Asap"; src: url\("http:\/\/localhost:5185\/fonts\/asap\.woff2"\)/,
  );
  assert.match(
    f.css,
    /font-family: "site Work Sans"; src: url\("http:\/\/localhost:5185\/fonts\/ws\.woff2"\)/,
  );
  assert.equal(siteFonts(null), null);
  assert.equal(
    absoluteUrls('url(data:font/woff2;base64,AA)', 'http://x/'),
    'url(data:font/woff2;base64,AA)',
  );
});

test('the Style list: display styles in the site display font, the rest in its body font; the exception said', () => {
  const src = fs.readFileSync(
    new URL('../src/editor/svelte/WidgetToolbar.svelte', import.meta.url),
    'utf8',
  );
  assert.match(src, /siteFonts\(bridge\.doc\)/);
  assert.match(src, /--sty-display: \$\{/);
  assert.match(src, /font-family: var\(--sty-display, inherit\)/);
  assert.match(src, /font-family: var\(--sty-body, inherit\)/);
  assert.match(src, /exception/i);
});
