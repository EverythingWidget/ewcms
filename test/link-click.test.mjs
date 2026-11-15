// A link in a Text widget, in the editor preview: a click on it opens its link box (F108), the
// box's address field takes the keys at once (F108), nothing covers the link while its text is
// edited (F109), and a link saved as the editor's preview address is marked and asks to be set
// again when clicked (F107).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('F108: a click on a link in the selected Text edits it there and opens its link box', () => {
  const b = read('editor/bridge.js');
  // the selected widget's link (selected before the press, not a drag's end): edit, then the box
  assert.match(b, /const link = e\.detail === 1 \? pickedLinkAt\(e\.clientX, e\.clientY\) : null;/);
  assert.match(b, /startRich\(link\.body, e\.clientX, e\.clientY\);\s*linkBoxSoon\(\);/);
  assert.match(b, /return body && id && down\?\.widget === id && !moved \? \{ a, body \} : null;/);
  // already edited: a click in a link opens it too
  assert.match(b, /if \(rich && e\.detail === 1 && t\.closest\('a'\)\) linkBoxSoon\(\);/);
  // a double click (a word of the link selected) opens no box; the box opens on a caret in a link
  assert.match(b, /if \(e\.detail > 1\) clearTimeout\(linkBoxTimer\);/);
  assert.match(b, /!isCaret\(s\) \|\| !linkRangeAt\(store\.get\(rich\.file, rich\.ptr\), s\.to\)/);
  assert.match(b, /const LINK_BOX_WAIT = 300;/);
  // the bridge knows the selected widget
  assert.match(read('editor/main.js'), /widget: \(\) => ui\.widget,/);
});

test('F108: the link box address field has the focus (its address selected) when it opens', () => {
  const tb = read('editor/svelte/WidgetToolbar.svelte');
  const open = tb.slice(tb.indexOf('function openLink('), tb.indexOf('let linkInput'));
  assert.match(open, /tick\(\)\.then\(\(\) => linkInput\?\.select\(\)\);/);
  assert.match(tb, /bind:this=\{linkInput\}/);
});
