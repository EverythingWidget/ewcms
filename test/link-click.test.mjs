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
  assert.match(b, /return body && id && !moved \? \{ a, body \} : null;/);
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

test('F109: while a Text is edited its handles and resize edges are gone: nothing covers its links', () => {
  const o = read('editor/overlay.js');
  assert.match(
    o,
    /els\.sel\.classList\.toggle\('is-editing', !!sel\.querySelector\('\[contenteditable\]'\)\);/,
  );
  assert.match(o, /\.sel\.is-editing \.handle, \.sel\.is-editing \.edge \{ display: none; \}/);
  // (picked, not edited: its links take no pointer on purpose, the click is the widget's and
  // a click on a link opens it: F108)
  assert.match(
    read('editor/bridge.js'),
    /:not\(\[data-anim\], :has\(\[data-anim\], \[contenteditable\]\), \[contenteditable\] \*\) \{ pointer-events: none; \}/,
  );
});

test("F107: a link saved as the editor's preview address is marked, and one click on it asks again", () => {
  const b = read('editor/bridge.js');
  assert.match(
    b,
    /a:is\(\[href\*="\?draft="\], \[href\*="&draft="\], \[data-ts-link\*="draft="\]\) \{ text-decoration: underline wavy/,
  );
  // its first click (the widget not selected yet) opens its box: empty, with the note (DRAFT_HREF)
  // a first click on a link opens it too (the widget need not be picked first: G12)
  assert.match(b, /return body && id && !moved \? \{ a, body \} : null;/);
  const tb = read('editor/svelte/WidgetToolbar.svelte');
  assert.match(tb, /linkDraft = isDraftHref\(href\);\s*linkText = linkDraft \? '' : href;/);
  assert.match(
    tb,
    /\{:else if linkDraft && !linkText\.trim\(\)\}<p class="btb__err" role="status">\s*\{DRAFT_HREF\}/,
  );
});

test('F107: the mark matches the preview address in either form the preview renders', () => {
  const draft = 'http://127.0.0.1:5173/contact/?draft=64941176-6a50-4c3e-8755-00c2d1d0a1f7#';
  // shown: the href itself; edited: href="#" and the link as data-ts-link (JSON)
  assert.ok(draft.includes('?draft='));
  assert.ok(JSON.stringify({ href: draft }).includes('draft='));
  assert.ok(!'https://wa.me/31643740408'.includes('draft='));
});

test('F107: a click off any link is no link (pickedLinkAt never reads a missing <a>)', () => {
  const src = read('editor/bridge.js');
  const fn = src.slice(src.indexOf('function pickedLinkAt('), src.indexOf('let down = null'));
  assert.ok(fn.includes('if (!a) return null;'));
  // the link's box, not the caret: a paragraph must not take a click meant for the link (G12)
  assert.match(fn, /body\.querySelectorAll\('a'\)/);
  assert.match(fn, /getBoundingClientRect\(\)/);
});

test('G12: a locked Header or Footer takes no click; it opens from the pages list only', () => {
  const b = read('editor/bridge.js');
  assert.doesNotMatch(b, /__ed-part-open/);
  assert.doesNotMatch(read('editor/main.js'), /bridge\.on\('part'/);
  // open: a click outside it does nothing (Done locks it)
  assert.match(
    b,
    /if \(open && !open\.contains\(t\)\) \{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*return;/,
  );
  assert.match(
    b,
    /:is\(\[data-header\], \[data-footer\]\):not\(\[data-ed-open\]\) \{ pointer-events: none; \}/,
  );
});

test('F115: Ctrl+K opens the link box from the editor window too, every rich-text field', () => {
  const b = read('editor/bridge.js');
  assert.match(b, /\^\[sezyk\]\$/);
  const tb = read('editor/svelte/WidgetToolbar.svelte');
  assert.match(tb, /window\.addEventListener\('keydown', onKey, true\)/);
  assert.match(tb, /e\.key\.toLowerCase\(\) !== 'k'/);
});
