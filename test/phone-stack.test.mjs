// On phones, widgets without a phone layout stack full width in reading order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phoneStack, widgetVars, widgetLinks } from '../src/site/layout/index.js';

const w = (id, base, extra = {}) => ({ id, type: 'text', layout: { base }, ...extra });

test('phone stack: reading order, full width, each following the one before', () => {
  const list = [
    w('w-dddd', { col: 61, span: 60, row: 20 }), // contact button, right of the email line
    w('w-aaaa', { col: 1, span: 30, row: 1 }), // photo row: 4 thumbnails
    w('w-cccc', { col: 1, span: 60, row: 20 }), // email line
    w('w-bbbb', { col: 31, span: 30, row: 1 }),
  ];
  const st = phoneStack(list);
  assert.deepEqual(
    [...st.keys()],
    ['w-aaaa', 'w-bbbb', 'w-cccc', 'w-dddd'], // top, then left
  );
  for (const v of st.values()) assert.deepEqual([v.area.col, v.area.span], [1, 60]);
  assert.equal(st.get('w-aaaa').link, null);
  assert.deepEqual(st.get('w-dddd').link, { to: 'w-cccc', gap: 4 });
  assert.match(widgetVars(list[0], list), /--mc:1;--ms:60;/);
  assert.equal(widgetLinks(list[0], list)['data-mlink'], 'w-cccc 4');
});

test('phone stack: a follower overlapping its leader still comes after it; own phone layouts stay', () => {
  const list = [
    w('w-aaaa', { col: 1, span: 120, row: 1 }),
    w('w-bbbb', { col: 1, span: 120, row: 1, link: { to: 'w-aaaa', gap: -3 } }),
    w('w-cccc', { col: 1, span: 40, row: 9 }, {}),
  ];
  list[2].layout.phone = { col: 10, span: 20, row: 3 };
  const st = phoneStack(list);
  assert.deepEqual([...st.keys()], ['w-aaaa', 'w-bbbb']);
  assert.deepEqual(st.get('w-bbbb').link, { to: 'w-aaaa', gap: -2 }); // its desktop gap halved
  assert.match(widgetVars(list[2], list), /--mc:10;--ms:20;--mr:3;/);
});
