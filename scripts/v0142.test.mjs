// v0.1.42: lists in the Text widget (a line's "list"), the starter site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  autoList,
  checkBody,
  deleteRange,
  htmlLines,
  insertLines,
  renderBody,
  splitLine,
  tidyBody,
  toggleList,
  unlist,
} from '../src/site/text.js';
import { readBody } from '../src/editor/rich.js';
import { isSafeHref } from '../src/site/hrefs.js';

const P = (t, list) => ({ style: 'paragraph', ...(list ? { list } : {}), text: t ? [{ t }] : [] });

test("v0.1.42: check: a line's list is bullet or number", () => {
  assert.deepEqual(checkBody([P('a', 'bullet'), P('b', 'number'), P('c')], 'body'), []);
  assert.deepEqual(checkBody([P('a', 'dash')], 'body'), [
    '"body.0.list" must be one of bullet, number',
  ]);
  assert.deepEqual(tidyBody([{ ...P('a'), list: 'dash' }, P('b', 'number')]), [
    P('a'),
    P('b', 'number'),
  ]);
});

test('v0.1.42: the site renders a run of items as one <ul>/<ol>; the editor keeps lines flat', () => {
  const body = [
    P('a'),
    P('x', 'bullet'),
    { ...P('y', 'bullet'), style: 'heading' },
    P('1', 'number'),
    P('b'),
  ];
  assert.equal(
    renderBody(body),
    '<p class="ts ts--paragraph" data-line="paragraph">a</p>' +
      '<ul class="ts-list"><li class="ts ts--paragraph" data-line="paragraph" data-list="bullet">x</li>' +
      '<li class="ts ts--heading" data-line="heading" data-list="bullet">y</li></ul>' +
      '<ol class="ts-list"><li class="ts ts--paragraph" data-line="paragraph" data-list="number">1</li></ol>' +
      '<p class="ts ts--paragraph" data-line="paragraph">b</p>',
  );
  const edit = renderBody(body, { editing: true });
  assert.ok(!/<[uo]l|<li/.test(edit));
  assert.match(edit, /<h2 class="ts ts--heading" data-line="heading" data-list="bullet">y<\/h2>/);
  // read back the same body
  const { document } = parseHTML(`<div id="r">${edit}</div>`);
  assert.deepEqual(readBody(document.getElementById('r')), tidyBody(body));
});

test('v0.1.42: Enter continues a list, ends it on an empty item; Backspace and the buttons', () => {
  assert.deepEqual(splitLine([P('ab', 'bullet')], { line: 0, at: 1 }), [
    P('a', 'bullet'),
    P('b', 'bullet'),
  ]);
  assert.deepEqual(splitLine([P('a', 'number'), P('', 'number')], { line: 1, at: 0 }), [
    P('a', 'number'),
    P(''),
  ]);
  assert.deepEqual(unlist([P('a', 'bullet')], 0), [P('a')]);
  const two = [P('a'), P('b', 'bullet')];
  assert.deepEqual(toggleList(two, { line: 0, at: 0 }, { line: 1, at: 1 }, 'number'), [
    P('a', 'number'),
    P('b', 'number'),
  ]);
  assert.deepEqual(
    toggleList([P('a', 'bullet')], { line: 0, at: 0 }, { line: 0, at: 0 }, 'bullet'),
    [P('a')],
  );
  // a joined range keeps the first line's list; pasted lines keep theirs
  assert.deepEqual(
    deleteRange([P('ab', 'bullet'), P('cd')], { line: 0, at: 1 }, { line: 1, at: 1 }),
    [P('ad', 'bullet')],
  );
  const at = { line: 0, at: 1 };
  assert.deepEqual(insertLines([P('xy', 'bullet')], at, at, [P('1'), P('2', 'number')]).body, [
    P('x', 'bullet'),
    P('1'),
    P('2', 'number'),
    P('y', 'bullet'),
  ]);
});

test('v0.1.42: typing "- " or "1. " at a line\'s start makes it an item', () => {
  assert.deepEqual(autoList([P('- hi')], { line: 0, at: 2 }), {
    body: [{ style: 'paragraph', text: [{ t: 'hi' }], list: 'bullet' }],
    at: { line: 0, at: 0 },
  });
  assert.equal(autoList([P('1. ')], { line: 0, at: 3 }).body[0].list, 'number');
  assert.equal(autoList([P('a - b')], { line: 0, at: 4 }), null);
  assert.equal(autoList([P('- x', 'bullet')], { line: 0, at: 2 }), null);
});

test('v0.1.42: pasted <ul>/<ol> become list lines', () => {
  const { document } = parseHTML(
    '<html><body><p>Head</p><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol><p>tail</p></body></html>',
  );
  assert.deepEqual(htmlLines(document.body, isSafeHref), [
    P('Head'),
    P('one', 'bullet'),
    P('two', 'bullet'),
    P('first', 'number'),
    P('tail'),
  ]);
});
