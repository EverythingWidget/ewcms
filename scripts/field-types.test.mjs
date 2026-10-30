import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BIND_TYPES,
  FIELD_TYPES,
  FORMAT_TYPES,
  SOURCE_FIELD_TYPES,
  WIDGET_FIELD_TYPES,
  blankOf,
  controlOf,
  parseInput,
  storedAs,
} from '../src/site/field-types.js';
import { checkSchema, newItemOf } from '../src/site/schemas.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';

test('field types: one list; schemas and widgets use its names', () => {
  assert.deepEqual(Object.keys(FIELD_TYPES), [
    'text',
    'words',
    'multiline',
    'number',
    'image',
    'images',
    'link',
    'choice',
    'boolean',
    'date',
  ]);
  assert.deepEqual(SOURCE_FIELD_TYPES, [
    'text',
    'multiline',
    'number',
    'image',
    'images',
    'link',
    'choice',
    'boolean',
    'date',
  ]);
  assert.deepEqual(WIDGET_FIELD_TYPES, ['text', 'words', 'multiline', 'number', 'image']);
  assert.deepEqual(FORMAT_TYPES, ['text', 'words', 'multiline', 'link']);
  // the old names are gone
  for (const old of ['longtext', 'photo', 'photos'])
    assert.match(checkSchema({ title: 'a', fields: [{ key: 'a', type: old }] })[0], /"type"/);
  // every bind lists source types only
  for (const list of Object.values(BIND_TYPES))
    for (const t of list) assert.ok(SOURCE_FIELD_TYPES.includes(t), t);
  // a widget field's type (not an editor-only kind) is in the list
  const kinds = new Set(['rich', 'select', 'seg', 'spot', 'source']);
  for (const w of Object.values(WIDGET_TYPES))
    for (const f of w.fields || [])
      if (!kinds.has(f.type) && f.type) assert.ok(WIDGET_FIELD_TYPES.includes(f.type), f.type);
});

test('field types: stored value, editor input, blank, parse', () => {
  assert.equal(storedAs('number'), 'number');
  assert.equal(storedAs('multiline'), 'string');
  assert.equal(storedAs('seg'), 'string');
  assert.equal(controlOf('choice'), 'select');
  assert.equal(controlOf('link'), 'text');
  assert.equal(controlOf('images'), 'image');
  assert.deepEqual(['text', 'number', 'boolean', 'images', 'x'].map(blankOf), [
    '',
    0,
    false,
    [],
    '',
  ]);
  assert.notEqual(blankOf('images'), blankOf('images'), 'a new list each time');
  assert.equal(parseInput('multiline', 'a\nb'), 'a\nb');
  assert.equal(parseInput('text', 'a\n b'), 'a b');
  assert.equal(parseInput('words', '  '), undefined);
  assert.equal(parseInput('number', 'x'), undefined);
  const item = newItemOf({
    title: 'name',
    fields: [
      { key: 'name', type: 'text' },
      { key: 'body', type: 'multiline' },
      { key: 'images', type: 'images' },
      { key: 'kind', type: 'choice', required: true, options: ['a', 'b'] },
    ],
  });
  assert.deepEqual([item.body, item.images, item.kind], ['', [], 'a']);
});
