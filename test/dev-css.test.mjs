import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withDevCss, DEV_CSS_ID } from '../src/cli/vite-plugin-static-site.mjs';

test('a dev page links its stylesheet in <head>, so it is never shown unstyled (F64)', () => {
  const html = withDevCss('<html><head><title>x</title></head><body></body></html>');
  assert.match(
    html,
    new RegExp(
      `<link rel="stylesheet" id="${DEV_CSS_ID}" href="/@fs/[^"]*src/client/styles/main\\.scss\\?direct" />\\n</head>`,
    ),
  );
  // the client drops it once Vite's own style (the one HMR updates) is in
  const main = readFileSync(new URL('../src/client/main.js', import.meta.url), 'utf8');
  assert.match(
    main,
    /if \(import\.meta\.env\.DEV\) document\.getElementById\('ew-dev-css'\)\?\.remove\(\);/,
  );
});
