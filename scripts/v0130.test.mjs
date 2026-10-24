// v0.1.30: a row hovered in the panel outlines its section or widget only; nothing dims
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ov = readFileSync(new URL('../src/editor/overlay.js', import.meta.url), 'utf8');

test('a hovered row: no dimming boxes, its outline only; the Ctrl dimming stays', () => {
  assert.doesNotMatch(ov, /class="dims"|\.dim \{|els\.dims/);
  const peek = ov.slice(ov.indexOf('function drawPeek'), ov.indexOf('function frame()'));
  assert.doesNotMatch(peek, /createElement|others/);
  assert.match(peek, /place\(els\.peek, r\)/);
  assert.match(
    ov,
    /ui\.hot\?\.from === 'panel' \? widgetEl\(ui\.hot\.id\)/,
    'a widget row: its outline',
  );
  assert.match(ov, /ui\.hot\?\.from === 'panel'\s*\? null/, 'a widget row: not its section too');
  assert.match(ov, /<div class="blocks"><\/div>/, 'Ctrl held: other sections still blocked');
});
