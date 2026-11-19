// The editor's styles injected in the preview (preview-runtime.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test("the editor's preview pauses the header clock's endless pulse (F65, F66, F83)", () => {
  const bridge = readFileSync(new URL('../src/editor/preview-runtime.js', import.meta.url), 'utf8');
  assert.match(bridge, /html \.header__clock-dot \{ animation-play-state: paused; \}/);
});
