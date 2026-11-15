// F56: typing a Title widget's heading lost its Title (H1) style and renamed the page in the
// panel. Ctrl+A selected every line (the new page's Label and Title), so the typed text replaced
// both and was left in the first line, the Label; and a new page had no name of its own, so the
// panel named it after its first title line, whatever was typed there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { lineToSelect, readBody, renderEditing } from '../src/editor/rich.js';
import { pagesOp } from '../src/server/editor-server.mjs';
import { titleOf } from '../src/editor/lib/page-tree.js';
import { checkContent } from '../src/render/validate.js';

const heading = [
  { style: 'label', text: [{ t: 'Contact' }] },
  { style: 'title', text: [{ t: 'Contact' }] },
];
const caret = (line, at) => ({ from: { line, at }, to: { line, at } });

test('F56: Ctrl+A selects the caret line first, then (selected already) every line', () => {
  // a caret in the Title: the Title line
  assert.deepEqual(lineToSelect(caret(1, 3), heading), {
    from: { line: 1, at: 0 },
    to: { line: 1, at: 7 },
  });
  // part of it selected (either way round): still the whole line
  assert.deepEqual(lineToSelect({ from: { line: 1, at: 5 }, to: { line: 1, at: 2 } }, heading), {
    from: { line: 1, at: 0 },
    to: { line: 1, at: 7 },
  });
  // the line selected already, a selection over lines, or a text of one line: the browser's
  assert.equal(lineToSelect({ from: { line: 1, at: 0 }, to: { line: 1, at: 7 } }, heading), null);
  assert.equal(lineToSelect({ from: { line: 0, at: 2 }, to: { line: 1, at: 1 } }, heading), null);
  assert.equal(lineToSelect(caret(0, 1), [heading[1]]), null);
  assert.equal(lineToSelect(null, heading), null);
});

test('F56: the Title line selected and typed over stays a Title', () => {
  const { document } = parseHTML('<!doctype html><html><body><div id="r"></div></body></html>');
  const root = document.getElementById('r');
  renderEditing(root, heading);
  // what the browser leaves after typing over the Title line's whole text: the same <h1>
  root.children[1].textContent = 'Kom langs, ontspan en geniet';
  assert.deepEqual(readBody(root), [
    heading[0],
    { style: 'title', text: [{ t: 'Kom langs, ontspan en geniet' }] },
  ]);
  assert.equal(root.children[1].tagName, 'H1');
});

test('F56: a new page has its own name (meta.title): typing its heading does not rename it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f56-'));
  const put = (f, data) => {
    const file = path.join(root, 'content/en', f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  };
  put('pages/index.json', { version: 1, kind: 'page', id: 'pg-t035' });
  put('pages/404/index.json', { version: 1, kind: 'page', id: 'pg-t036' });
  assert.equal(pagesOp(root, { op: 'add', name: 'contact', title: 'Contact' }).status, 200);
  const file = path.join(root, 'content/en/pages/contact/index.json');
  const page = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(page.meta, { title: 'Contact' });
  assert.deepEqual(
    page.sections[0].widgets[0].body.map((l) => [l.style, l.text[0].t]),
    [
      ['label', 'Contact'],
      ['title', 'Contact'],
    ],
  );
  // the heading typed: the panel and the tab title keep the page's name
  page.sections[0].widgets[0].body[1].text = [{ t: 'Kom langs, ontspan en geniet' }];
  const files = { 'pages/contact/index.json': page };
  assert.equal(titleOf(files, 'contact'), 'Contact');
  // and the page is valid content
  assert.deepEqual(
    checkContent('pages/contact/index.json', JSON.parse(fs.readFileSync(file, 'utf8'))),
    [],
  );
});
