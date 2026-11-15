// F50: a link copied in the editor and pasted back was saved as the editor's own preview
// address (http://127.0.0.1:5173/contact/?draft=…#): the editing <a href="#"> made absolute by the
// browser's copy, while the paste read only href, not the link the <a> carries (data-ts-link).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { readBody, renderEditing } from '../src/editor/rich.js';
import { htmlLines, linkRangeAt, ownLink, renderBody } from '../src/render/text.js';
import { hrefOf, isDraftHref, isSafeHref } from '../src/render/hrefs.js';

const DRAFT = 'http://127.0.0.1:5173/contact/?draft=64941176-6a50-4c3e-8755-00c2d1d0a1f7#';
const HREFS = [
  'https://wa.me/31643740408',
  'http://example.com/a?b=1#c',
  'mailto:unicderma@yahoo.com',
  'tel:+31643740408',
  '/about/',
  '#top',
];
// what the bridge's paste allows (bridge.js pastedLines)
const pasteSafe = (h) => isSafeHref(h) && !isDraftHref(h);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

test('isDraftHref: the editor preview address only', () => {
  for (const d of [
    DRAFT,
    'http://localhost:5185/contact/?draft=91ea91a1-4d55-4902-bd44-99be0d036266#',
    'http://localhost:5173/?edit&draft=91ea91a1-4d55-4902-bd44-99be0d036266',
  ])
    assert.equal(isDraftHref(d), true, d);
  for (const ok of [...HREFS, 'https://x.nl/?draft=no', 'https://x.nl/draft/', '', null])
    assert.equal(isDraftHref(ok), false, String(ok));
});

test('F50: a copied editor link pastes as the link it is, not as the preview address', () => {
  for (const href of HREFS) {
    // the clipboard HTML Chrome writes for an editing link: href made absolute, data-ts-link kept
    const html = `<a href="${DRAFT}" data-ts-link="${esc(JSON.stringify({ href }))}" style="color:inherit">WhatsApp</a>`;
    const { document } = parseHTML(`<html><body>${html}</body></html>`);
    assert.deepEqual(
      htmlLines(document.body, pasteSafe),
      [{ style: 'paragraph', text: [{ t: 'WhatsApp', link: { href } }] }],
      href,
    );
  }
  // a page link too (it has no URL at all while edited)
  const page = { page: 'pg-abcd' };
  const { document } = parseHTML(
    `<html><body><p><a href="${DRAFT}" data-ts-link="${esc(JSON.stringify(page))}">About</a></p></body></html>`,
  );
  assert.deepEqual(htmlLines(document.body, pasteSafe)[0].text, [{ t: 'About', link: page }]);
});

test('F50: a pasted preview address without its link is no link; a bad data-ts-link is ignored', () => {
  const { document } = parseHTML(
    `<html><body><p><a href="${DRAFT}">a</a> <a href="https://wa.me/1" data-ts-link="{oops">b</a> <a href="#" data-ts-link='{"href":"javascript:x"}'>c</a></p></body></html>`,
  );
  assert.deepEqual(htmlLines(document.body, pasteSafe)[0].text, [
    { t: 'a ' },
    { t: 'b', link: { href: 'https://wa.me/1' } },
    { t: ' ' },
    { t: 'c', link: { href: '#' } }, // its own (unsafe) link ignored: the plain href
  ]);
  assert.equal(ownLink(document.querySelector('a')), null);
});

test('F50: every absolute scheme reads back verbatim from the editing DOM', () => {
  const { document } = parseHTML('<!doctype html><html><body><div id="r"></div></body></html>');
  const root = document.getElementById('r');
  const body = HREFS.map((href) => ({ style: 'paragraph', text: [{ t: 'x', link: { href } }] }));
  renderEditing(root, body);
  assert.deepEqual(readBody(root), body);
  // a link the browser made (no data-ts-link): its attribute as typed, never resolved; the
  // preview's own address is no link
  root.innerHTML = `<p data-line="paragraph"><a href="https://wa.me/31643740408">w</a> <a href="${DRAFT}">d</a></p>`;
  assert.deepEqual(readBody(root), [
    {
      style: 'paragraph',
      text: [{ t: 'w', link: { href: 'https://wa.me/31643740408' } }, { t: ' d' }],
    },
  ]);
});

test('F50: a link already saved as the preview address stays a link the editor can edit', () => {
  const body = [
    {
      style: 'paragraph',
      text: [
        { t: 'Call ' },
        { t: 'WhatsApp', link: { href: DRAFT } },
        { t: ' - NL', link: { href: DRAFT }, marks: ['b'] },
      ],
    },
  ];
  // read back unchanged (not dropped), so nothing is lost before it is fixed
  const { document } = parseHTML('<!doctype html><html><body><div id="r"></div></body></html>');
  const root = document.getElementById('r');
  renderEditing(root, body);
  assert.deepEqual(readBody(root), body);
  // a caret anywhere in it (or at its edges) finds the whole link: the link box edits it
  const whole = { from: { line: 0, at: 5 }, to: { line: 0, at: 18 } };
  for (const at of [5, 9, 13, 18]) assert.deepEqual(linkRangeAt(body, { line: 0, at }), whole, at);
  assert.equal(linkRangeAt(body, { line: 0, at: 2 }), null);
  assert.equal(linkRangeAt(body, { line: 3, at: 0 }), null);
  // the site keeps its URL but the build says so
  const warns = [];
  const warn = console.warn;
  console.warn = (m) => warns.push(String(m));
  try {
    assert.equal(hrefOf({}, { href: DRAFT }, 'contact: a link'), DRAFT);
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(warns, [
    "[links] contact: a link points at the editor's preview: set its link again",
  ]);
  assert.match(renderBody(body, { href: (l) => l.href }), /href="http:\/\/127\.0\.0\.1:5173/);
});

test("F50: the toolbar's Link opens on a caret in a link and empties a preview address", () => {
  const src = readFileSync(
    new URL('../src/editor/svelte/WidgetToolbar.svelte', import.meta.url),
    'utf8',
  );
  assert.match(src, /disabled=\{!rich\?\.selected && !rich\?\.link\}\s*aria-label="Link"/);
  assert.match(src, /linkDraft = isDraftHref\(href\);\s*linkText = linkDraft \? '' : href;/);
  assert.match(src, /bridge\.selectLink\(\)/);
  const bridge = readFileSync(new URL('../src/editor/bridge.js', import.meta.url), 'utf8');
  assert.match(bridge, /htmlLines\(parsed\.body, \(h\) => isSafeHref\(h\) && !isDraftHref\(h\)\)/);
});
