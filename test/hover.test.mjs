// Hover: a panel row outlines its widget or section in the preview, and the preview lights the row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../src/editor/${f}`, import.meta.url), 'utf8');
const ov = readFileSync(new URL('../src/editor/overlay.js', import.meta.url), 'utf8');

test('row hover outlines the widget in the preview, and the preview lights the row', () => {
  const ov = src('overlay.js');
  assert.match(ov, /ui\.hot\?\.from === 'panel' \? widgetEl\(ui\.hot\.id\)/);
  assert.match(ov, /hotWidget\(id, 'preview'\)/);
  assert.match(src('svelte/ui.svelte.js'), /ui\.hot = \{ id, from \}/);
  const card = src('svelte/SectionCard.svelte');
  assert.match(card, /hotWidget\(widget\.id, 'panel'\)/);
  assert.match(src('svelte/WidgetRow.svelte'), /hot && 'is-hot'/);
});

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
